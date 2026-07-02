import { useState, useMemo, useCallback, Children, cloneElement, createElement, isValidElement, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ShieldAlert, User, Copy, Check, ThumbsUp, ThumbsDown, Sparkles, Quote } from 'lucide-react'
import type { Message, Source } from '../types'
import { feedbackApi } from '../api/client'
import { buildCitations } from '../lib/citations'
import CitationMarker from './CitationMarker'

interface Props {
  message: Message
  username?: string
  sessionId?: string
  onCiteSource?: (source: Source) => void
  autoOpenSources?: boolean
  /** True while this finished answer's citation passages are still being fetched. */
  awaitingSources?: boolean
}

export default function MessageBubble({ message, username, sessionId, onCiteSource, autoOpenSources, awaitingSources }: Props) {
  const isUser = message.role === 'user'
  const isGuard = message.isGuardReject
  const isPeriodicFeedback = message.isPeriodicFeedback
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<1 | -1 | 0>(0)
  const [periodicVote, setPeriodicVote] = useState<1 | -1 | null>(null)

  const handleCopy = async () => {
    const text = message.content
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts / older browsers.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const handleVote = (v: 1 | -1) => {
    const next = vote === v ? 0 : v
    setVote(next)
    if (next !== 0) {
      feedbackApi.rateMessage({
        vote: v,
        session_id: sessionId,
        answer_excerpt: message.content.slice(0, 2000),
      }).catch(() => {})
    }
  }

  const handlePeriodicVote = (v: 1 | -1) => {
    if (periodicVote !== null) return
    setPeriodicVote(v)
    feedbackApi.rateMessage({
      vote: v,
      session_id: sessionId,
      answer_excerpt: '[session-check-in]',
    }).catch(() => {})
  }

  const showActions = !isUser && !isGuard && !isPeriodicFeedback && !message.isStreaming && message.content.trim().length > 0
  const hasSources = showActions && message.sources && message.sources.length > 0

  // Match each returned passage to its best-fit sentence and inject `⟦C{n}⟧` tokens.
  // Only for a finished Sage answer with sources — never while streaming.
  const { markedMarkdown, citations } = useMemo(() => {
    if (!hasSources) return { markedMarkdown: message.content, citations: [] }
    return buildCitations(message.content, message.sources!)
  }, [hasSources, message.content, message.sources])

  // Walk rendered markdown children, replacing citation tokens with hover markers.
  const injectMarkers = useCallback((children: ReactNode): ReactNode => {
    if (citations.length === 0) return children
    return Children.map(children, (child, ci) => {
      if (typeof child === 'string') {
        if (!child.includes('⟦C')) return child
        const parts = child.split(/⟦C(\d+)⟧/)
        return parts.map((part, i) => {
          if (i % 2 === 0) return part
          const n = Number(part)
          const cite = citations.find((c) => c.marker === n)
          return cite ? (
            <CitationMarker key={`${ci}-${i}`} cite={cite} onJump={onCiteSource} />
          ) : null
        })
      }
      if (isValidElement(child) && (child.props as { children?: ReactNode })?.children != null) {
        return cloneElement(
          child as React.ReactElement<{ children?: ReactNode }>,
          undefined,
          injectMarkers((child.props as { children?: ReactNode }).children),
        )
      }
      return child
    })
  }, [citations, onCiteSource])

  const mdComponents = useMemo<Components | undefined>(() => {
    if (citations.length === 0) return undefined
    const wrap = (Tag: string) =>
      ({ node: _node, children, ...props }: { node?: unknown; children?: ReactNode }) =>
        createElement(Tag, props, injectMarkers(children))
    return {
      p: wrap('p'), li: wrap('li'), h1: wrap('h1'), h2: wrap('h2'),
      h3: wrap('h3'), h4: wrap('h4'), td: wrap('td'), blockquote: wrap('blockquote'),
    } as Components
  }, [citations, injectMarkers])

  if (isPeriodicFeedback) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end gap-2.5"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm shadow-brand-200/60">
          T
        </div>
        <div className="max-w-[78%] bg-brand-50 border border-brand-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm dark:bg-brand-600/10 dark:border-brand-600/25">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">How am I doing so far?</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Your feedback helps us keep improving.</p>
          {periodicVote === null ? (
            <div className="flex gap-2">
              <button
                onClick={() => handlePeriodicVote(1)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-green-500/10 dark:hover:border-green-500/40 dark:hover:text-green-400"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Helpful
              </button>
              <button
                onClick={() => handlePeriodicVote(-1)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:border-red-500/40 dark:hover:text-red-400"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Not helpful
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Thanks for your feedback!
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
            : isGuard
            ? 'bg-brand-100 border border-brand-300 text-brand-600 dark:bg-brand-600/15 dark:border-brand-600/40'
            : 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
        }`}
      >
        {isUser ? (
          username ? username[0].toUpperCase() : <User className="w-3.5 h-3.5" />
        ) : isGuard ? (
          <ShieldAlert className="w-3.5 h-3.5" />
        ) : (
          'T'
        )}
      </div>

      {/* Bubble */}
      <div className="max-w-[78%] min-w-0 flex flex-col gap-1.5">
      <div
        className={`min-w-0 ${
          isUser
            ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl rounded-br-md shadow-sm shadow-brand-200 px-4 py-3'
            : isGuard
            ? 'bg-brand-50 border border-brand-200 rounded-2xl rounded-bl-md shadow-sm dark:bg-brand-600/10 dark:border-brand-600/30 px-4 py-3'
            : 'bg-white border border-slate-200 rounded-2xl rounded-bl-md shadow-sm shadow-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none px-4 py-3.5'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        ) : (
          <div className={`prose-custom text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${isGuard ? 'text-brand-700 dark:text-brand-300' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {markedMarkdown}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-brand-500 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-between'}`}>
          {showActions && (
            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-all">
              <button
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy'}
                className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => handleVote(1)}
                title="Helpful"
                aria-pressed={vote === 1}
                className={`transition-colors ${vote === 1 ? 'text-green-500' : 'text-slate-400 hover:text-green-500'}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleVote(-1)}
                title="Not helpful"
                aria-pressed={vote === -1}
                className={`transition-colors ${vote === -1 ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className={`text-xs ${isUser ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'} text-right`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Sources are fetched after the answer finishes, so briefly show a hint while
          the passages (and their ¹²³ markers) are still on their way. */}
      {showActions && !hasSources && awaitingSources && (
        <span className="flex items-center gap-1.5 px-1 text-slate-400 dark:text-slate-500 animate-pulse" style={{ fontSize: '0.7rem' }}>
          <Quote className="h-3 w-3" /> Finding sources…
        </span>
      )}

      {/* Citation footer — the passages are now surfaced inline via the ¹²³ markers.
          This just tells the reader they're there. Clicking opens the full excerpt. */}
      {hasSources && citations.length > 0 && (
        <button
          onClick={() => onCiteSource?.(message.sources![0])}
          className="group/cite mt-0.5 flex w-full items-center gap-1.5 border-t border-slate-100 px-1 pt-2 text-slate-400 transition-colors hover:text-brand-600 dark:border-slate-700/60 dark:text-slate-500 dark:hover:text-brand-400"
          style={{ fontSize: '0.8rem' }}
          title="Open the full passages"
        >
          <span>
            <span className="text-slate-400 dark:text-slate-500 group-hover/cite:text-brand-500">Hover ¹²³ to view where the source material.</span>
          </span>
        </button>
      )}
      </div>
    </motion.div>
  )
}
