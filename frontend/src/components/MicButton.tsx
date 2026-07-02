import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Loader2 } from 'lucide-react'
import Tooltip from './Tooltip'
// ACTIVE engine: OpenAI Whisper (records audio, transcribes server-side via the
// backend /tools/transcribe route) — works in every browser, including Brave. The
// free Web Speech API alternative lives in `useWebSpeech.ts` (no backend/no cost,
// but dead in Brave/Firefox) — swap the import below to re-enable it. Both hooks
// share the same return shape, so this is the only frontend change needed.
import { useVoiceDictation } from '../hooks/useVoiceDictation'

// Voice-dictation button for chat inputs. Idle: a neutral slate mic with a tooltip.
// Recording: brand orange with a soft pulse. After you stop, a spinner shows while
// Whisper transcribes; the resulting text is pushed to `onTranscript` for the caller
// to append to its input. Any failure shows as a red bubble above the button (and
// auto-dismisses), so problems are visible instead of silent.
//
// Records audio + transcribes server-side via Whisper (see useVoiceDictation) — works
// in every browser with a mic, including Brave. Renders nothing where unsupported.

interface Props {
  /** Receives the transcribed text to append to the input. */
  onTranscript: (text: string) => void
  /** Disable while the input itself is disabled (e.g. not connected). */
  disabled?: boolean
  /** Tooltip side — defaults to the site convention ('right'). */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Square edge length in Tailwind units (w-/h-). Default 10 (40px). */
  size?: 9 | 10 | 11
}

export default function MicButton({ onTranscript, disabled = false, side = 'right', size = 10 }: Props) {
  const { supported, listening, transcribing, error, toggle, clearError } = useVoiceDictation({ onResult: onTranscript })

  // Auto-dismiss the error after a few seconds so it doesn't linger.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 6000)
    return () => clearTimeout(t)
  }, [error, clearError])

  if (!supported) return null

  const box = size === 11 ? 'w-11 h-11' : size === 9 ? 'w-9 h-9' : 'w-10 h-10'
  const isBusy = disabled || transcribing

  const label = transcribing
    ? 'Transcribing…'
    : listening
      ? 'Listening… click to stop'
      : 'Click to dictate your instructions'

  const colorClasses = error
    ? 'bg-red-50 text-red-600 ring-2 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30'
    : listening
      ? 'bg-brand-600/10 text-brand-600 ring-2 ring-brand-600/30'
      : 'bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="relative inline-flex flex-shrink-0">
      {/* Visible failure message — sits above the mic so it doesn't shift the row. */}
      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            onClick={clearError}
            className="absolute bottom-full right-0 mb-2 w-max max-w-[240px] cursor-pointer rounded-lg bg-red-600 px-2.5 py-1.5 text-left text-xs leading-snug text-white shadow-lg z-40"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <Tooltip label={label} side={side}>
        <motion.button
          type="button"
          whileHover={isBusy ? undefined : { scale: 1.05 }}
          whileTap={isBusy ? undefined : { scale: 0.95 }}
          onClick={toggle}
          disabled={isBusy}
          aria-label={listening ? 'Stop voice dictation' : 'Start voice dictation'}
          aria-pressed={listening}
          className={`${box} rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:cursor-not-allowed ${colorClasses}`}
        >
          {transcribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="relative flex items-center justify-center">
              {listening && (
                <motion.span
                  className="absolute inline-flex h-7 w-7 rounded-full bg-brand-600/20"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <Mic className="w-4 h-4 relative" />
            </span>
          )}
        </motion.button>
      </Tooltip>
    </div>
  )
}
