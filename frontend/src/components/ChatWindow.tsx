import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, FileText, Files, GitCompare, Sparkles, PanelLeftClose, PanelLeftOpen, X, Square, LogOut, Download, Share2, Check, Plus, Link2, ScrollText } from 'lucide-react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import CitationPanel from './CitationPanel'
import { MODE_LABELS } from './ModeSwitcher'
import SectionComposer from './SectionComposer'
import type { Message, SessionInfo, User, Source, AppMode } from '../types'
import { createChatWebSocket, documentApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'
import { withAttribution, shareOrCopy, printAsPdf, escapeHtml } from '../lib/share'

interface Props {
  session: SessionInfo
  onReset: () => void
  // First message the user typed on the landing chat box. Auto-sent once connected.
  initialPrompt?: string
  // The active workspace section, and the callback to switch to another one. Drives
  // the feature tabs under the input (Chat / Summary / … / Charts).
  activeMode: AppMode
  onSwitchMode: (mode: AppMode) => void
  // Sections the user has produced content in — drives the "pick up where you left off"
  // stars on the tabs.
  engagedModes: Set<AppMode>
  // Fire once the user has actually chatted (sent a message), so Chat earns its star.
  onActivity: () => void
  // Left overview panel collapse state + toggle (owned by AppShell). The header hosts
  // the show/hide control for it.
  sidebarHidden: boolean
  onToggleSidebar: () => void
  // Original-document panel open state + toggle (owned by AppShell). This header hosts a
  // show/hide control for it so it's reachable from every section, not just via the sidebar.
  docPanelOpen: boolean
  onToggleDocPanel: () => void
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

export default function ChatWindow({ session, onReset, initialPrompt, activeMode, onSwitchMode, engagedModes, onActivity, sidebarHidden, onToggleSidebar, docPanelOpen, onToggleDocPanel }: Props) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [shared, setShared] = useState<'shared' | 'copied' | null>(null)
  // "Add files / Add URLs" control in the header — additive (never resets the session),
  // Pro-only, matching the Landing chat box. Frontend scaffold for now: added sources
  // show as chips but aren't merged into the live session yet (needs a backend
  // add-to-session endpoint — see CLAUDE.md). Replaces the old confusing "Upload new
  // file(s)" reset button.
  const isPro = user?.plan === 'pro'
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [extraUrl, setExtraUrl] = useState('')
  const [addHint, setAddHint] = useState('')
  const [extraSources, setExtraSources] = useState<{ id: number; type: 'file' | 'url'; label: string }[]>([])
  const extraFileInputRef = useRef<HTMLInputElement>(null)
  const extraIdRef = useRef(0)
  const addHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [citationSource, setCitationSource] = useState<Source | null>(null)
  // Clicking a citation toggles its passage panel: same source again closes it.
  const toggleCitationSource = (source: Source) =>
    setCitationSource((prev) => (prev === source ? null : source))
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  // Id of the just-finished answer we're still fetching citation passages for.
  // Sources are gathered server-side *after* the answer completes, so there's a
  // brief gap where the answer is done but the ¹²³ markers haven't arrived yet.
  const [pendingSourcesId, setPendingSourcesId] = useState<string | null>(null)
  const sourcesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  // Only surface the connection state when something's wrong (dropped / retrying) —
  // a healthy connection shows nothing.
  const showConnIssue = status === 'disconnected' || status === 'reconnecting'

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const finalizeStreaming = useCallback(() => {
    // Clear the streaming flag on whatever message is currently streaming. We do NOT
    // match against streamingIdRef here on purpose: the ref gets nulled on the same
    // tick, so an id-based updater could run after the null and match nothing, leaving
    // the answer stuck "streaming" forever (which hides the Copy button + citations).
    // There's only ever one streaming message, so clearing by the flag is safe.
    streamingIdRef.current = null
    setMessages((prev) =>
      prev.some((m) => m.isStreaming)
        ? prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
        : prev
    )
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
        // Capture the finished answer id before finalizeStreaming clears the ref, so
        // we can show a "Finding sources…" hint until its passages arrive.
        const finishedId = streamingIdRef.current
        finalizeStreaming()
        if (finishedId) {
          setPendingSourcesId(finishedId)
          if (sourcesTimerRef.current) clearTimeout(sourcesTimerRef.current)
          // Safety net: if this answer yields no sources at all, stop waiting.
          sourcesTimerRef.current = setTimeout(() => setPendingSourcesId(null), 9000)
        }
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
          // Attach passages and also force the answer out of "streaming" — sources
          // only arrive after the answer is done, so this guarantees the citation
          // markers render even if finalizeStreaming missed this message.
          return prev.map((m, i) => i === last.i ? { ...m, sources: data.excerpts, isStreaming: false } : m)
        })
        // Passages arrived — stop the "Finding sources…" hint. They're surfaced inline
        // via the ¹²³ hover markers, so we no longer auto-open the CitationPanel; it
        // still opens on demand from the "Cited from your document" footer.
        if (sourcesTimerRef.current) clearTimeout(sourcesTimerRef.current)
        setPendingSourcesId(null)
      } else if (data.type === 'followups') {
        setMessages((prev) => {
          const items = [...prev].map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant' && !m.isPeriodicFeedback && !m.isGuardReject)
          const last = items[items.length - 1]
          if (!last) return prev
          return prev.map((m, i) => i === last.i ? { ...m, followups: data.questions } : m)
        })
        // Follow-ups are sent after sources; if none came, don't keep waiting.
        if (sourcesTimerRef.current) clearTimeout(sourcesTimerRef.current)
        setPendingSourcesId(null)
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

  // onActivity mirrored in a ref so we can mark chat "engaged" from send handlers
  // without adding an unstable prop to their dependency arrays.
  const onActivityRef = useRef(onActivity)
  useEffect(() => { onActivityRef.current = onActivity }, [onActivity])

  useEffect(() => {
    manualCloseRef.current = false
    hasWelcomedRef.current = false
    reconnectAttemptsRef.current = 0
    setStatus('connecting')
    connect()

    return () => {
      manualCloseRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (sourcesTimerRef.current) clearTimeout(sourcesTimerRef.current)
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
    onActivityRef.current()
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
    onActivityRef.current()

    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, isConnected, isTyping])

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

  // ── Add more sources (Pro only; additive — never removes the current file) ──
  const PRO_HINT = 'Interacting with multiple files in a single conversation is a Pro feature.'
  // Phase 2: adding files/URLs mid-session isn't wired to the backend yet, so both
  // entry points just surface "Coming soon!" — no file picker, no URL input box.
  // (The scaffold below — URL box, source chips, handlers — is kept for when a
  // backend add-to-session endpoint lands; restore the picker/URL behaviour then.)
  const showComingSoon = () => {
    setAddingUrl(false)
    setAddHint('Coming soon!')
    if (addHintTimerRef.current) clearTimeout(addHintTimerRef.current)
    addHintTimerRef.current = setTimeout(() => setAddHint(''), 10000)
  }
  const openAddFiles = () => showComingSoon()
  const startAddUrl = () => showComingSoon()
  const onExtraFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) {
      // Newest on top; the existing document(s) are untouched.
      setExtraSources((prev) => [
        ...picked.map((f) => ({ id: ++extraIdRef.current, type: 'file' as const, label: f.name })),
        ...prev,
      ])
    }
    e.target.value = '' // allow re-picking the same file
  }
  const saveExtraUrl = () => {
    const u = extraUrl.trim()
    if (!u) return
    setExtraSources((prev) => [{ id: ++extraIdRef.current, type: 'url', label: u }, ...prev])
    setExtraUrl('')
    setAddingUrl(false)
  }
  const removeExtra = (id: number) => setExtraSources((prev) => prev.filter((s) => s.id !== id))

  const shareChat = useCallback(async () => {
    const docTitle = session.documents.map((d) => d.filename).join(' & ')
    const pairs = messages.filter((m) => !m.isPeriodicFeedback && !m.isGuardReject && m.content.trim())
    const body = pairs
      .map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`)
      .join('\n\n')
    const full = `CHAT WITH ${docTitle.toUpperCase()}\n\n${body}`
    const how = await shareOrCopy(withAttribution(full), `Chat — ${docTitle}`)
    setShared(how)
    setTimeout(() => setShared(null), 2000)
  }, [messages, session.documents])

  const exportReport = useCallback(() => {
    const docTitle = session.documents.map((d) => d.filename).join(' & ')
    const pairs = messages.filter((m) => !m.isPeriodicFeedback && !m.isGuardReject && m.content.trim())
    const body = pairs.map((m) => {
      const role = m.role === 'user' ? 'You' : 'Talktofile'
      const safeContent = escapeHtml(m.content).replace(/\n/g, '<br/>')
      return `<div class="msg ${m.role}"><div class="label">${role}</div><div class="body">${safeContent}</div></div>`
    }).join('')
    // Reuses the shared print helper so chat's Download-as-PDF matches the tool sections
    // and gets the same non-blocking print (the dialog blocks only the new tab).
    printAsPdf({ title: 'Chat', subtitle: docTitle, bodyHtml: body })
  }, [messages, session.documents])

  const docs = session.documents
  const HeaderIcon = session.mode === 'compare' ? GitCompare : session.mode === 'multi' ? Files : FileText
  // The header row now shows the active section name (Chat / Summary / …) instead of the
  // filename. The filename(s) stay reachable via the hover tooltip and the left panel.
  const headerTitle = MODE_LABELS[activeMode]
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
      {/* Scrollable conversation region. The header is the first child inside it
          and is `sticky`, so the filename + connection status stay pinned to the
          top (just under the navbar) while the messages below it scroll. */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-thin bg-brand-50/25 dark:bg-slate-950"
      >
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0 dark:bg-brand-600/15 dark:border-brand-600/30">
            <HeaderIcon className="w-4 h-4 text-brand-500" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 dark:text-slate-100 text-sm font-medium truncate" title={docs.map((d) => d.filename).join(', ')}>{headerTitle}</p>
            {(showConnIssue || session.mode === 'compare' || nonEnglishCount > 0) && (
              <div className="flex items-center gap-2">
                {showConnIssue && (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${status === 'disconnected' ? 'bg-brand-600' : 'bg-brand-400 animate-pulse'}`} />
                    <span className="text-xs text-slate-400 dark:text-slate-500">{status === 'disconnected' ? 'Disconnected' : 'Reconnecting...'}</span>
                  </>
                )}
                {session.mode === 'compare' && <span className="text-xs text-brand-500">{showConnIssue ? '· ' : ''}Compare mode</span>}
                {nonEnglishCount > 0 && (
                  <span className="text-xs text-brand-500">{(showConnIssue || session.mode === 'compare') ? '· ' : ''}answers in English</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="hidden lg:inline-flex items-center justify-center p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15"
            title={sidebarHidden ? 'View overview' : 'Hide overview'}
          >
            {sidebarHidden ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleDocPanel}
            className={`p-1.5 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 ${docPanelOpen ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/15' : 'text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400'}`}
            title={docPanelOpen ? 'Hide the original document' : 'See the original document'}
          >
            <ScrollText className="w-4 h-4" />
          </button>
          <button
            onClick={shareChat}
            className="flex items-center gap-1 p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Share Chat"
            disabled={messages.filter((m) => !m.isPeriodicFeedback).length < 2}
          >
            {shared ? <Check className="w-4 h-4 text-[#E2611B]" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={exportReport}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download Chat as a pdf"
            disabled={messages.filter((m) => !m.isPeriodicFeedback).length < 2}
          >
            <Download className="w-4 h-4" />
          </button>
          <div>
            <button
              onClick={() => { setShowAddMenu((v) => !v); setAddHint(''); setAddingUrl(false) }}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15"
              title="Add files or URLs"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showAddMenu && (
              <>
                {/* Click-away backdrop */}
                <div className="fixed inset-0 z-30" onClick={() => { setShowAddMenu(false); setAddingUrl(false) }} />
                <div className={`absolute right-0 mt-2 z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/60 dark:shadow-black/40 p-3 space-y-2 ${
                  // The whole button group is the positioning context (relative), so
                  // right-0 pins the popover's right edge to End session's right edge.
                  // Widen it while adding a URL so the box + its Add button run longer.
                  addingUrl ? 'w-80' : 'w-64'
                }`}>
                  {/* Added sources (frontend scaffold — not yet merged into the session) */}
                  {extraSources.length > 0 && (
                    <div className="space-y-1.5">
                      {extraSources.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5">
                          {s.type === 'url'
                            ? <Link2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                            : <FileText className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={s.label}>{s.label}</span>
                          <button onClick={() => removeExtra(s.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingUrl ? (
                    <div className="flex items-stretch gap-1.5">
                      <input
                        type="text"
                        value={extraUrl}
                        onChange={(e) => setExtraUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveExtraUrl() } }}
                        placeholder="Paste a link"
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-400"
                      />
                      <button onClick={saveExtraUrl} className="px-2.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors flex-shrink-0">
                        Add
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button onClick={openAddFiles} className="w-full flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-white hover:bg-brand-50 dark:hover:bg-brand-600/15 rounded-lg px-2 py-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Add files
                      </button>
                      <button onClick={startAddUrl} className="w-full flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-white hover:bg-brand-50 dark:hover:bg-brand-600/15 rounded-lg px-2 py-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Add URLs
                      </button>
                    </div>
                  )}

                  {/* Upgrade hint for non-Pro users */}
                  {addHint && (
                    <p className="text-xs text-[#E2611B] bg-[#E2611B]/5 border border-[#E2611B]/20 rounded-lg px-2.5 py-1.5">
                      {addHint}
                    </p>
                  )}
                </div>
              </>
            )}

            <input
              ref={extraFileInputRef}
              type="file"
              multiple
              onChange={onExtraFilesSelected}
              accept=".pdf,.docx,.xlsx,.pptx,.html,.htm,.json,.csv,.md,.txt"
              className="hidden"
            />
          </div>
          <button
            onClick={endSession}
            className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30"
            title="End this session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">End session</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-5 space-y-5">
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
                onCiteSource={toggleCitationSource}
                autoOpenSources={isLastWithSources}
                awaitingSources={msg.id === pendingSourcesId}
              />
            )
          })}
        </AnimatePresence>
        {isTyping && !streamingIdRef.current && <TypingIndicator />}

        {/* Suggested questions — shown inline in the conversation before the first exchange */}
        {messages.length <= 1 && session.suggested_questions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-brand-500" />
              <span className="text-xs text-slate-400 dark:text-slate-500">Suggested questions</span>
            </div>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${
                session.suggested_questions.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
              }`}
            >
              {session.suggested_questions.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => handleSuggestion(q)}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-600 transition-all text-left h-full whitespace-normal break-words dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-600/15 dark:hover:border-brand-600/30 dark:hover:text-brand-300"
                  title={q}
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up suggestions — shown inline in the flow after the latest Sage answer */}
        {(() => {
          const lastSage = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isPeriodicFeedback && !m.isGuardReject && m.followups?.length)
          if (!lastSage?.followups || isTyping) return null
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3 text-brand-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500">Follow-up suggestions</span>
              </div>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${
                  lastSage.followups.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
                }`}
              >
                {lastSage.followups.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    onClick={() => handleSuggestion(q)}
                    className="text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-600 transition-all text-left h-full whitespace-normal break-words dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-600/15 dark:hover:border-brand-600/30 dark:hover:text-brand-300"
                    title={q}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
          )
        })()}
        <div ref={messagesEndRef} />
      </div>
      </div>


      {/* Disconnected banner */}
      <AnimatePresence>
        {status === 'disconnected' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 flex items-center justify-between gap-3 text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 flex-shrink-0 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400"
          >
            <span>Connection lost. Your messages can't be sent right now.</span>
            <button
              onClick={retryNow}
              className="px-2.5 py-1 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 font-medium transition-colors flex-shrink-0 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 dark:text-brand-300"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input — the shared composer (identical across every section). Chat's only
          differences are its send/stop button, the "↵ send" hint, and the live
          send-on-Enter behaviour; everything else matches the tool sections. */}
      <SectionComposer
        active={activeMode}
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Ask anything here."
        value={input}
        onChange={setInput}
        onSubmit={sendMessage}
        disabled={!isConnected}
        inputRef={inputRef}
        proceedButton={isTyping ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={stopGenerating}
            title="Stop generating"
            className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all flex-shrink-0 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
            className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-brand-700 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        )}
      />
    </div>
    </div>
  )
}
