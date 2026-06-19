import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ShieldAlert, User, Copy, Check, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'
import type { Message } from '../types'
import { feedbackApi } from '../api/client'

interface Props {
  message: Message
  username?: string
  sessionId?: string
}

export default function MessageBubble({ message, username, sessionId }: Props) {
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

  if (isPeriodicFeedback) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end gap-2.5"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm shadow-indigo-200">
          S
        </div>
        <div className="max-w-[78%] bg-indigo-50 border border-indigo-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <p className="text-sm font-medium text-slate-800">How am I doing so far?</p>
          </div>
          <p className="text-xs text-slate-500 mb-3">Your feedback helps us keep improving Sage.</p>
          {periodicVote === null ? (
            <div className="flex gap-2">
              <button
                onClick={() => handlePeriodicVote(1)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all shadow-sm"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Helpful
              </button>
              <button
                onClick={() => handlePeriodicVote(-1)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Not helpful
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white'
            : isGuard
            ? 'bg-amber-100 border border-amber-300 text-amber-600'
            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white'
        }`}
      >
        {isUser ? (
          username ? username[0].toUpperCase() : <User className="w-3.5 h-3.5" />
        ) : isGuard ? (
          <ShieldAlert className="w-3.5 h-3.5" />
        ) : (
          'S'
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] ${
          isUser
            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-br-sm shadow-sm shadow-indigo-200'
            : isGuard
            ? 'bg-amber-50 border border-amber-200 rounded-2xl rounded-bl-sm shadow-sm'
            : 'bg-white border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm'
        } px-4 py-3`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        ) : (
          <div className={`prose-custom text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${isGuard ? 'text-amber-700' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-between'}`}>
          {showActions && (
            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-all">
              <button
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy'}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
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
          <p className={`text-xs ${isUser ? 'text-indigo-200' : 'text-slate-400'} text-right`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
