import { BookOpen, Check } from 'lucide-react'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  // Selected chapter ids. Empty = "All chapters" (whole document).
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}

/**
 * A compact chapter checklist rendered above a feature's composer (like the Translate
 * language picker / Charts type picker). "All chapters" clears the selection (= whole
 * document); ticking specific chapters scopes the feature to them. Shared across the
 * tool sections so chapter-scoping looks identical everywhere.
 */
export default function ChapterPicker({ chapters, selected, onChange, className = '' }: Props) {
  if (chapters.length <= 1) return null

  const set = new Set(selected)
  const all = selected.length === 0

  const toggle = (id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // If everything ends up selected, collapse to "all" (empty) for a clean whole-doc scope.
    onChange(next.size >= chapters.length ? [] : chapters.filter((c) => next.has(c.id)).map((c) => c.id))
  }

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
      active
        ? 'bg-[#E2611B] text-white'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
    }`

  return (
    <div className={`px-4 pt-3 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Chapters
        </span>
        <button onClick={() => onChange([])} className={chip(all)}>
          {all && <Check className="w-3 h-3" />} All chapters
        </button>
        {chapters.map((c) => {
          const active = set.has(c.id)
          return (
            <button key={c.id} onClick={() => toggle(c.id)} className={chip(active)} title={c.title}>
              {active && <Check className="w-3 h-3" />}
              <span className="max-w-[10rem] truncate">{c.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
