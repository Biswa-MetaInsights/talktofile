import { useState, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CornerDownLeft } from 'lucide-react'
import type { Citation } from '../lib/citations'

interface Props {
  cite: Citation
  /** Fires when the user clicks "Jump to source" — flashes the left-panel row. */
  onJump?: (source: Citation['source']) => void
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Render the passage with the matched phrase highlighted (flexible whitespace). */
function highlightPassage(text: string, phrase: string): ReactNode {
  if (!phrase) return text
  const words = phrase.trim().split(/\s+/).map(escapeRegExp)
  if (words.length === 0) return text
  let re: RegExp
  try {
    re = new RegExp(`(${words.join('\\s+')})`, 'i')
  } catch {
    return text
  }
  const parts = text.split(re)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-brand-100 text-brand-800 rounded px-0.5 not-italic">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function CitationMarker({ cite, onJump }: Props) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])

  // Small delay on leave so the cursor can cross the invisible bridge into the card.
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }, [])

  const pct = Math.round((cite.score || 0) * 100)

  return (
    <span
      className="relative inline"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onFocus={show}
        onBlur={scheduleClose}
        onClick={show}
        aria-label={`Source ${cite.marker} — ${pct}% match`}
        className="mx-0.5 inline-flex items-center justify-center rounded-md bg-brand-50 font-bold text-brand-600 align-super hover:bg-brand-100 hover:text-brand-700 cursor-pointer select-none transition-colors dark:bg-brand-600/20 dark:text-brand-300 dark:hover:bg-brand-600/30 dark:hover:text-brand-200"
        style={{ fontSize: '0.72em', lineHeight: 1.35, minWidth: '1.15em', padding: '0 0.28em' }}
      >
        {cite.marker}
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            // The card sits directly above the marker. `pb-2` is the invisible bridge:
            // the transparent padding keeps the pointer "inside" while crossing the gap.
            className="absolute bottom-full left-1/2 z-50 block w-[19rem] max-w-[80vw] -translate-x-1/2 pb-2"
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
          >
            <span className="block rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/40">
              {/* Header: filename · ¶ location · match % */}
              <span className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="truncate font-semibold uppercase tracking-wider text-brand-600"
                  style={{ fontSize: '0.62rem' }}
                  title={cite.source.filename}
                >
                  {cite.source.filename}
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5 text-slate-400 dark:text-slate-500" style={{ fontSize: '0.62rem' }}>
                  <span className="font-medium text-slate-500 dark:text-slate-400">{cite.location}</span>
                  <span className="h-2.5 w-px bg-slate-200 dark:bg-slate-600" />
                  <span className="font-semibold text-brand-500">{pct}% match</span>
                </span>
              </span>

              {/* Passage with the matched phrase highlighted */}
              <span
                className="block max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed text-slate-600 dark:text-slate-300 scrollbar-thin [overflow-wrap:anywhere]"
                style={{ fontSize: '0.8rem' }}
              >
                {highlightPassage(cite.source.text, cite.matchedPhrase)}
              </span>

              <button
                type="button"
                onClick={() => { setOpen(false); onJump?.(cite.source) }}
                className="mt-2.5 flex items-center gap-1.5 font-medium text-brand-600 transition-colors hover:text-brand-700"
                style={{ fontSize: '0.72rem' }}
              >
                <CornerDownLeft className="h-3 w-3" />
                Jump to source
              </button>

              {/* Little arrow pointing down at the marker */}
              <span className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
