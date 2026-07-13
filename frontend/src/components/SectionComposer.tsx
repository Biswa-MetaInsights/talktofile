import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import MicButton from './MicButton'
import ModeSwitcher from './ModeSwitcher'
import type { AppMode } from '../types'

const DEFAULT_PLACEHOLDER = 'Ask anything about the document or add your preferences here. Shift+Enter for a new line.'
// On small screens the full placeholder wraps to two lines and inflates the empty
// textarea's height, so the tool sections use this short, non-wrapping placeholder below `sm`.
const SHORT_PLACEHOLDER = 'Type here.'

interface Props {
  // Feature-tab row rendered under the input (Chat / Summary / … / Charts).
  active: AppMode
  onSwitch: (mode: AppMode) => void
  engaged: Set<AppMode>

  // The right-hand action button — the ONE thing that differs between sections
  // besides width/placeholder. Chat passes its send/stop button; each tool section
  // passes its "Generate …" (or "Translate …") button. The chatbox width is just a
  // consequence of how wide this button is.
  proceedButton: ReactNode
  // Optional controls row rendered directly above the input row (e.g. the Charts
  // chart-type picker or the Translate language picker). Pass the fully-styled block;
  // it is placed where the "Follow-up suggestions" row would sit.
  pickerRow?: ReactNode
  // Optional warning line rendered just above the input row (e.g. "this file type doesn't
  // support charts"). Shown/hidden by the section (e.g. on hover/press of a blurred button).
  notice?: string

  placeholder?: string

  // --- Optional controlled input (used by chat). When these are omitted the composer
  //     owns its own input state and pressing Enter shows a "Coming soon" bubble — the
  //     tool sections, where chatting from a tool view isn't wired to the backend yet
  //     (TODO(coming-soon), see CLAUDE.md). ---
  value?: string
  onChange?: (v: string) => void
  // Return `false` to signal "I didn't handle this" — the composer then shows its
  // "Coming soon" bubble (e.g. Podcast handles "continue" but nothing else yet).
  onSubmit?: () => void | boolean
  disabled?: boolean
  showEnterHint?: boolean
  inputRef?: React.RefObject<HTMLTextAreaElement>
}

// Shared bottom composer used by EVERY section (chat + the six tool views), so the
// input row is pixel-identical everywhere. The only intended differences are the
// proceed button (text + behaviour), the chatbox width (a consequence of the button
// width) and the placeholder. See CLAUDE.md.
export default function SectionComposer({
  active, onSwitch, engaged,
  proceedButton, pickerRow, notice,
  placeholder = DEFAULT_PLACEHOLDER,
  value, onChange, onSubmit, disabled = false, showEnterHint = false, inputRef,
}: Props) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState('')
  const text = controlled ? value! : internal

  const [showComingSoon, setShowComingSoon] = useState(false)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const taRef = inputRef ?? localRef
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setText = (v: string) => (controlled ? onChange?.(v) : setInternal(v))

  // On narrow screens use the short placeholder (all sections) so it can't wrap.
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChangeMq = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', onChangeMq)
    return () => mq.removeEventListener('change', onChangeMq)
  }, [])
  // Chat keeps its own (already short) placeholder at every width — "Ask anything here.".
  // Only the tool sections fall back to the short placeholder on narrow screens.
  const shownPlaceholder = isNarrow && active !== 'chat' ? SHORT_PLACEHOLDER : placeholder

  // Auto-grow the textarea like the chat input does — identical everywhere. When the
  // field is empty, force a single line: an empty textarea's scrollHeight can include a
  // wrapped placeholder on narrow screens, which would otherwise pin the box to 2 lines.
  useEffect(() => {
    const t = taRef.current
    if (!t) return
    if (!text.trim()) { t.style.height = '44px'; return }
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
  }, [text, taRef])

  useEffect(() => () => { if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current) }, [])

  // TODO(coming-soon): most tool sections can't send yet — Enter shows a "Coming soon"
  // bubble. A section can pass `onSubmit` to handle some messages (Podcast handles
  // "continue") and return `false` for the rest to fall back to this bubble.
  const flashComingSoon = () => {
    if (!text.trim()) return
    setShowComingSoon(true)
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current)
    comingSoonTimer.current = setTimeout(() => setShowComingSoon(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (onSubmit) {
        // A `false` return means "not handled" → fall back to the Coming soon bubble.
        if (onSubmit() === false) flashComingSoon()
      } else {
        flashComingSoon()
      }
    }
  }

  // Append a dictated chunk to whatever is already typed, spacing it sensibly.
  const appendTranscript = useCallback((chunk: string) => {
    if (controlled) onChange?.(value!.trim() ? `${value!.trim()} ${chunk}` : chunk)
    else setInternal((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk))
  }, [controlled, value, onChange])

  return (
    <div className="flex-shrink-0">
      {/* The "Follow-up suggestions" + "Preferences" placeholder rows used to live here
          (pinned above the input). They now render at the END of each tool section's
          scrollable content instead (see SectionExtras), so they scroll with the section
          rather than being stuck to the chatbox. */}

      {/* Optional per-section controls row (chart-type / language picker) */}
      {pickerRow}

      {/* Input row + feature tabs — identical across every section */}
      <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-800 pt-3 bg-white dark:bg-slate-900 rounded-b-2xl">
        {/* Optional warning line just above the chatbox (e.g. unsupported file type). */}
        {notice && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={shownPlaceholder}
              rows={1}
              disabled={disabled}
              // Scrollbar hidden ([scrollbar-width:none] + ::-webkit-scrollbar) — the
              // textarea auto-grows to fit content (up to maxHeight), so the bar is just
              // visual noise on the right edge.
              className={`w-full bg-white border border-slate-200 rounded-xl py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none transition-all disabled:opacity-50 leading-normal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 ${showEnterHint ? 'pl-4 pr-4 sm:pr-16' : 'px-4'}`}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            {/* Chat-only "↵ send" hint (chatting from tool sections isn't wired yet). */}
            {showEnterHint && (
              <span className="hidden sm:block absolute right-3 bottom-2.5 text-xs text-slate-300 dark:text-slate-600 pointer-events-none">
                ↵ send
              </span>
            )}
            {/* "Coming soon" bubble — sending from a tool section isn't wired yet. */}
            {showComingSoon && (
              <div className="absolute bottom-full left-0 mb-2 z-10 whitespace-nowrap rounded-lg bg-[#303030] text-white text-xs px-2.5 py-1.5 shadow-lg">
                Coming soon
                <span className="absolute top-full left-3.5 -mt-1 w-2 h-2 rotate-45 bg-[#303030]" />
              </div>
            )}
          </div>
          {/* Voice dictation — the same live mic in every section */}
          <MicButton onTranscript={appendTranscript} disabled={disabled} size={11} side="top" />
          {/* Proceed — the only per-section button (send/stop for chat, generate for tools) */}
          {proceedButton}
        </div>
        {/* Feature tabs — switch sections like browser tabs. */}
        <ModeSwitcher active={active} onSwitch={onSwitch} engaged={engaged} className="mt-3" />
      </div>
    </div>
  )
}
