import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles } from 'lucide-react'
import MicButton from './MicButton'
import ModeSwitcher from './ModeSwitcher'
import type { AppMode } from '../types'

interface Props {
  active: AppMode
  onSwitch: (mode: AppMode) => void
  engaged: Set<AppMode>
}

// Composer shown at the bottom of every non-chat section (Summary, Flashcards, Slides,
// Translate, Podcast, Charts) so those sections look and feel exactly like the Chat
// section. It is a separate copy that never touches ChatWindow. The textarea, mic
// (voice dictation), and send button are all live — the ONE difference from chat is you
// can't actually send: pressing send/Enter shows a "Coming soon" bubble. The follow-up
// suggestions list is intentionally empty for now. The feature tabs (ModeSwitcher) below
// are functional.
//
// TODO(coming-soon): when chatting from non-chat sections is implemented, wire
// `handleSend` to the real chat pipeline and REMOVE the "Coming soon" bubble (and this
// note — see CLAUDE.md).
export default function WorkspaceComposer({ active, onSwitch, engaged }: Props) {
  const [input, setInput] = useState('')
  const [showComingSoon, setShowComingSoon] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-grow the textarea like the chat input does.
  useEffect(() => {
    const t = inputRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 140) + 'px'
  }, [input])

  useEffect(() => () => { if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current) }, [])

  const handleSend = () => {
    if (!input.trim()) return
    setShowComingSoon(true)
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current)
    comingSoonTimer.current = setTimeout(() => setShowComingSoon(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Append a dictated chunk to whatever is already typed, spacing it sensibly
  // (same behaviour as ChatWindow's mic).
  const appendTranscript = useCallback((text: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
  }, [])

  return (
    <div className="flex-shrink-0">
      {/* Follow-up suggestions — blank for now (structure matches ChatWindow) */}
      <div className="px-4 pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 mb-2 pt-3">
          <Sparkles className="w-3 h-3 text-brand-500" />
          <span className="text-xs text-slate-400 dark:text-slate-500">Follow-up suggestions</span>
        </div>
      </div>

      {/* Input + feature tabs — mirrors ChatWindow's input block */}
      <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-800 pt-3 bg-white dark:bg-slate-900 rounded-b-2xl">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the document. Shift+Enter for a new line."
              rows={1}
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-4 sm:pr-16 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none transition-all leading-relaxed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
            <span className="hidden sm:block absolute right-3 bottom-2.5 text-xs text-slate-300 dark:text-slate-600 pointer-events-none">
              ↵ send
            </span>
          </div>
          {/* Voice dictation — same live mic as the chat input */}
          <MicButton onTranscript={appendTranscript} size={11} side="top" />
          {/* Send — lights up when there's text; shows "Coming soon" on click for now */}
          <div className="relative flex-shrink-0">
            {showComingSoon && (
              <div className="absolute bottom-full right-0 mb-2 z-10 whitespace-nowrap rounded-lg bg-[#303030] text-white text-xs px-2.5 py-1.5 shadow-lg">
                Coming soon
                <span className="absolute top-full right-3.5 -mt-1 w-2 h-2 rotate-45 bg-[#303030]" />
              </div>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-brand-700"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Feature tabs — switch sections like browser tabs (stays functional). */}
        <ModeSwitcher active={active} onSwitch={onSwitch} engaged={engaged} className="mt-3" />
      </div>
    </div>
  )
}
