import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}

/** A readable, searchable outline for long summary chapter lists. */
export default function SummaryChapterPicker({ chapters, selected, onChange, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const hierarchy = useMemo(() => buildHierarchy(chapters), [chapters])

  if (chapters.length <= 1) return null

  const selectedSet = new Set(selected)
  const all = selected.length === 0
  const toggle = (id: string) => {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next.size >= chapters.length ? [] : chapters.filter((chapter) => next.has(chapter.id)).map((chapter) => chapter.id))
  }

  const visible = query.trim()
    ? chapters.filter((chapter) => chapter.title.toLowerCase().includes(query.trim().toLowerCase()))
    : chapters
  const visibleIds = new Set(visible.map((chapter) => chapter.id))
  const visibleHierarchy = query.trim() ? buildHierarchy(visible) : hierarchy
  const preview = all
    ? 'Whole document'
    : chapters.filter((chapter) => selectedSet.has(chapter.id)).slice(0, 2).map((chapter) => cleanTitle(chapter.title)).join(' · ')

  return (
    <section className={`px-4 pt-3 ${className}`} aria-label="Summary chapter selection">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/70">
        <BookOpen className="h-4 w-4 flex-shrink-0 text-[#E2611B]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Summary scope</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {all ? 'Whole document' : `${selected.length} of ${chapters.length} sections selected`}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={preview}>{preview}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-[#E2611B]/50 hover:text-[#E2611B] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {expanded ? 'Hide sections' : 'Choose sections'}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onChange([])}
              aria-pressed={all}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${all
                ? 'bg-[#E2611B] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
            >
              Entire document
            </button>
            {!all && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Clear selection
              </button>
            )}
            <label className="ml-auto min-w-[12rem] flex-1 sm:flex-none">
              <span className="sr-only">Search sections</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a section…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-[#E2611B] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>
          <div className="max-h-56 overflow-y-auto p-2" role="group" aria-label="Document sections">
            {visibleHierarchy.length ? visibleHierarchy.map((node) => (
              <ChapterRow key={node.chapter.id} node={node} selected={selectedSet} onToggle={toggle} depth={0} visibleIds={visibleIds} />
            )) : (
              <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matching sections.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Select the sections you want summarized. Leave the whole document selected for a complete summary.
          </div>
        </div>
      )}
    </section>
  )
}

interface OutlineNode {
  chapter: Chapter
  children: OutlineNode[]
}

function buildHierarchy(chapters: Chapter[]): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: Array<{ level: number; node: OutlineNode }> = []

  chapters.forEach((chapter) => {
    const level = headingLevel(chapter.title)
    const node: OutlineNode = { chapter, children: [] }
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    if (stack.length) stack[stack.length - 1].node.children.push(node)
    else roots.push(node)
    stack.push({ level, node })
  })

  return roots
}

function headingLevel(title: string): number {
  const text = title.trim()
  const markdown = text.match(/^(#{1,6})\s+/)
  if (markdown) return markdown[1].length
  const numbered = text.match(/^(\d+(?:\.\d+)*)(?:[.)]?\s|$)/)
  if (numbered) return 10 + (numbered[1].match(/\./g)?.length ?? 0)
  return 10
}

function cleanTitle(title: string): string {
  return title.replace(/^#{1,6}\s+/, '').trim()
}

function ChapterRow({
  node,
  selected,
  onToggle,
  depth,
  visibleIds,
}: {
  node: OutlineNode
  selected: Set<string>
  onToggle: (id: string) => void
  depth: number
  visibleIds: Set<string>
}) {
  const title = cleanTitle(node.chapter.title)
  return (
    <>
      <label
        className="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        style={{ paddingLeft: `${12 + Math.min(depth, 5) * 20}px` }}
        title={title}
      >
        <input
          type="checkbox"
          checked={selected.has(node.chapter.id)}
          onChange={() => onToggle(node.chapter.id)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#E2611B]"
        />
        <span className="min-w-0 flex-1 break-words leading-5">{title}</span>
      </label>
      {node.children.filter((child) => visibleIds.has(child.chapter.id)).map((child) => (
        <ChapterRow key={child.chapter.id} node={child} selected={selected} onToggle={onToggle} depth={depth + 1} visibleIds={visibleIds} />
      ))}
    </>
  )
}
