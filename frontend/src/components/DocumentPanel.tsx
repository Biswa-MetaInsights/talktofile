import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, FileText, Loader2, BookOpen } from 'lucide-react'
import { documentApi } from '../api/client'
import type { Chapter } from '../types'
import { selectedTitles } from '../lib/chapters'

interface Props {
  sessionId: string
  filename: string
  // When set, the panel shows only these chapters (a feature was scoped to them). The
  // user can toggle back to the full document; `onShowFull` clears the scope upstream.
  chapterIds?: string[]
  chapters?: Chapter[]
  onShowFull?: () => void
  onClose: () => void
}

// A slow, graceful ease (easeOutQuint-style) shared by the panel + backdrop so the
// open/close feels smooth and deliberate rather than snapping.
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Shows a document's full extracted text — the sidebar equivalent of the citation
 * "Jump to source" panel, but for the whole document rather than a single passage.
 *
 * It sits *in the layout* (a flex column between the left sidebar and the main panel)
 * and animates its **width** open/closed, so the chat/tool view reflows smoothly to
 * make room rather than being covered — and the close is a graceful collapse, not a
 * snap. The content is a fixed width, anchored left inside an `overflow-hidden` shell,
 * so it's revealed/hidden cleanly rather than squished during the animation. Fetches
 * the content lazily on open.
 */
export default function DocumentPanel({ sessionId, filename, chapterIds, chapters, onShowFull, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Local toggle: even when a scope is active, the user can peek at the full document.
  const [showFull, setShowFull] = useState(false)

  const scoped = !!chapterIds && chapterIds.length > 0
  const filtering = scoped && !showFull

  // A new scope resets the local "show full" peek.
  useEffect(() => { setShowFull(false) }, [chapterIds?.join(',')])

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(null)
    documentApi
      .getContent(sessionId, filename, filtering ? chapterIds : undefined)
      .then((res) => {
        if (!cancelled) setContent(res.data.content)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this document. The session may have expired.')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, filename, filtering, chapterIds])

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the overlay panel (hidden on desktop, where
          the panel sits in-flow and pushes the main content). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[1px] lg:hidden"
      />

      {/* Animating shell: width drives the layout reflow (chat expands/contracts with
          it); overflow-hidden clips the fixed-width content into a clean reveal. */}
      <motion.div
        initial={{ width: 0, opacity: 0.5 }}
        animate={{ width: '24rem', opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="fixed lg:relative inset-y-0 left-0 z-40 max-w-[88vw] lg:max-w-none flex-shrink-0 overflow-hidden shadow-2xl lg:shadow-[8px_0_24px_-12px_rgba(15,23,42,0.15)]"
      >
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          className="absolute inset-y-0 left-0 w-96 max-w-[88vw] flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={filename}>
                {filename}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0 ml-2 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chapter-scope banner: which chapters are shown + a full/filtered toggle. */}
          {scoped && (
            <div className="flex items-start gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300 flex-shrink-0">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-xs">
                {filtering ? (
                  <>Showing <span className="font-medium">{chapters ? selectedTitles(chapterIds!, chapters) : `${chapterIds!.length} chapters`}</span> only.</>
                ) : (
                  <>Showing the full document.</>
                )}
                <div className="mt-1 flex items-center gap-3">
                  <button onClick={() => setShowFull((v) => !v)} className="font-medium underline underline-offset-2 hover:no-underline">
                    {filtering ? 'Show full document' : 'Show selected chapters'}
                  </button>
                  {onShowFull && (
                    <button onClick={onShowFull} className="text-amber-700/80 dark:text-amber-300/80 hover:underline">
                      Clear filter
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin text-sm leading-relaxed">
            <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider mb-3">
              {filtering ? 'Selected chapters' : 'Original document'}
            </p>

            {content === null && !error && (
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}

            {error && (
              <p className="text-brand-600 dark:text-brand-400 text-xs">{error}</p>
            )}

            {content !== null && (
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {content}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
