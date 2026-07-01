import type { Source } from '../types'

/**
 * Citation grounding helpers.
 *
 * The backend returns citation passages *per answer* (the top matching chunks per
 * document) — it does not tell us which sentence each passage grounds. To render
 * inline superscript markers (¹²³) after individual sentences, we match each
 * returned passage to its best-fit sentence in the answer using significant-word
 * overlap, and locate the longest shared phrase to highlight inside the passage.
 *
 * Everything here is a best-effort heuristic over plain text; it never changes the
 * answer wording, only where the markers land.
 */

/** A citation, resolved to a specific spot in the answer. */
export interface Citation {
  /** 1-based marker number, assigned in reading order (top→bottom of the answer). */
  marker: number
  source: Source
  /** The overlapping phrase to highlight inside the passage ("" when none found). */
  matchedPhrase: string
  /** 0..1 relevance from the backend (source.score). */
  score: number
  /** Human ¶ location derived from the chunk index, e.g. "¶ 3". */
  location: string
}

export interface BuiltCitations {
  /** The answer markdown with `⟦C{n}⟧` tokens inserted after grounded sentences. */
  markedMarkdown: string
  citations: Citation[]
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was',
  'one', 'our', 'out', 'has', 'had', 'his', 'him', 'she', 'its', 'who', 'that', 'this',
  'with', 'from', 'they', 'them', 'their', 'have', 'were', 'been', 'will', 'would', 'what',
  'when', 'which', 'your', 'about', 'into', 'than', 'then', 'some', 'such', 'these', 'those',
  'also', 'more', 'most', 'other', 'over', 'only', 'very', 'here', 'there',
])

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Significant words (length > 3, non-stopword) used for overlap scoring. */
function sigWords(s: string): string[] {
  return normalize(s).split(' ').filter((w) => w.length > 3 && !STOP.has(w))
}

/** Overlap score between a sentence and a passage: shared significant words. */
function overlap(sentence: string, passage: string): number {
  const a = new Set(sigWords(sentence))
  if (a.size === 0) return 0
  const b = new Set(sigWords(passage))
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  // Weight by how much of the sentence is covered, so a short sentence fully
  // contained in the passage outranks a long one with a couple of stray hits.
  return shared + shared / a.size
}

/**
 * Longest run of consecutive words from the sentence that also appears (in order,
 * case-insensitively) in the passage. Returned as it reads in the sentence — used
 * to build a flexible-whitespace highlight regex against the passage.
 */
function longestSharedPhrase(sentence: string, passage: string): string {
  const words = sentence.trim().split(/\s+/)
  const passNorm = normalize(passage)
  let best = ''
  for (let i = 0; i < words.length; i++) {
    let phrase = ''
    for (let j = i; j < words.length; j++) {
      const next = (phrase ? phrase + ' ' : '') + words[j]
      if (passNorm.includes(normalize(next))) {
        phrase = next
        if (phrase.length > best.length) best = phrase
      } else {
        break
      }
    }
  }
  // Require at least one meaningful word so we don't highlight "of the".
  return sigWords(best).length > 0 ? best.trim() : ''
}

interface Span { text: string; end: number }

/** Split raw markdown into sentence spans, tracking each sentence's end offset. */
function splitSentences(raw: string): Span[] {
  const spans: Span[] = []
  const boundary = /[.!?](?=\s|$)/g
  let start = 0
  let m: RegExpExecArray | null
  while ((m = boundary.exec(raw))) {
    const end = m.index + 1
    if (raw.slice(start, end).trim()) spans.push({ text: raw.slice(start, end), end })
    start = boundary.lastIndex
  }
  if (start < raw.length && raw.slice(start).trim()) {
    spans.push({ text: raw.slice(start), end: raw.length })
  }
  return spans
}

/**
 * Assign each source to its best-fit sentence and produce the answer markdown with
 * `⟦C{n}⟧` tokens injected after those sentences. Markers are numbered top→bottom.
 */
export function buildCitations(answer: string, sources: Source[]): BuiltCitations {
  if (!answer.trim() || sources.length === 0) {
    return { markedMarkdown: answer, citations: [] }
  }

  const spans = splitSentences(answer)
  if (spans.length === 0) {
    return { markedMarkdown: answer, citations: [] }
  }

  // Greedy assignment: strongest source→sentence match first, preferring a distinct
  // sentence per source so markers don't pile onto one spot.
  const ranked = sources
    .map((source, si) => {
      let bestSpan = 0
      let bestScore = -1
      spans.forEach((sp, idx) => {
        const sc = overlap(sp.text, source.text)
        if (sc > bestScore) { bestScore = sc; bestSpan = idx }
      })
      return { si, source, bestSpan, bestScore }
    })
    .sort((a, b) => b.bestScore - a.bestScore)

  const usedSpans = new Set<number>()
  // spanEnd → source assignments (a sentence can still take a second marker if every
  // sentence is already used, but we try hard to spread them out first).
  const placed: { end: number; source: Source }[] = []

  for (const r of ranked) {
    let spanIdx = r.bestSpan
    if (usedSpans.has(spanIdx)) {
      // Find the next-best *unused* sentence for this source.
      let altIdx = -1
      let altScore = -1
      spans.forEach((sp, idx) => {
        if (usedSpans.has(idx)) return
        const sc = overlap(sp.text, r.source.text)
        if (sc > altScore) { altScore = sc; altIdx = idx }
      })
      if (altIdx >= 0) spanIdx = altIdx
    }
    usedSpans.add(spanIdx)
    placed.push({ end: spans[spanIdx].end, source: r.source })
  }

  // Fallback: nothing placed → pin every source to the last sentence.
  if (placed.length === 0) {
    const end = spans[spans.length - 1].end
    sources.forEach((source) => placed.push({ end, source }))
  }

  // Number markers in reading order.
  placed.sort((a, b) => a.end - b.end)
  const citations: Citation[] = placed.map((p, i) => {
    const marker = i + 1
    const spanForPhrase = spans.find((s) => s.end === p.end)
    const matchedPhrase = spanForPhrase ? longestSharedPhrase(spanForPhrase.text, p.source.text) : ''
    const chunk = typeof p.source.chunk_index === 'number' ? p.source.chunk_index + 1 : null
    return {
      marker,
      source: p.source,
      matchedPhrase,
      score: p.source.score ?? 0,
      location: chunk ? `¶ ${chunk}` : '¶ passage',
    }
  })

  // Inject tokens from the end backwards so offsets stay valid.
  const inserts = citations
    .map((c) => ({ end: placed[c.marker - 1].end, marker: c.marker }))
    .sort((a, b) => b.end - a.end)
  let out = answer
  for (const ins of inserts) {
    out = out.slice(0, ins.end) + `⟦C${ins.marker}⟧` + out.slice(ins.end)
  }

  return { markedMarkdown: out, citations }
}
