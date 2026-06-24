import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, RotateCcw, FileText, Files, GitCompare, Sparkles, ChevronDown, BookOpen, X, Square, LogOut, Download } from 'lucide-react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import SummaryCard from './SummaryCard'
import CitationPanel from './CitationPanel'
import type { Message, SessionInfo, User, Source } from '../types'
import { createChatWebSocket, documentApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'

interface Props {
  session: SessionInfo
  onReset: () => void
  // First message the user typed on the landing chat box. Auto-sent once connected.
  initialPrompt?: string
}

let msgIdCounter = 0
const nextId = () => String(++msgIdCounter)

function greetingPrefix(user: User | null): string {
  // Greet registered (non-guest) users by name. Guests have a random
  // generated username, so we keep their welcome generic.
  if (!user || user.is_guest) return ''
  const fullName = user.profile?.full_name?.trim()
  const name = (fullName ? fullName.split(/\s+/)[0] : user.username)?.trim()
  return name ? `Hi ${name}! ` : ''
}

function buildWelcome(session: SessionInfo, user: User | null): string {
  const docs = session.documents
  const nonEnglish = docs.filter((d) => d.original_language && d.original_language !== 'en')
  const langNote = nonEnglish.length > 0 ? ` Some files aren't in English, so I'll answer in English.` : ''
  const hi = greetingPrefix(user)

  if (session.mode === 'compare' && docs.length === 2) {
    return `${hi}I've analysed **${docs[0].filename}** and **${docs[1].filename}**.${langNote}\n\nAsk me to compare them: differences, similarities, contradictions or mistakes, or anything else. Try a suggested question below.`
  }
  if (session.mode === 'multi') {
    const names = docs.map((d) => `**${d.filename}**`).join(', ')
    return `${hi}I've analysed ${docs.length} files: ${names}.${langNote}\n\nEach file's summary is in the side panel. What would you like to do with them?`
  }
  const d = docs[0]
  return `${hi}I've analysed **${d?.filename ?? 'your document'}**.${langNote}\n\nI'm ready to answer any questions about it. What would you like to know?`
}

type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

const MAX_RECONNECT_ATTEMPTS = 6

export default function ChatWindow({ session, onReset, initialPrompt }: Props) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [showSummary, setShowSummary] = useState(false)
  const [citationSource, setCitationSource] = useState<Source | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const streamingIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualCloseRef = useRef(false)
  const hasWelcomedRef = useRef(false)
  const stoppedRef = useRef(false)

  const isConnected = status === 'connected'

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const finalizeStreaming = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m
      )
    )
    streamingIdRef.current = null
    setIsTyping(false)
  }, [])

  const connect = useCallback(() => {
    const ws = createChatWebSocket(session.session_id, token!)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      setStatus('connected')
      if (!hasWelcomedRef.current) {
        hasWelcomedRef.current = true
        setMessages([{
          id: nextId(),
          role: 'assistant',
          content: buildWelcome(session, userRef.current),
          timestamp: new Date(),
        }])
      }
    }

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data)
      if (stoppedRef.current && data.type !== 'done') return

      if (data.type === 'token') {
        let sid = streamingIdRef.current
        if (!sid) {
          sid = nextId()
          streamingIdRef.current = sid
          const newId = sid
          setMessages((prev) => [...prev, {
            id: newId,
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            isStreaming: true,
          }])
        } else {
          const curId = sid
          setMessages((prev) =>
            prev.map((m) =>
              m.id === curId ? { ...m, content: m.content + data.content } : m
            )
          )
        }
      } else if (data.type === 'done') {
        stoppedRef.current = false
        finalizeStreaming()
      } else if (data.type === 'guard_reject' || data.type === 'limit') {
        streamingIdRef.current = null
        setIsTyping(false)
        setMessages((prev) => [...prev, {
          id: nextId(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
          isGuardReject: true,
        }])
      } else if (data.type === 'sources') {
        setMessages((prev) => {
          const items = [...prev].map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant' && !m.isPeriodicFeedback && !m.isGuardReject)
          const last = items[items.length - 1]
          if (!last) return prev
          return prev.map((m, i) => i === last.i ? { ...m, sources: data.excerpts } : m)
        })
        if (data.excerpts?.length > 0) {
          setCitationSource(data.excerpts[0])
        }
      } else if (data.type === 'followups') {
        setMessages((prev) => {
          const items = [...prev].map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant' && !m.isPeriodicFeedback && !m.isGuardReject)
          const last = items[items.length - 1]
          if (!last) return prev
          return prev.map((m, i) => i === last.i ? { ...m, followups: data.questions } : m)
        })
      } else if (data.type === 'feedback_prompt') {
        setMessages((prev) => [...prev, {
          id: nextId(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isPeriodicFeedback: true,
        }])
      } else if (data.type === 'error') {
        streamingIdRef.current = null
        setIsTyping(false)
        setMessages((prev) => [...prev, {
          id: nextId(),
          role: 'assistant',
          content: data.content || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        }])
      }
    }

    const handleDrop = () => {
      if (streamingIdRef.current || isTypingRef.current) finalizeStreaming()
      if (manualCloseRef.current) return

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus('disconnected')
        return
      }
      const attempt = reconnectAttemptsRef.current++
      const delay = Math.min(1000 * 2 ** attempt, 10000)
      setStatus('reconnecting')
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onclose = handleDrop
    ws.onerror = () => ws.close()
  }, [session.session_id, token, finalizeStreaming])

  const isTypingRef = useRef(false)
  useEffect(() => { isTypingRef.current = isTyping }, [isTyping])

  // user mirrored in a ref so connect() reads the latest without re-creating the
  // socket (avoids dropping the chat on unrelated user updates like persona).
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    manualCloseRef.current = false
    hasWelcomedRef.current = false
    reconnectAttemptsRef.current = 0
    setStatus('connecting')
    connect()

    return () => {
      manualCloseRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  // Auto-send the first message the user typed on the landing page, once the chat
  // socket is connected (so it lands right after Sage's welcome). Guarded so a
  // reconnect never re-sends it.
  const sentInitialRef = useRef(false)
  useEffect(() => {
    if (status !== 'connected' || sentInitialRef.current) return
    const q = (initialPrompt ?? '').trim()
    if (!q) return
    sentInitialRef.current = true
    setMessages((prev) => [...prev, {
      id: nextId(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    }])
    setIsTyping(true)
    setCitationSource(null)
    streamingIdRef.current = null
    stoppedRef.current = false
    wsRef.current?.send(JSON.stringify({ question: q }))
    track('question_asked', { mode: session.mode })
  }, [status, initialPrompt, session.mode])

  const retryNow = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectAttemptsRef.current = 0
    setStatus('connecting')
    connect()
  }, [connect])

  const stopGenerating = useCallback(() => {
    if (!streamingIdRef.current && !isTyping) return
    stoppedRef.current = true
    finalizeStreaming()
    wsRef.current?.close()
  }, [isTyping, finalizeStreaming])

  useEffect(() => { scrollToBottom() }, [messages, isTyping])

  useEffect(() => {
    const t = inputRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 140) + 'px'
  }, [input])

  const handleScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setShowScrollBtn(!atBottom)
  }

  const sendMessage = useCallback(() => {
    const q = input.trim()
    if (!q || !isConnected || isTyping) return

    setMessages((prev) => [...prev, {
      id: nextId(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    }])
    setInput('')
    setIsTyping(true)
    setCitationSource(null)
    streamingIdRef.current = null
    stoppedRef.current = false
    wsRef.current?.send(JSON.stringify({ question: q }))
    track('question_asked', { mode: session.mode })

    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, isConnected, isTyping])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSuggestion = (q: string) => {
    setInput(q)
    inputRef.current?.focus()
  }

  const endSession = useCallback(() => {
    manualCloseRef.current = true
    wsRef.current?.close()
    documentApi.deleteSession(session.session_id).catch(() => {})
    onReset()
  }, [session.session_id, onReset])

  const exportReport = useCallback(() => {
    const docTitle = session.documents.map((d) => d.filename).join(' & ')
    const pairs = messages.filter((m) => !m.isPeriodicFeedback && !m.isGuardReject && m.content.trim())
    const rows = pairs.map((m) => {
      const role = m.role === 'user' ? 'You' : 'Assistant'
      const safeContent = m.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')
      return `<div class="msg ${m.role}"><div class="label">${role}</div><div class="body">${safeContent}</div></div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>TalkToFile: ${docTitle}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:40px;background:#f8fafc;color:#0f172a}
  h1{font-size:22px;font-weight:700;color:#1e293b;margin-bottom:4px}
  .meta{font-size:12px;color:#94a3b8;margin-bottom:32px}
  .msg{margin-bottom:20px;max-width:800px}
  .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
  .msg.user .label{color:#E2611B}
  .msg.assistant .label{color:#0f172a}
  .body{font-size:14px;line-height:1.65;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px}
  .msg.user .body{background:#fdf4ee;border-color:#f6cbab}
  .footer{margin-top:40px;font-size:11px;color:#cbd5e1;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{background:#fff;padding:24px}.msg{page-break-inside:avoid}}
</style>
</head>
<body>
<h1>TalkToFile Session Report</h1>
<div class="meta">Document${docs.length > 1 ? 's' : ''}: ${docTitle} &nbsp;·&nbsp; Exported ${new Date().toLocaleString()}</div>
${rows}
<div class="footer">Generated by TalkToFile · talktofile.ai</div>
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 400)
    }
  }, [messages, session.documents])

  const docs = session.documents
  const HeaderIcon = session.mode === 'compare' ? GitCompare : session.mode === 'multi' ? Files : FileText
  const headerTitle = docs.length > 1 ? `${docs.length} documents` : (docs[0]?.filename ?? 'Document')
  const nonEnglishCount = docs.filter((d) => d.original_language && d.original_language !== 'en').length

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* Citation panel — slides in from left when a source is clicked */}
      <AnimatePresence>
        {citationSource && (
          <CitationPanel source={citationSource} onClose={() => setCitationSource(null)} />
        )}
      </AnimatePresence>

    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 flex-shrink-0 bg-white rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
            <HeaderIcon className="w-4 h-4 text-brand-500" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 text-sm font-medium truncate" title={docs.map((d) => d.filename).join(', ')}>{headerTitle}</p>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-green-500'
                : status === 'disconnected' ? 'bg-brand-600'
                : 'bg-brand-400 animate-pulse'
              }`} />
              <span className="text-xs text-slate-400">{
                status === 'connected' ? 'Connected'
                : status === 'connecting' ? 'Connecting...'
                : status === 'reconnecting' ? 'Reconnecting...'
                : 'Disconnected'
              }</span>
              {session.mode === 'compare' && <span className="text-xs text-brand-500">· Compare mode</span>}
              {nonEnglishCount > 0 && (
                <span className="text-xs text-brand-500">· answers in English</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors rounded-lg hover:bg-brand-50"
            title="View summaries"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={exportReport}
            className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors rounded-lg hover:bg-brand-50"
            title="Export report"
            disabled={messages.filter((m) => !m.isPeriodicFeedback).length < 2}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors rounded-lg hover:bg-brand-50"
            title="Upload new file(s)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={endSession}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 px-2.5 py-1.5 border border-slate-200 hover:border-red-200"
            title="End this session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">End session</span>
          </button>
        </div>
      </div>

      {/* Summary panel */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-slate-200 flex-shrink-0"
          >
            <div className="px-5 py-4 bg-brand-50/60 max-h-64 overflow-y-auto scrollbar-thin space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                  {docs.length > 1 ? 'Document Summaries' : 'Document Summary'}
                </span>
                <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {docs.map((d, i) => (
                <div key={i}>
                  {docs.length > 1 && <p className="text-xs font-medium text-slate-800 mb-1.5 truncate">{d.filename}</p>}
                  <SummaryCard summary={d.summary} compact />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin bg-slate-50/80"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isLastWithSources = msg.role === 'assistant' && !!msg.sources?.length &&
              !messages.slice(i + 1).some((m) => m.role === 'assistant' && !!m.sources?.length)
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                username={user?.username}
                sessionId={session.session_id}
                onCiteSource={setCitationSource}
                autoOpenSources={isLastWithSources}
              />
            )
          })}
        </AnimatePresence>
        {isTyping && !streamingIdRef.current && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-6 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-200 z-10"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Suggested questions (before first exchange) */}
      {messages.length <= 1 && session.suggested_questions.length > 0 && (
        <div className="px-4 pb-3 flex-shrink-0 bg-white border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-2 pt-3">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span className="text-xs text-slate-400">Suggested questions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.suggested_questions.map((q, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handleSuggestion(q)}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 hover:bg-brand-100 hover:border-brand-200 transition-all truncate max-w-[200px]"
                title={q}
              >
                {q}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up suggestions (after each Sage answer) */}
      {(() => {
        const lastSage = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isPeriodicFeedback && !m.isGuardReject && m.followups?.length)
        if (!lastSage?.followups || isTyping) return null
        return (
          <div className="px-4 pb-3 flex-shrink-0 bg-white border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-2 pt-3">
              <Sparkles className="w-3 h-3 text-brand-500" />
              <span className="text-xs text-slate-400">Follow-up suggestions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastSage.followups.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => handleSuggestion(q)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-600 transition-all truncate max-w-[260px]"
                  title={q}
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Disconnected banner */}
      <AnimatePresence>
        {status === 'disconnected' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 flex items-center justify-between gap-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex-shrink-0"
          >
            <span>Connection lost. Your messages can't be sent right now.</span>
            <button
              onClick={retryNow}
              className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors flex-shrink-0"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0 border-t border-slate-200 pt-3 bg-white rounded-b-2xl">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the document..."
              rows={1}
              disabled={!isConnected}
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-4 sm:pr-16 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none transition-all disabled:opacity-50 leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
            <span className="hidden sm:block absolute right-3 bottom-2.5 text-xs text-slate-300 pointer-events-none">
              ↵ send
            </span>
          </div>
          {isTyping ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopGenerating}
              title="Stop generating"
              className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-sm hover:bg-slate-200 transition-all flex-shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-brand-700 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Answers drawn only from your document · Shift+Enter for new line
        </p>
      </div>
    </div>
    </div>
  )
}
