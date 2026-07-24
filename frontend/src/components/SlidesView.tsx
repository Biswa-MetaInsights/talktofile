import { useState, useEffect, useRef, useCallback } from 'react'
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

// One slide's structured content (as produced by the backend slide agent).
interface SlideData {
  type?: 'title' | 'content'
  title?: string
  subtitle?: string
  bullets?: string[]
  speaker_note?: string
}

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

// ── A single rendered slide (HTML preview mirroring the .pptx styling) ────────
// Uses container-query units (cqw) so the same markup scales cleanly from a small
// thumbnail up to the fullscreen view — font sizes track the slide's own width.
// Keep the three presets in sync with backend/agents/slide_agent.py.
function SlideCanvas({ slide, theme, author }: { slide: SlideData; theme: Theme; author?: string }) {
  const isTitle = slide.type === 'title'
  const accent = theme.accent

  if (isTitle) {
    // Per-preset title slide styling.
    let bg = accent
    let titleColor = '#ffffff'
    let subColor = 'rgba(255,255,255,0.85)'
    let metaColor = 'rgba(255,255,255,0.85)'
    let leftBar: string | null = null
    let underline = false
    if (theme.preset === 'minimal') {
      bg = '#ffffff'; titleColor = '#303030'; subColor = '#6b7280'; metaColor = accent; underline = true
    } else if (theme.preset === 'bold') {
      bg = '#1a1a1a'; titleColor = accent; subColor = '#ffffff'; metaColor = accent; leftBar = accent
    }
    return (
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-lg select-none"
           style={{ containerType: 'inline-size' }}>
        <div className="absolute inset-0 flex flex-col justify-center" style={{ background: bg, padding: '8cqw' }}>
          {leftBar && <div className="absolute top-0 left-0 bottom-0" style={{ width: '2.5cqw', background: leftBar }} />}
          <h3 className="font-brand font-bold leading-tight" style={{ fontSize: '7cqw', color: titleColor }}>
            {slide.title || 'Untitled'}
          </h3>
          {underline && <div style={{ width: '22cqw', height: '0.7cqw', background: accent, marginTop: '2.5cqw' }} />}
          {slide.subtitle && (
            <p style={{ fontSize: '3.4cqw', marginTop: '2.5cqw', color: subColor }}>{slide.subtitle}</p>
          )}
          {author && (
            <p style={{ fontSize: '2.4cqw', marginTop: '2.2cqw', color: metaColor }}>Created by {author}</p>
          )}
        </div>
      </div>
    )
  }

  // Content slide — per preset.
  let bg = '#ffffff'
  let topBar = false
  let leftRule = false
  let titleUnderline = false
  let marker = '•'
  if (theme.preset === 'minimal') { leftRule = true; marker = '—' }
  else if (theme.preset === 'bold') { bg = '#f3f4f6'; titleUnderline = true }
  else { topBar = true }

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-lg select-none"
         style={{ containerType: 'inline-size' }}>
      <div className="absolute inset-0" style={{ background: bg, padding: '5cqw' }}>
        {topBar && <div className="absolute top-0 left-0 right-0" style={{ height: '1cqw', background: accent }} />}
        <div className="flex items-start" style={{ gap: '2cqw' }}>
          {leftRule && <div style={{ width: '0.7cqw', minHeight: '5cqw', background: accent, marginTop: '0.6cqw' }} />}
          <div style={{ marginBottom: '3.5cqw' }}>
            <h3 className="font-brand font-bold text-[#303030] leading-snug" style={{ fontSize: '4.6cqw' }}>
              {slide.title || ''}
            </h3>
            {titleUnderline && <div style={{ width: '16cqw', height: '0.6cqw', background: accent, marginTop: '1.2cqw' }} />}
          </div>
        </div>
        <ul className="space-y-[2cqw]">
          {(slide.bullets ?? []).map((b, i) => (
            <li key={i} className="flex text-[#303030] leading-snug" style={{ fontSize: '2.9cqw' }}>
              <span style={{ color: accent, marginRight: '1.8cqw', fontWeight: 700 }}>{marker}</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

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

  const updateBullet = (si: number, bi: number, value: string) =>
    setSlides((s) => (s ? s.map((sl, i) => {
      if (i !== si) return sl
      const bullets = [...(sl.bullets ?? [])]
      bullets[bi] = value
      return { ...sl, bullets }
    }) : s))

  const addBullet = (si: number) =>
    setSlides((s) => (s ? s.map((sl, i) => (i === si ? { ...sl, bullets: [...(sl.bullets ?? []), ''] } : sl)) : s))

  const removeBullet = (si: number, bi: number) =>
    setSlides((s) => (s ? s.map((sl, i) => (i === si ? { ...sl, bullets: (sl.bullets ?? []).filter((_, j) => j !== bi) } : sl)) : s))

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
            const subtitle = s.subtitle ? `\n${s.subtitle}` : ''
            const bullets = s.bullets?.length ? '\n' + s.bullets.map((b) => `• ${b}`).join('\n') : ''
            const note = s.speaker_note ? `\nSpeaker note: ${s.speaker_note}` : ''
            return `Slide ${i + 1}: ${heading}${subtitle}${bullets}${note}`
          })
          .join('\n\n')
        return shareOrCopy(withAttribution(text), `${deckTitle || 'Slide deck'} — Talktofile`)
      },
      exportPdf: () => {
        const body = slides
          .map((s, i) => {
            const heading = escapeHtml(s.title || `Slide ${i + 1}`)
            const subtitle = s.subtitle ? `<p>${escapeHtml(s.subtitle)}</p>` : ''
            const bullets = s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''
            const note = s.speaker_note ? `<div class="note">Speaker note: ${escapeHtml(s.speaker_note)}</div>` : ''
            return `<div class="slide"><h3>${i + 1}. ${heading}</h3>${subtitle}${bullets}${note}</div>`
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
                Generate a presentation from your document with a title slide, content slides for each
                key section, and speaker notes. Edit any slide, restyle it, and download the editable
                PowerPoint whenever you like.
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
            updateBullet={updateBullet}
            addBullet={addBullet}
            removeBullet={removeBullet}
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
                    <SlideCanvas slide={slides[0]} theme={theme} author={author} />
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
                <SlideCanvas slide={slides[current]} theme={theme} author={author} />
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
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-24 flex-shrink-0 rounded overflow-hidden ring-2 transition-all ${
                  i === current ? 'ring-[#E2611B]' : 'ring-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <SlideCanvas slide={s} theme={theme} author={author} />
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
  updateBullet: (si: number, bi: number, v: string) => void
  addBullet: (si: number) => void
  removeBullet: (si: number, bi: number) => void
  addSlide: () => void
  removeSlide: (i: number) => void
  moveSlide: (i: number, delta: number) => void
  onDone: () => void
  error: string
}

const inputCls =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'

function SlideEditor({
  slides, author, onAuthorChange, updateSlide, updateBullet, addBullet, removeBullet,
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
        const isTitle = slide.type === 'title'
        return (
          <div key={si} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isTitle ? 'Cover' : `Slide ${si + 1}`}
              </span>
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

            <input
              value={slide.title ?? ''}
              onChange={(e) => updateSlide(si, { title: e.target.value })}
              placeholder="Slide title"
              className={inputCls}
            />

            {isTitle ? (
              <>
                <input
                  value={slide.subtitle ?? ''}
                  onChange={(e) => updateSlide(si, { subtitle: e.target.value })}
                  placeholder="Subtitle"
                  className={inputCls}
                />
                <input
                  value={author}
                  onChange={(e) => onAuthorChange(e.target.value)}
                  placeholder="Created by…"
                  className={inputCls}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500">Shown as “Created by …” on the cover.</p>
              </>
            ) : (
              <div className="space-y-2">
                {(slide.bullets ?? []).map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="text-[#E2611B] font-bold">•</span>
                    <input
                      value={b}
                      onChange={(e) => updateBullet(si, bi, e.target.value)}
                      placeholder="Bullet point"
                      className={inputCls}
                    />
                    <button onClick={() => removeBullet(si, bi)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove bullet">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addBullet(si)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-500">
                  <Plus className="w-3.5 h-3.5" /> Add bullet
                </button>
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
