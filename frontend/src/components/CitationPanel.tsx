import { motion } from 'framer-motion'
import { X, FileText } from 'lucide-react'
import type { Source } from '../types'

interface Props {
  source: Source
  onClose: () => void
}

// A slow, graceful ease (easeOutQuint-style) shared by the panel + backdrop so the
// open/close feels smooth and deliberate rather than snapping. Mirrors DocumentPanel.
const EASE = [0.22, 1, 0.36, 1] as const

export default function CitationPanel({ source, onClose }: Props) {
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
        animate={{ width: '20rem', opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="fixed lg:relative inset-y-0 left-0 z-40 max-w-[88vw] lg:max-w-none flex-shrink-0 overflow-hidden shadow-2xl lg:shadow-[8px_0_24px_-12px_rgba(15,23,42,0.15)]"
      >
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          className="absolute inset-y-0 left-0 w-80 max-w-[88vw] flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={source.filename}>
                {source.filename}
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

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin text-sm leading-relaxed">
            <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider mb-3">
              Document excerpt &nbsp;·&nbsp; {Math.round(source.score * 100)}% match
            </p>

            {source.context_before && (
              <p className="text-slate-400 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {source.context_before}
              </p>
            )}

            <mark className="block bg-yellow-200 text-slate-800 rounded-md px-2 py-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] not-italic">
              {source.text}
            </mark>

            {source.context_after && (
              <p className="text-slate-400 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {source.context_after}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
