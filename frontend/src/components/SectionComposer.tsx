import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { Sparkles, SlidersHorizontal } from 'lucide-react'
import MicButton from './MicButton'
import Tooltip from './Tooltip'
import ModeSwitcher from './ModeSwitcher'
import type { AppMode } from '../types'

const DEFAULT_PLACEHOLDER = 'Ask anything about the document or add your preferences here. Shift+Enter for a new line.'

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

  placeholder?: string

  // --- Optional controlled input (used by chat). When these are omitted the composer
  //     owns its own input state and pressing Enter shows a "Coming soon" bubble — the
  //     tool sections, where chatting from a tool view isn't wired to the backend yet
  //     (TODO(coming-soon), see CLAUDE.md). ---
  value?: string
  onChange?: (v: string) => void
  onSubmit?: () => void
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
  proceedButton, pickerRow,
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

  // Auto-grow the textarea like the chat input does — identical everywhere.
  useEffect(() => {
    const t = taRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
  }, [text, taRef])

  useEffect(() => () => { if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current) }, [])

  // TODO(coming-soon): tool sections can't send yet — Enter shows a "Coming soon"
  // bubble. When cross-section chatting is wired up, pass `onSubmit` and this branch
  // is never hit (see CLAUDE.md).
  const flashComingSoon = () => {
    if (!text.trim()) return
    setShowComingSoon(true)
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current)
    comingSoonTimer.current = setTimeout(() => setShowComingSoon(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (onSubmit) onSubmit()
      else flashComingSoon()
    }
  }

  // Append a dictated chunk to whatever is already typed, spacing it sensibly.
  const appendTranscript = useCallback((chunk: string) => {
    if (controlled) onChange?.(value!.trim() ? `${value!.trim()} ${chunk}` : chunk)
    else setInternal((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk))
  }, [controlled, value, onChange])

  return (
    <div className="flex-shrink-0">
      {/* Follow-up suggestions — mirrors the chat's box, but for the tool sections.
          Appears only once this section has been used at least once (it's in `engaged`),
          e.g. after the summary has been generated. Intentionally blank for now (no
          suggestion buttons yet) — just the labelled header as a placeholder. Chat is
          excluded here because it renders its own populated follow-ups in ChatWindow. */}
      {active !== 'chat' && engaged.has(active) && (
        <div className="px-4 pb-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          {/* "Coming soon" tooltip (to the right) — the box is a placeholder for now. */}
          <Tooltip label="Coming soon" side="right" className="pt-3">
            <span className="flex items-center gap-1.5 cursor-default">
              <Sparkles className="w-3 h-3 text-brand-500" />
              <span className="text-xs text-slate-400 dark:text-slate-500">Follow-up suggestions</span>
            </span>
          </Tooltip>
        </div>
      )}

      {/* Preferences — a sibling of the follow-up box, directly below it and above the
          input. Same gate (non-chat sections, once used at least once) and same blank
          placeholder + "Coming soon" tooltip. Eventually each preference the user enters
          will render as its own box (like a follow-up suggestion); blank for now. */}
      {active !== 'chat' && engaged.has(active) && (
        <div className="px-4 pb-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <Tooltip label="Coming soon" side="right" className="pt-3">
            <span className="flex items-center gap-1.5 cursor-default">
              <SlidersHorizontal className="w-3 h-3 text-brand-500" />
              <span className="text-xs text-slate-400 dark:text-slate-500">Preferences</span>
            </span>
          </Tooltip>
        </div>
      )}

      {/* Optional per-section controls row (chart-type / language picker) */}
      {pickerRow}

      {/* Input row + feature tabs — identical across every section */}
      <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-800 pt-3 bg-white dark:bg-slate-900 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
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
