import type { Chapter } from '../types'

/**
 * Parse a free-text request like "summary of chapter 1 and 2", "chapters 1-3",
 * "sections 2, 4 and 5" into the matching chapter ids (in document order).
 *
 * Requires a chapter-ish keyword (chapter/section/part/page/slide/ch) to be present,
 * so a stray number in an unrelated instruction doesn't accidentally scope the request.
 * Numbers are matched to a chapter whose TITLE contains that number first (so "chapter 1"
 * maps to the section titled "Chapter 1" even when an "Introduction" precedes it), then
 * fall back to the Nth chapter by position.
 *
 * Returns [] when nothing chapter-like is requested (→ treat as the whole document).
 */
export function parseChapterSelection(text: string, chapters: Chapter[]): string[] {
  if (!text || !chapters.length) return []
  if (!/(chapters?|sections?|parts?|pages?|slides?|\bch\b)/i.test(text)) return []

  const nums = new Set<number>()

  // Ranges first: "1-3", "1 to 3", "1 – 3".
  const rangeRe = /(\d+)\s*(?:-|–|—|to)\s*(\d+)/g
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(text))) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (a && b && b >= a && b - a < 200) for (let n = a; n <= b; n++) nums.add(n)
  }
  // Then any standalone numbers.
  const singleRe = /\d+/g
  while ((m = singleRe.exec(text))) nums.add(parseInt(m[0], 10))

  if (!nums.size) return []

  const chosen = new Set<string>()
  for (const n of nums) {
    const byTitle = chapters.find((c) => new RegExp(`\\b0*${n}\\b`).test(c.title))
    if (byTitle) { chosen.add(byTitle.id); continue }
    const byPos = chapters[n - 1]
    if (byPos) chosen.add(byPos.id)
  }
  return chapters.filter((c) => chosen.has(c.id)).map((c) => c.id)
}

/** True when the selection is empty or covers every chapter (i.e. "the whole document"). */
export function isWholeDocument(selectedIds: string[], chapters: Chapter[]): boolean {
  return selectedIds.length === 0 || selectedIds.length >= chapters.length
}

/** Human-readable list of the selected chapter titles, e.g. "Chapter 1, Chapter 2". */
export function selectedTitles(selectedIds: string[], chapters: Chapter[]): string {
  const set = new Set(selectedIds)
  return chapters.filter((c) => set.has(c.id)).map((c) => c.title).join(', ')
}
