import { motion } from 'framer-motion'
import { X, FileText } from 'lucide-react'
import type { Source } from '../types'

interface Props {
  source: Source
  onClose: () => void
}

export default function CitationPanel({ source, onClose }: Props) {
  return (
    <>
      {/* Mobile backdrop — tap to dismiss the overlay panel (hidden on desktop) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
      />
      <motion.div
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed lg:relative inset-y-0 left-0 z-40 w-[85%] max-w-xs lg:w-80 lg:max-w-none flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col shadow-xl lg:shadow-none dark:border-slate-800 dark:bg-slate-900"
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
    </>
  )
}
