import { useState, useRef, useEffect } from 'react'
import { MessageSquare, FileText, Layers, Presentation, Languages, Mic, BarChart3, ChevronDown, type LucideIcon } from 'lucide-react'
import Tooltip from './Tooltip'
import type { AppMode } from '../types'

// Small icon per feature — the single source of truth, reused by the Landing hero
// tabs too (QuillBot-style icon + label). Keyed by AppMode.
export const MODE_ICONS: Record<AppMode, LucideIcon> = {
  chat: MessageSquare,
  summary: FileText,
  flashcards: Layers,
  slides: Presentation,
  translate: Languages,
  podcast: Mic,
  charts: BarChart3,
}

// The single source of truth for the feature tabs shown across the workspace
// (Chat / Summary / Flashcards / Slides / Translate / Podcasts / Charts). Rendered
// at the bottom of the chat and every tool view so the user can switch sections like
// browser tabs. Selecting a tab opens that section exactly as picking it on the
// Landing page does — no upload step, same live session.
export const SWITCH_MODES: { value: AppMode; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'summary', label: 'Summary' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'slides', label: 'Slides' },
  { value: 'translate', label: 'Translate' },
  { value: 'podcast', label: 'Podcast scripts' },
  { value: 'charts', label: 'Charts' },
]

// Display label for a mode — used for the header title (the row under the navbar now
// reads the active section name instead of the filename).
export const MODE_LABELS = SWITCH_MODES.reduce(
  (acc, m) => ({ ...acc, [m.value]: m.label }),
  {} as Record<AppMode, string>
)

interface Props {
  active: AppMode
  onSwitch: (mode: AppMode) => void
  // Sections the user has produced content in (chatted, generated flashcards, …). A
  // section that is engaged but not currently open is marked orange — a brand-orange
  // border on the tab (`sm`+), an orange row + dot in the mobile dropdown — plus a
  // "pick up where you left off" tooltip, so their work is visibly still there.
  engaged?: Set<AppMode>
  className?: string
}

export default function ModeSwitcher({ active, onSwitch, engaged, className = '' }: Props) {
  // Mobile only: the 7 tabs wrap to 3 rows on a phone and eat the section's vertical
  // space, so below `sm` they collapse into this dropdown instead. The `sm`+ tab row
  // below is unchanged — the two are swapped with CSS (`sm:hidden` / `hidden sm:flex`),
  // not a JS breakpoint, so there's no first-paint flash.
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const ActiveIcon = MODE_ICONS[active]
  // The tab row marks engaged-but-not-active sections with an orange border; collapsed
  // into a dropdown that cue would vanish, so the closed trigger carries an orange dot
  // when there's work waiting in a section the user can't currently see.
  const hasEngagedElsewhere = SWITCH_MODES.some(({ value }) => value !== active && engaged?.has(value))

  return (
    <>
      {/* --- Below sm: one dropdown --- */}
      <div ref={dropdownRef} className={`relative sm:hidden ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Switch section"
          className="w-full inline-flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-600/40"
        >
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <ActiveIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span className="truncate">{MODE_LABELS[active]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 flex-shrink-0">
            {hasEngagedElsewhere && (
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#E2611B]" />
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </button>

        {/* Opens UPWARD (`bottom-full`) — the composer sits at the bottom of the
            viewport, so a downward menu would open off-screen. */}
        {open && (
          <div
            role="menu"
            className="absolute bottom-full left-0 right-0 mb-2 z-20 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            {SWITCH_MODES.map(({ value, label }) => {
              const isActive = value === active
              const isEngaged = !!engaged?.has(value) && !isActive
              const Icon = MODE_ICONS[value]
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitem"
                  onClick={() => { onSwitch(value); setOpen(false) }}
                  className={`w-full inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-left transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : isEngaged
                        ? 'text-[#E2611B] hover:bg-[#E2611B]/10'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{label}</span>
                  {isEngaged && (
                    <span
                      aria-hidden
                      title="Pick up where you left off"
                      className="w-1.5 h-1.5 rounded-full bg-[#E2611B] flex-shrink-0"
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* --- sm and up: the full tab row --- */}
      <div className={`hidden sm:flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      {SWITCH_MODES.map(({ value, label }) => {
        const isActive = value === active
        const Icon = MODE_ICONS[value]
        // Only remind about sections the user has left — no star on the tab they're on.
        const showStar = !!engaged?.has(value) && !isActive
        const button = (
          <button
            type="button"
            onClick={() => onSwitch(value)}
            aria-pressed={isActive}
            className={`relative inline-flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 font-medium rounded-full border transition-colors ${
              isActive
                ? 'bg-brand-600 text-white border-brand-600'
                : `bg-white hover:border-brand-300 hover:text-brand-600 dark:bg-slate-800 dark:hover:border-brand-600/40 dark:hover:text-brand-300 ${
                    // Engaged-but-not-active tab: mark it with a brand-orange border
                    // and orange text (replaces the old `*` badge — see commented-out
                    // span below).
                    showStar
                      ? 'border-[#E2611B] text-[#E2611B] dark:border-[#E2611B] dark:text-[#E2611B]'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            <span>{label}</span>
            {/* Old engaged indicator: a brand-orange `*` badge outside the button's
               top-right corner. Replaced by the orange border above. Kept commented
               in case we revert. */}
            {/* {showStar && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 text-[#E2611B] text-base font-bold leading-none"
              >
                *
              </span>
            )} */}
          </button>
        )
        return showStar ? (
          <Tooltip key={value} label="Click to pick up where you left off" side="top" className="flex-shrink-0">
            {button}
          </Tooltip>
        ) : (
          <span key={value} className="inline-flex flex-shrink-0">{button}</span>
        )
      })}
      </div>
    </>
  )
}
