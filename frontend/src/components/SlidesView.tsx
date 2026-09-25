import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Presentation, Loader2, Download, Maximize2, X, ChevronLeft, ChevronRight, Layers,
  Pencil, Check, Plus, Trash2, ChevronUp, ChevronDown, Palette, Sparkles,
} from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { withAttribution, shareOrCopy, printAsPdf, escapeHtml, type SectionShareActions } from '../lib/share'
import SectionComposer from './SectionComposer'
import SectionExtras from './SectionExtras'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once slides have been generated, so this section earns its "pick up where you
  // left off" star.
  onActivity?: () => void
  // When true, generate immediately on mount — the user picked this section on the
  // Landing page and proceeded, so the "Generate slides" step is redundant the first
  // time. Only the landing-selected section gets this; switching in via a tab does not
  // (it keeps the manual button).
  autoGenerate?: boolean
  // Register this section's header actions (Share text / Export PDF) with the shared
  // WorkspaceHeader. Called with the actions once a deck exists, null when there isn't.
  // (The .pptx download stays the primary export; these act on a readable outline of the deck.)
  registerActions?: (mode: AppMode, actions: SectionShareActions | null) => void
}

// One slide's structured content (as produced by the backend slide agent). `type` picks
// the layout; each layout reads only its own fields (see LAYOUTS below and the schema in
// backend/agents/slide_agent.py).
type SlideType =
  | 'title' | 'agenda' | 'section' | 'content' | 'stats'
  | 'comparison' | 'process' | 'cards' | 'quote' | 'closing'

interface SlideItem { heading: string; text: string }
interface SlideColumn { heading: string; points: string[] }

interface SlideData {
  type?: SlideType
  title?: string
  subtitle?: string          // title / section / closing
  bullets?: string[]         // content / agenda
  items?: SlideItem[]        // stats / process / cards
  columns?: SlideColumn[]    // comparison (exactly 2)
  quote?: string             // quote
  attribution?: string       // quote
  speaker_note?: string
}

const LAYOUTS: { key: SlideType; label: string }[] = [
  { key: 'title', label: 'Cover' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'section', label: 'Section divider' },
  { key: 'content', label: 'Bullets' },
  { key: 'stats', label: 'Big numbers' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'process', label: 'Process steps' },
  { key: 'cards', label: 'Cards' },
  { key: 'quote', label: 'Quote' },
  { key: 'closing', label: 'Closing' },
]

type Preset = 'classic' | 'minimal' | 'bold'
interface Theme {
  preset: Preset
  accent: string
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'classic', label: 'Classic' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'bold', label: 'Bold' },
]

const DEFAULT_ACCENT = '#E2611B'

// Every text line a slide carries, in reading order — used to convert a slide between
// layouts in the editor and to build the Share / PDF outline.
function slideLines(s: SlideData): string[] {
  const out: string[] = []
  if (s.subtitle) out.push(s.subtitle)
  if (s.quote) out.push(s.quote)
  ;(s.bullets ?? []).forEach((b) => b && out.push(b))
  ;(s.items ?? []).forEach((it) => out.push([it.heading, it.text].filter(Boolean).join(' — ')))
  ;(s.columns ?? []).forEach((c) => {
    if (c.heading) out.push(c.heading)
    c.points.forEach((p) => p && out.push(p))
  })
  if (s.attribution) out.push(`— ${s.attribution}`)
  return out.filter(Boolean)
}

// Re-shape a slide into another layout, carrying its text across as best it fits.
function convertSlide(s: SlideData, to: SlideType): SlideData {
  const lines = slideLines(s)
  const base: SlideData = { type: to, title: s.title ?? '', speaker_note: s.speaker_note }
  const asItems = (): SlideItem[] => {
    if (s.items?.length) return s.items
    const src = lines.length ? lines : ['']
    return src.slice(0, 4).map((l) => {
      const [h, ...rest] = l.split(' — ')
      return rest.length ? { heading: h, text: rest.join(' — ') } : { heading: '', text: h }
    })
  }
  switch (to) {
    case 'title': case 'section': case 'closing':
      return { ...base, subtitle: s.subtitle ?? lines[0] ?? '' }
    case 'content': case 'agenda':
      return { ...base, bullets: lines.length ? lines.slice(0, 6) : [''] }
    case 'stats': case 'process': case 'cards':
      return { ...base, items: asItems() }
    case 'comparison': {
      if (s.columns?.length === 2) return { ...base, columns: s.columns }
      const half = Math.ceil(lines.length / 2)
      return { ...base, columns: [
        { heading: 'Option A', points: lines.slice(0, half) },
        { heading: 'Option B', points: lines.slice(half) },
      ] }
    }
    case 'quote':
      return { ...base, quote: s.quote ?? lines[0] ?? s.title ?? '', attribution: s.attribution ?? '' }
  }
}

// ── Palette (mirror of `palette()` in backend/agents/slide_agent.py — keep identical) ──
function hexToRgb(h: string): [number, number, number] {
  let v = h.replace('#', '')
  if (v.length === 3) v = v.split('').map((c) => c + c).join('')
  const n = parseInt(v, 16)
  return Number.isNaN(n) ? [226, 97, 27] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number): string {
  const [ra, ga, ba] = hexToRgb(a)
  const [rb, gb, bb] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(ra, rb)}${c(ga, gb)}${c(ba, bb)}`.toUpperCase()
}
function onColor(color: string): string {
  const [r, g, b] = hexToRgb(color)
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#0F172A' : '#FFFFFF'
}

interface Palette {
  bg: string; surface: string; text: string; muted: string; rule: string
  heroBg: string; heroText: string; heroMuted: string; accent: string; onAccent: string
}

function palette(preset: Preset, accent: string): Palette {
  let p: Omit<Palette, 'accent' | 'onAccent'>
  if (preset === 'minimal') {
    // Editorial: warm paper, ink text, accent used sparingly.
    p = { bg: '#FAFAF7', surface: '#FFFFFF', text: '#1C1917', muted: '#78716C', rule: '#E7E5E4',
          heroBg: '#FAFAF7', heroText: '#1C1917', heroMuted: '#78716C' }
  } else if (preset === 'bold') {
    // Dark keynote.
    p = { bg: '#0B1020', surface: '#161C2E', text: '#F8FAFC', muted: '#94A3B8', rule: '#26304A',
          heroBg: '#0B1020', heroText: '#FFFFFF', heroMuted: '#94A3B8' }
  } else {
    // Classic: clean corporate, full-bleed accent on cover / section / closing.
    const on = onColor(accent)
    p = { bg: '#FFFFFF', surface: '#F4F6F9', text: '#0F172A', muted: '#64748B', rule: '#E2E8F0',
          heroBg: accent, heroText: on, heroMuted: mix(accent, on, 0.78) }
  }
  return { ...p, accent, onAccent: onColor(accent) }
}

// ── Drawing primitives ─────────────────────────────────────────────────────────
// Slide space is 100 × 56.25 units, 1 unit = 1cqw (1% of the slide's width), so one
// markup scales from a thumbnail to fullscreen. build_pptx uses the same numbers.
const MX = 6
const BODY_Y = 17

function R({ x, y, w, h, color, radius = 0, round = false }: {
  x: number; y: number; w: number; h: number; color: string; radius?: number; round?: boolean
}) {
  return (
    <div style={{
      position: 'absolute', left: `${x}cqw`, top: `${y}cqw`, width: `${w}cqw`, height: `${h}cqw`,
      background: color, borderRadius: round ? '50%' : radius ? `${radius}cqw` : undefined,
    }} />
  )
}

function T({ x, y, w, h, size, color, bold, italic, align = 'left', anchor = 'top', spacing = 1.15, children }: {
  x: number; y: number; w: number; h: number; size: number; color: string
  bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'
  anchor?: 'top' | 'middle' | 'bottom'; spacing?: number; children: ReactNode
}) {
  return (
    <div style={{
      position: 'absolute', left: `${x}cqw`, top: `${y}cqw`, width: `${w}cqw`, height: `${h}cqw`,
      display: 'flex', flexDirection: 'column',
      justifyContent: anchor === 'top' ? 'flex-start' : anchor === 'middle' ? 'center' : 'flex-end',
      fontSize: `${size}cqw`, lineHeight: spacing * 1.2, color, textAlign: align,
      fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : undefined,
      letterSpacing: bold && size >= 3 ? '-0.02em' : undefined, whiteSpace: 'pre-line',
    }}>
      {children}
    </div>
  )
}

const cols = (n: number, gap = 2.4, width = 100 - 2 * MX) => {
  const w = (width - gap * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({ x: MX + i * (w + gap), w }))
}

// ── A single rendered slide (HTML preview mirroring build_pptx) ────────────────
interface CanvasProps {
  slide: SlideData
  theme: Theme
  author?: string
  deckTitle: string
  number: number          // 1-based slide number (footer)
  sectionNumber: number   // 1-based count of section dividers up to this one
}

function SlideCanvas({ slide, theme, author, deckTitle, number, sectionNumber }: CanvasProps) {
  const p = palette(theme.preset, theme.accent)
  const kind: SlideType = slide.type && LAYOUTS.some((l) => l.key === slide.type) ? slide.type : 'content'
  const preset = theme.preset
  const isHero = kind === 'title' || kind === 'section' || kind === 'closing'
  const heroW = preset === 'bold' ? 60 : 64
  const heroRule = preset === 'classic' ? p.heroText : p.accent
  const heroMeta = preset === 'classic' ? p.heroMuted : p.accent

  const heroBg = (
    <>
      {preset === 'classic' && <>
        <R x={64} y={-14} w={52} h={52} color={mix(p.accent, '#FFFFFF', 0.10)} round />
        <R x={80} y={30} w={34} h={34} color={mix(p.accent, '#000000', 0.08)} round />
      </>}
      {preset === 'bold' && <>
        <R x={72} y={0} w={28} h={56.25} color={p.accent} />
        <R x={78} y={16} w={24} h={24} color={mix(p.accent, '#000000', 0.18)} round />
      </>}
      {preset === 'minimal' && <>
        <R x={MX} y={6} w={1.8} h={1.8} color={p.accent} />
        <R x={MX} y={46.5} w={100 - 2 * MX} h={0.12} color={p.rule} />
      </>}
    </>
  )

  let body: ReactNode = null
  if (kind === 'title' || kind === 'closing') {
    const t = kind === 'title' ? 15 : 14
    body = (
      <>
        {heroBg}
        <T x={MX} y={t} w={heroW} h={18} size={5.6} color={p.heroText} bold anchor="bottom" spacing={1.0}>
          {slide.title || (kind === 'title' ? 'Untitled' : 'Thank you')}
        </T>
        <R x={MX} y={t + 20} w={8} h={0.5} color={heroRule} />
        {slide.subtitle && (
          <T x={MX} y={t + 22.5} w={heroW} h={kind === 'title' ? 6 : 8} size={2.0} color={p.heroMuted}>{slide.subtitle}</T>
        )}
        {author && (
          <T x={MX} y={48.5} w={heroW} h={3} size={1.35} color={heroMeta} bold>
            {kind === 'title' ? `Created by ${author}` : author}
          </T>
        )}
      </>
    )
  } else if (kind === 'section') {
    body = (
      <>
        {heroBg}
        <T x={MX} y={10} w={heroW} h={12} size={9} color={preset === 'classic' ? p.heroMuted : p.accent} bold anchor="bottom" spacing={1.0}>
          {String(sectionNumber).padStart(2, '0')}
        </T>
        <T x={MX} y={23.5} w={heroW} h={13} size={4.6} color={p.heroText} bold spacing={1.05}>{slide.title}</T>
        {slide.subtitle && <T x={MX} y={39} w={heroW} h={6} size={1.9} color={p.heroMuted}>{slide.subtitle}</T>}
      </>
    )
  } else {
    // Body slides: accent tick, headline, layout body, footer.
    let inner: ReactNode = null
    if (kind === 'content') {
      const bullets = slide.bullets ?? []
      const row = Math.min(7.5, 31 / Math.max(bullets.length, 1))
      inner = bullets.map((b, i) => {
        const y = BODY_Y + 1 + i * row
        return (
          <div key={i}>
            <R x={MX} y={y + 0.75} w={0.9} h={0.9} color={p.accent} />
            <T x={MX + 3} y={y} w={84} h={row} size={2.0} color={p.text}>{b}</T>
            {i < bullets.length - 1 && <R x={MX + 3} y={y + row - 1.1} w={85} h={0.08} color={p.rule} />}
          </div>
        )
      })
    } else if (kind === 'agenda') {
      const items = slide.bullets ?? []
      const row = Math.min(6.5, 31 / Math.max(items.length, 1))
      inner = items.map((t, i) => {
        const y = BODY_Y + 1 + i * row
        return (
          <div key={i}>
            <T x={MX} y={y} w={6} h={row} size={2.4} color={p.accent} bold>{String(i + 1).padStart(2, '0')}</T>
            <T x={MX + 7} y={y + 0.2} w={80} h={row} size={2.1} color={p.text}>{t}</T>
            <R x={MX + 7} y={y + row - 1.0} w={81} h={0.08} color={p.rule} />
          </div>
        )
      })
    } else if (kind === 'stats') {
      const items = slide.items ?? []
      inner = cols(Math.max(items.length, 1)).slice(0, items.length).map(({ x, w }, i) => (
        <div key={i}>
          <R x={x} y={BODY_Y + 2} w={w} h={27} color={p.surface} radius={1.2} />
          <R x={x} y={BODY_Y + 2} w={0.5} h={27} color={p.accent} />
          <T x={x + 2.8} y={BODY_Y + 5} w={w - 5} h={10} size={items[i].heading.length <= 6 ? 5.4 : 3.4} color={p.accent} bold anchor="bottom" spacing={1.0}>{items[i].heading}</T>
          <T x={x + 2.8} y={BODY_Y + 17} w={w - 5} h={11} size={1.55} color={p.text}>{items[i].text}</T>
        </div>
      ))
    } else if (kind === 'cards') {
      const items = slide.items ?? []
      inner = cols(Math.max(items.length, 1)).slice(0, items.length).map(({ x, w }, i) => (
        <div key={i}>
          <R x={x} y={BODY_Y + 1} w={w} h={30} color={p.surface} radius={1.2} />
          <R x={x + 2.6} y={BODY_Y + 3.6} w={4.2} h={4.2} color={p.accent} round />
          <T x={x + 2.6} y={BODY_Y + 3.6} w={4.2} h={4.2} size={1.6} color={p.onAccent} bold align="center" anchor="middle">{i + 1}</T>
          <T x={x + 2.6} y={BODY_Y + 10.5} w={w - 5.2} h={5} size={1.9} color={p.text} bold spacing={1.05}>{items[i].heading}</T>
          <T x={x + 2.6} y={BODY_Y + 16.5} w={w - 5.2} h={13} size={1.45} color={p.muted}>{items[i].text}</T>
        </div>
      ))
    } else if (kind === 'process') {
      const items = slide.items ?? []
      const c = cols(Math.max(items.length, 1)).slice(0, items.length)
      const d = 5.2
      const cy = BODY_Y + 4
      inner = (
        <>
          {c.length > 1 && (
            <R x={c[0].x + d / 2} y={cy + d / 2 - 0.12} w={c[c.length - 1].x - c[0].x} h={0.24} color={p.rule} />
          )}
          {c.map(({ x, w }, i) => (
            <div key={i}>
              <R x={x} y={cy} w={d} h={d} color={p.accent} round />
              <T x={x} y={cy} w={d} h={d} size={2.0} color={p.onAccent} bold align="center" anchor="middle">{i + 1}</T>
              <T x={x} y={cy + 8} w={w - 1} h={5} size={1.9} color={p.text} bold spacing={1.05}>{items[i].heading}</T>
              <T x={x} y={cy + 13.5} w={w - 1} h={14} size={1.45} color={p.muted}>{items[i].text}</T>
            </div>
          ))}
        </>
      )
    } else if (kind === 'comparison') {
      const columns = (slide.columns ?? []).slice(0, 2)
      inner = cols(2, 3).slice(0, columns.length).map(({ x, w }, i) => {
        const col = columns[i]
        const top = i === 0 ? p.accent : p.text
        const pts = col.points ?? []
        const row = Math.min(5.6, 22 / Math.max(pts.length, 1))
        return (
          <div key={i}>
            <R x={x} y={BODY_Y + 1} w={w} h={31} color={p.surface} radius={1.2} />
            <R x={x} y={BODY_Y + 1} w={w} h={0.6} color={top} />
            <T x={x + 3} y={BODY_Y + 3.6} w={w - 6} h={4} size={2.1} color={i === 0 ? p.accent : p.text} bold>{col.heading}</T>
            {pts.map((pt, j) => {
              const y = BODY_Y + 9.5 + j * row
              return (
                <div key={j}>
                  <R x={x + 3} y={y + 0.75} w={0.7} h={0.7} color={top} />
                  <T x={x + 5.2} y={y} w={w - 8.2} h={row} size={1.55} color={p.text}>{pt}</T>
                </div>
              )
            })}
          </div>
        )
      })
    } else if (kind === 'quote') {
      inner = (
        <>
          <T x={MX} y={BODY_Y - 3} w={12} h={12} size={14} color={p.accent} bold spacing={1.0}>{'“'}</T>
          <T x={MX + 8} y={BODY_Y + 2} w={78} h={22} size={2.9} color={p.text} italic spacing={1.2}>{slide.quote}</T>
          {slide.attribution && <>
            <R x={MX + 8} y={BODY_Y + 26} w={3} h={0.3} color={p.accent} />
            <T x={MX + 12.5} y={BODY_Y + 25.1} w={70} h={3} size={1.45} color={p.muted} bold>{slide.attribution}</T>
          </>}
        </>
      )
    }
    body = (
      <>
        <R x={MX} y={5.6} w={3.2} h={0.45} color={p.accent} />
        {kind !== 'quote' && (
          <T x={MX} y={7.4} w={88} h={8} size={3.3} color={p.text} bold spacing={1.05}>{slide.title}</T>
        )}
        {inner}
        <R x={MX} y={50.6} w={100 - 2 * MX} h={0.12} color={p.rule} />
        <T x={MX} y={51.8} w={70} h={2.5} size={1.15} color={p.muted}>{deckTitle}</T>
        <T x={100 - MX - 10} y={51.8} w={10} h={2.5} size={1.15} color={p.muted} bold align="right">
          {String(number).padStart(2, '0')}
        </T>
      </>
    )
  }

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-lg select-none"
         style={{ containerType: 'inline-size' }}>
      <div className="absolute inset-0"
           style={{ background: isHero ? p.heroBg : p.bg, fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif" }}>
        {body}
      </div>
    </div>
  )
}

// Count of section dividers up to and including slide `i` (for the "01" / "02" labels).
const sectionNumberAt = (slides: SlideData[], i: number) =>
  slides.slice(0, i + 1).filter((s) => s.type === 'section').length

export default function SlidesView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate, registerActions }: Props) {
  const { user } = useAuth()
  const defaultAuthor =
    user?.profile?.full_name?.trim() || (user && !user.is_guest ? user.username : '') || 'Guest'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slides, setSlides] = useState<SlideData[] | null>(null)
  const [deckTitle, setDeckTitle] = useState('presentation')
  const [author, setAuthor] = useState(defaultAuthor)
  const [theme, setTheme] = useState<Theme>({ preset: 'classic', accent: DEFAULT_ACCENT })
  const [downloading, setDownloading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [current, setCurrent] = useState(0)
  const [editing, setEditing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [refineInput, setRefineInput] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch the structured slide deck as JSON and render it inline (no auto-download).
      const response = await api.post(`/tools/slides/${session.session_id}`, {})
      const data = response.data as { slides: SlideData[]; title?: string }
      if (!data.slides?.length) {
        setError('No slides were generated. Please try again.')
        return
      }
      setSlides(data.slides)
      setDeckTitle(data.title || session.documents[0]?.filename.replace(/\.[^.]+$/, '') || 'presentation')
      onActivity?.()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(detail || 'Failed to generate slides. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // AI refine — apply a natural-language instruction to the current deck.
  const refine = async () => {
    const instruction = refineInput.trim()
    if (!instruction || !slides?.length || refining) return
    setRefining(true)
    setError('')
    try {
      const response = await api.post(`/tools/slides/${session.session_id}/refine`, {
        slides,
        instruction,
      })
      const data = response.data as { slides: SlideData[] }
      if (data.slides?.length) {
        setSlides(data.slides)
        setRefineInput('')
      } else {
        setError('Could not apply that change. Please try rephrasing.')
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(detail || 'Failed to update the slides. Please try again.')
    } finally {
      setRefining(false)
    }
  }

  // Download the .pptx built from exactly the deck (+ theme + author) the user sees.
  const download = async () => {
    if (!slides) return
    setDownloading(true)
    setError('')
    try {
      const response = await api.post(
        `/tools/slides/${session.session_id}/download`,
        { slides, title: deckTitle, theme, author },
        { responseType: 'blob' },
      )
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deckTitle}.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      const detail = err.response?.data?.detail
        || (err.response?.data instanceof Blob ? await err.response.data.text() : null)
      setError(detail || 'Failed to download the presentation. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // ── Manual editing helpers (immutable updates on the slides array) ───────────
  const updateSlide = (index: number, patch: Partial<SlideData>) =>
    setSlides((s) => (s ? s.map((sl, i) => (i === index ? { ...sl, ...patch } : sl)) : s))

  const changeLayout = (index: number, to: SlideType) =>
    setSlides((s) => (s ? s.map((sl, i) => (i === index ? convertSlide(sl, to) : sl)) : s))

  const addSlide = () =>
    setSlides((s) => [...(s ?? []), { type: 'content', title: 'New slide', bullets: [''], speaker_note: '' }])

  const removeSlide = (index: number) =>
    setSlides((s) => (s ? s.filter((_, i) => i !== index) : s))

  const moveSlide = (index: number, delta: number) =>
    setSlides((s) => {
      if (!s) return s
      const to = index + delta
      if (to < 0 || to >= s.length) return s
      const next = [...s]
      const [item] = next.splice(index, 1)
      next.splice(to, 0, item)
      return next
    })

  // Register the header actions for this section: Share a readable outline of the deck as
  // text, Export the same outline as a PDF (each slide's title, bullets, and speaker note).
  useEffect(() => {
    if (!slides?.length) { registerActions?.('slides', null); return }
    registerActions?.('slides', {
      share: () => {
        const text = slides
          .map((s, i) => {
            const heading = s.title || `Slide ${i + 1}`
            const lines = slideLines(s)
            const body = lines.length ? '\n' + lines.map((l) => `• ${l}`).join('\n') : ''
            const note = s.speaker_note ? `\nSpeaker note: ${s.speaker_note}` : ''
            return `Slide ${i + 1}: ${heading}${body}${note}`
          })
          .join('\n\n')
        return shareOrCopy(withAttribution(text), `${deckTitle || 'Slide deck'} — Talktofile`)
      },
      exportPdf: () => {
        const body = slides
          .map((s, i) => {
            const heading = escapeHtml(s.title || `Slide ${i + 1}`)
            const lines = slideLines(s)
            const list = lines.length ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''
            const note = s.speaker_note ? `<div class="note">Speaker note: ${escapeHtml(s.speaker_note)}</div>` : ''
            return `<div class="slide"><h3>${i + 1}. ${heading}</h3>${list}${note}</div>`
          })
          .join('')
        printAsPdf({ title: deckTitle || 'Slide Deck', subtitle: session.documents.map((d) => d.filename).join(', '), bodyHtml: body })
      },
    })
    return () => registerActions?.('slides', null)
  }, [slides, deckTitle, registerActions, session])

  // Auto-generate once on entry when this is the section chosen on the Landing page.
  // The ref guard ensures it fires only the first time, never on a later re-render.
  const didAutoGen = useRef(false)
  useEffect(() => {
    if (autoGenerate && !didAutoGen.current) {
      didAutoGen.current = true
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  // Fullscreen keyboard navigation (← → to move, Esc to close).
  const total = slides?.length ?? 0
  const go = useCallback((delta: number) => {
    setCurrent((c) => Math.min(Math.max(c + delta, 0), Math.max(total - 1, 0)))
  }, [total])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, go])

  const openFullscreen = (index: number) => {
    setCurrent(index)
    setFullscreen(true)
  }

  const renderSlide = (i: number) => slides && (
    <SlideCanvas
      slide={slides[i]}
      theme={theme}
      author={author}
      deckTitle={slides.find((s) => s.type === 'title' && s.title)?.title || deckTitle}
      number={i + 1}
      sectionNumber={sectionNumberAt(slides, i)}
    />
  )

  const genLabel = loading ? 'Generating…' : slides ? 'Regenerate slides' : 'Generate slides'

  // Theme + color controls, rendered above the composer input once a deck exists.
  const themePicker = slides?.length ? (
    <div className="px-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Theme
        </span>
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setTheme((t) => ({ ...t, preset: p.key }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                theme.preset === p.key
                  ? 'bg-[#E2611B] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Colour
        <input
          type="color"
          value={theme.accent}
          onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
          className="w-8 h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer p-0.5"
          title="Choose an accent colour"
        />
        {theme.accent.toUpperCase() !== DEFAULT_ACCENT && (
          <button
            onClick={() => setTheme((t) => ({ ...t, accent: DEFAULT_ACCENT }))}
            className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-500"
            title="Reset colour"
          >
            Reset
          </button>
        )}
      </label>
    </div>
  ) : undefined

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — scrolls above the pinned bottom bar */}
      <div className="flex-1 overflow-y-auto p-5">
        {!slides ? (
          // Empty-state hero (before generation)
          <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <Presentation className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Create Slide Deck</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Generate a designed presentation from your document: cover, agenda, key numbers,
                comparisons, process steps and takeaways, with speaker notes. Edit any slide, restyle
                it, and download the editable PowerPoint whenever you like.
              </p>
            </div>

            {error && (
              <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 max-w-sm dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                {error}
              </p>
            )}
          </div>
        ) : editing ? (
          // ── Edit mode: an editable card per slide ──────────────────────────
          <SlideEditor
            slides={slides}
            author={author}
            onAuthorChange={setAuthor}
            updateSlide={updateSlide}
            changeLayout={changeLayout}
            addSlide={addSlide}
            removeSlide={removeSlide}
            moveSlide={moveSlide}
            onDone={() => setEditing(false)}
            error={error}
          />
        ) : (
          // Generated deck — presented like a chat message that produced a slide deck:
          // the gradient "T" (Talktofile) avatar on the left + a left-aligned bubble that
          // shows the first slide (click → all slides fullscreen).
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-2.5"
          >
            {/* Talktofile avatar — identical to the chat's Sage "T" */}
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              T
            </div>

            <div className="min-w-0 flex-1 max-w-md">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md shadow-sm shadow-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200 mb-3.5 leading-relaxed">
                  Here's your slide deck. I put together{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{total} slides</span>{' '}
                  from your document — open it fullscreen, edit any slide, or restyle it below.
                </p>

                {error && (
                  <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 mb-3.5 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                    {error}
                  </p>
                )}

                {refining && (
                  <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-3.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating your slides…
                  </p>
                )}

                {/* First slide only — a compact preview. Stacked layers behind it hint at
                    the rest of the deck; clicking opens the full deck fullscreen. */}
                <div className="relative max-w-xs">
                  {total > 1 && (
                    <>
                      <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700" />
                      <div aria-hidden className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700" />
                    </>
                  )}
                  <button
                    onClick={() => openFullscreen(0)}
                    className="group relative block w-full rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-md hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#E2611B]"
                    title="Open the full slide deck"
                  >
                    {renderSlide(0)}
                    {/* Slide count badge */}
                    <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-medium text-white bg-black/45 backdrop-blur-sm rounded-full pl-2 pr-2.5 py-0.5">
                      <Layers className="w-3 h-3" /> {total}
                    </span>
                    {/* Hover reveal */}
                    <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="mb-4 flex items-center gap-1.5 text-white text-sm font-medium bg-black/45 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
                        <Maximize2 className="w-4 h-4" /> View all {total} slides
                      </span>
                    </span>
                  </button>
                </div>

                {/* Actions — same neutral→orange-on-hover treatment as the "End session"
                    button (slate resting, brand-orange text + soft orange body on hover). */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button
                    onClick={() => openFullscreen(0)}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-brand-600 dark:hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-200 dark:hover:border-brand-500/30 transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" /> View fullscreen
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-brand-600 dark:hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-200 dark:hover:border-brand-500/30 transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit slides
                  </button>
                  <button
                    onClick={download}
                    disabled={downloading}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-brand-600 dark:hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-200 dark:hover:border-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {downloading ? 'Preparing…' : 'Download .pptx'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <SectionExtras show={engagedModes.has('slides')} />
      </div>

      {/* Fullscreen viewer — rendered via a portal to document.body. The workspace is a
          framer-motion `motion.div` (inline transform) with nested `overflow-hidden`,
          which would otherwise TRAP this `fixed` overlay inside that subtree — clipped and
          stacked BELOW the navbar no matter its z-index. Portaling to <body> escapes all of
          that, so z-[60] cleanly beats the navbar (z-50) and the fully opaque bg hides it. */}
      {fullscreen && slides && createPortal(
        <div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-slate-950 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 text-slate-600 dark:text-slate-300">
            <span className="text-sm font-medium">
              Slide {current + 1} <span className="text-slate-400">/ {total}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={download}
                disabled={downloading}
                className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {downloading ? 'Preparing…' : 'Download .pptx'}
                </span>
              </button>
              <button
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>
          </div>

          {/* Stage */}
          <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-6 min-h-0">
            <button
              onClick={() => go(-1)}
              disabled={current === 0}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="w-full max-w-5xl">
              <div className="shadow-2xl rounded-lg overflow-hidden">
                {renderSlide(current)}
              </div>
              {slides[current].speaker_note && (
                <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
                  <span className="text-slate-400 dark:text-slate-500">Speaker note: </span>
                  {slides[current].speaker_note}
                </p>
              )}
            </div>

            <button
              onClick={() => go(1)}
              disabled={current === total - 1}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-3 [scrollbar-width:thin]">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-24 flex-shrink-0 rounded overflow-hidden ring-2 transition-all ${
                  i === current ? 'ring-[#E2611B]' : 'ring-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {renderSlide(i)}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}

      {/* Bottom bar — the shared composer. The input is wired to AI-refine (describe a
          change and press Enter / the button); the theme + colour picker sits above it. */}
      <SectionComposer
        active="slides"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder={slides?.length ? 'Ask AI to change the slides, e.g. “add a slide on pricing”.' : 'Add your preferences here.'}
        pickerRow={themePicker}
        value={slides?.length ? refineInput : undefined}
        onChange={slides?.length ? setRefineInput : undefined}
        onSubmit={slides?.length ? () => { refine() } : undefined}
        disabled={refining}
        proceedButton={
          slides?.length ? (
            <button
              onClick={refine}
              disabled={refining || !refineInput.trim()}
              aria-label="Update slides"
              className="flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="hidden sm:inline">{refining ? 'Updating…' : 'Update slides'}</span>
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={loading}
              aria-label={genLabel}
              className="flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
              <span className="hidden sm:inline">{genLabel}</span>
            </button>
          )
        }
      />
    </div>
  )
}

// ── Manual slide editor ────────────────────────────────────────────────────────
interface EditorProps {
  slides: SlideData[]
  author: string
  onAuthorChange: (v: string) => void
  updateSlide: (i: number, patch: Partial<SlideData>) => void
  changeLayout: (i: number, to: SlideType) => void
  addSlide: () => void
  removeSlide: (i: number) => void
  moveSlide: (i: number, delta: number) => void
  onDone: () => void
  error: string
}

const inputCls =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'

const iconBtn = 'p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0'
const addBtn = 'flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-500'

// An editable list of plain strings (bullets, agenda items, comparison points).
function StringList({ values, onChange, placeholder, addLabel }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[#E2611B] font-bold">•</span>
          <input value={v} placeholder={placeholder} className={inputCls}
                 onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} className={iconBtn} title="Remove">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...values, ''])} className={addBtn}>
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  )
}

// An editable list of {heading, text} items (stats, process steps, cards).
function ItemList({ items, onChange, headingPlaceholder, textPlaceholder, addLabel, max }: {
  items: SlideItem[]; onChange: (v: SlideItem[]) => void
  headingPlaceholder: string; textPlaceholder: string; addLabel: string; max: number
}) {
  const set = (i: number, patch: Partial<SlideItem>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 w-5 text-center text-xs font-bold text-[#E2611B]">{i + 1}</span>
          <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <input value={it.heading} placeholder={headingPlaceholder} className={inputCls}
                   onChange={(e) => set(i, { heading: e.target.value })} />
            <input value={it.text} placeholder={textPlaceholder} className={inputCls}
                   onChange={(e) => set(i, { text: e.target.value })} />
          </div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className={`${iconBtn} mt-1`} title="Remove">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button onClick={() => onChange([...items, { heading: '', text: '' }])} className={addBtn}>
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      )}
    </div>
  )
}

function SlideEditor({
  slides, author, onAuthorChange, updateSlide, changeLayout,
  addSlide, removeSlide, moveSlide, onDone, error,
}: EditorProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-brand font-bold text-lg text-slate-900 dark:text-slate-100">Edit slides</h2>
        <button
          onClick={onDone}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-[#E2611B] text-white hover:bg-[#E2611B]/90 transition-colors"
        >
          <Check className="w-4 h-4" /> Done
        </button>
      </div>

      {error && (
        <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
          {error}
        </p>
      )}

      {slides.map((slide, si) => {
        const kind: SlideType = slide.type ?? 'content'
        const columns = slide.columns?.length === 2 ? slide.columns : convertSlide(slide, 'comparison').columns!
        return (
          <div key={si} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex-shrink-0">
                  Slide {si + 1}
                </span>
                <select
                  value={kind}
                  onChange={(e) => changeLayout(si, e.target.value as SlideType)}
                  className="min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-brand-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  title="Slide layout"
                >
                  {LAYOUTS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => moveSlide(si, -1)} disabled={si === 0}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveSlide(si, 1)} disabled={si === slides.length - 1}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => removeSlide(si)} disabled={slides.length <= 1}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed" title="Delete slide">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {kind === 'quote' ? (
              <>
                <textarea value={slide.quote ?? ''} rows={3} placeholder="Quote" className={`${inputCls} resize-none`}
                          onChange={(e) => updateSlide(si, { quote: e.target.value })} />
                <input value={slide.attribution ?? ''} placeholder="Attribution / source" className={inputCls}
                       onChange={(e) => updateSlide(si, { attribution: e.target.value })} />
              </>
            ) : (
              <input value={slide.title ?? ''} placeholder="Slide title" className={inputCls}
                     onChange={(e) => updateSlide(si, { title: e.target.value })} />
            )}

            {(kind === 'title' || kind === 'section' || kind === 'closing') && (
              <input value={slide.subtitle ?? ''} placeholder="Subtitle" className={inputCls}
                     onChange={(e) => updateSlide(si, { subtitle: e.target.value })} />
            )}
            {kind === 'title' && (
              <>
                <input value={author} placeholder="Created by…" className={inputCls}
                       onChange={(e) => onAuthorChange(e.target.value)} />
                <p className="text-xs text-slate-400 dark:text-slate-500">Shown as “Created by …” on the cover.</p>
              </>
            )}

            {(kind === 'content' || kind === 'agenda') && (
              <StringList values={slide.bullets ?? []} onChange={(bullets) => updateSlide(si, { bullets })}
                          placeholder={kind === 'agenda' ? 'Agenda item' : 'Bullet point'}
                          addLabel={kind === 'agenda' ? 'Add item' : 'Add bullet'} />
            )}

            {(kind === 'stats' || kind === 'process' || kind === 'cards') && (
              <ItemList
                items={slide.items ?? []}
                onChange={(items) => updateSlide(si, { items })}
                headingPlaceholder={kind === 'stats' ? 'Figure, e.g. 42%' : kind === 'process' ? 'Step name' : 'Card heading'}
                textPlaceholder={kind === 'stats' ? 'What it means' : 'Description'}
                addLabel={kind === 'stats' ? 'Add figure' : kind === 'process' ? 'Add step' : 'Add card'}
                max={kind === 'process' ? 5 : 4}
              />
            )}

            {kind === 'comparison' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {columns.map((col, ci) => {
                  const setCol = (patch: Partial<SlideColumn>) =>
                    updateSlide(si, { columns: columns.map((c, j) => (j === ci ? { ...c, ...patch } : c)) })
                  return (
                    <div key={ci} className="space-y-2 min-w-0">
                      <input value={col.heading} placeholder={`Column ${ci + 1} heading`} className={`${inputCls} font-semibold`}
                             onChange={(e) => setCol({ heading: e.target.value })} />
                      <StringList values={col.points} onChange={(points) => setCol({ points })}
                                  placeholder="Point" addLabel="Add point" />
                    </div>
                  )
                })}
              </div>
            )}

            <textarea
              value={slide.speaker_note ?? ''}
              onChange={(e) => updateSlide(si, { speaker_note: e.target.value })}
              placeholder="Speaker note (optional)"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        )
      })}

      <button
        onClick={addSlide}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-500 hover:border-brand-300 dark:hover:border-brand-500/50 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add slide
      </button>
    </div>
  )
}
