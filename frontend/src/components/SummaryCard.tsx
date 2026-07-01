import { FileText, Sparkles, Hash } from 'lucide-react'
import type { DocumentSummary } from '../types'

interface Props {
  summary: DocumentSummary
  compact?: boolean
}

/**
 * A polished, structured rendering of a document's summary — overview line,
 * key-point bullets, and topic tags — instead of raw markdown.
 */
export default function SummaryCard({ summary, compact = false }: Props) {
  if (!summary || (!summary.overview && summary.key_points.length === 0)) return null

  return (
    <div className="space-y-3">
      {/* Doc type + overview */}
      <div>
        {summary.doc_type && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-100 rounded-md px-1.5 py-0.5 mb-2 dark:bg-brand-600/15 dark:border-brand-600/30 dark:text-brand-300">
            <FileText className="w-2.5 h-2.5" /> {summary.doc_type}
          </span>
        )}
        {summary.overview && (
          <p className={`text-slate-700 dark:text-slate-300 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
            {summary.overview}
          </p>
        )}
      </div>

      {/* Key points */}
      {summary.key_points.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Key points</span>
          </div>
          <ul className="space-y-1.5">
            {summary.key_points.map((p, i) => (
              <li key={i} className={`flex gap-2 text-slate-700 dark:text-slate-300 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex-shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Topic tags */}
      {summary.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {summary.topics.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              <Hash className="w-2.5 h-2.5 text-slate-400" />{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
