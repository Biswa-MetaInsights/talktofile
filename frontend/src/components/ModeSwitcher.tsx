import Tooltip from './Tooltip'
import type { AppMode } from '../types'

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
  { value: 'podcast', label: 'Podcasts' },
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
  // section that is engaged but not currently open gets a star + "pick up where you
  // left off" tooltip, reminding the user their work is still there to return to.
  engaged?: Set<AppMode>
  className?: string
}

export default function ModeSwitcher({ active, onSwitch, engaged, className = '' }: Props) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      {SWITCH_MODES.map(({ value, label }) => {
        const isActive = value === active
        // Only remind about sections the user has left — no star on the tab they're on.
        const showStar = !!engaged?.has(value) && !isActive
        const button = (
          <button
            type="button"
            onClick={() => onSwitch(value)}
            aria-pressed={isActive}
            className={`relative text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
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
            {label}
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
          <Tooltip key={value} label="Click to pick up where you left off" side="top">
            {button}
          </Tooltip>
        ) : (
          <span key={value} className="inline-flex">{button}</span>
        )
      })}
    </div>
  )
}
