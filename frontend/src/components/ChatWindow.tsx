import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, RotateCcw, FileText, Files, GitCompare, Sparkles, ChevronDown, BookOpen, X, Square, LogOut } from 'lucide-react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import type { Message, SessionInfo } from '../types'
import { createChatWebSocket, documentApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  session: SessionInfo
  onReset: () => void
}

let msgIdCounter = 0
const nextId = () => String(++msgIdCounter)

function buildWelcome(session: SessionInfo): string {
  const docs = session.documents
  const nonEnglish = docs.filter((d) => d.original_language && d.original_language !== 'en')
  const langNote = nonEnglish.length > 0 ? ` Some files aren't in English — I'll answer in English.` : ''

  if (session.mode === 'compare' && docs.length === 2) {
    return `I've analysed **${docs[0].filename}** and **${docs[1].filename}**.${langNote}\n\nAsk me to compare them — differences, similarities, contradictions or mistakes — or anything else. Try a suggested question below.`
  }
  if (session.mode === 'multi') {
    const names = docs.map((d) => `**${d.filename}**`).join(', ')
    return `I've analysed ${docs.length} files: ${names}.${langNote}\n\nEach file's summary is in the side panel. What would you like to do with them?`
  }
  const d = docs[0]
  return `I've analysed **${d?.filename ?? 'your document'}**.${langNote}\n\nI'm ready to answer any questions about it. What would you like to know?`
}

type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

const MAX_RECONNECT_ATTEMPTS = 6

export default function ChatWindow({ session, onReset }: Props) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [showSummary, setShowSummary] = useState(false)
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
          content: buildWelcome(session),
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
    streamingIdRef.current = null
    stoppedRef.current = false
    wsRef.current?.send(JSON.stringify({ question: q }))

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

  const docs = session.documents
  const HeaderIcon = session.mode === 'compare' ? GitCompare : session.mode === 'multi' ? Files : FileText
  const headerTitle = docs.length > 1 ? `${docs.length} documents` : (docs[0]?.filename ?? 'Document')
  const nonEnglishCount = docs.filter((d) => d.original_language && d.original_language !== 'en').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 flex-shrink-0 bg-white rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <HeaderIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 text-sm font-medium truncate" title={docs.map((d) => d.filename).join(', ')}>{headerTitle}</p>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-green-500'
                : status === 'disconnected' ? 'bg-red-500'
                : 'bg-amber-400 animate-pulse'
              }`} />
              <span className="text-xs text-slate-400">{
                status === 'connected' ? 'Connected'
                : status === 'connecting' ? 'Connecting...'
                : status === 'reconnecting' ? 'Reconnecting...'
                : 'Disconnected'
              }</span>
              {session.mode === 'compare' && <span className="text-xs text-indigo-500">· Compare mode</span>}
              {nonEnglishCount > 0 && (
                <span className="text-xs text-amber-500">· answers in English</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
            title="View summaries"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
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
            <div className="px-5 py-4 bg-indigo-50/60 max-h-64 overflow-y-auto scrollbar-thin space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  {docs.length > 1 ? 'Document Summaries' : 'Document Summary'}
                </span>
                <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {docs.map((d, i) => (
                <div key={i}>
                  {docs.length > 1 && <p className="text-xs font-medium text-slate-800 mb-1 truncate">{d.filename}</p>}
                  <div className="prose-custom text-xs text-slate-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.summary}</ReactMarkdown>
                  </div>
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
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} username={user?.username} sessionId={session.session_id} />
          ))}
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
            className="absolute bottom-24 right-6 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 z-10"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Suggested questions */}
      {messages.length <= 1 && session.suggested_questions.length > 0 && (
        <div className="px-4 pb-3 flex-shrink-0 bg-white border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-2 pt-3">
            <Sparkles className="w-3 h-3 text-indigo-500" />
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
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-200 transition-all truncate max-w-[200px]"
                title={q}
              >
                {q}
              </motion.button>
            ))}
          </div>
        </div>
      )}

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
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 resize-none transition-all disabled:opacity-50 leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
            <span className="absolute right-3 bottom-2.5 text-xs text-slate-300 pointer-events-none">
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
              className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-indigo-700 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Sage answers only from document content · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
