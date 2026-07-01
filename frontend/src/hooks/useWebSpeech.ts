import { useCallback, useEffect, useRef, useState } from 'react'

// Voice dictation via the browser's built-in Web Speech API — free, no key, no
// backend, no cost. Transcription happens in the browser. Works in Chrome/Edge;
// **Brave strips Google's speech backend and Firefox has no support**, so there it
// produces no results — we detect that and surface a clear on-screen message.
//
// ⚠️ DORMANT / FALLBACK (not imported). The active engine is Whisper in
// `useVoiceDictation.ts` (it works in Brave; this doesn't). Kept as a free,
// no-backend alternative: point MicButton's import here to switch engines. Useful
// only if you accept that voice won't work in Brave/Firefox.
//
// Delivery model: accumulate the full transcript of the session (reading every
// result, interim included — we do NOT depend on the `isFinal` flag, which some
// builds never set in a continuous session) and hand it to `onResult` once, on stop.
//
// IMPORTANT — restart vs. fresh start: Chrome ends recognition on every short pause,
// so we transparently RE-LAUNCH a new instance to keep listening. `launch()` does
// that WITHOUT clearing the accumulated transcript; only a user-initiated `start()`
// clears it. (Earlier these were merged, so each auto-restart wiped the text — the
// bug that made Chrome "hear" speech but write nothing.)
//
// Same return shape as useVoiceDictation so it's a drop-in: `transcribing` is always
// false here (no separate upload step), it just keeps MicButton generic.

interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string; message?: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])
const UNAVAILABLE_MSG = "Voice recognition isn't available in this browser (Brave and Firefox block it). Try Chrome or Edge."

interface Options {
  /** Called once, on stop, with the full transcribed text of the session. */
  onResult: (text: string) => void
}

export function useWebSpeech({ onResult }: Options) {
  const [supported] = useState<boolean>(() => getRecognitionCtor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wantListeningRef = useRef(false)
  const committedRef = useRef('')   // text from prior (auto-restarted) instances
  const currentRef = useRef('')     // current instance's running transcript
  const sessionStartRef = useRef(0)
  const instantEndsRef = useRef(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Detach + abort the live recognition instance. Does NOT touch the transcript.
  const teardownInstance = useCallback(() => {
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      rec.onstart = null
      try { rec.abort() } catch { /* already stopped */ }
    }
  }, [])

  // Create + start a recognition instance. Crucially does NOT clear the transcript,
  // so the auto-restart on a pause preserves everything heard so far.
  const launch = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) { setError(UNAVAILABLE_MSG); return }

    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    /* eslint-disable no-console */
    recognition.onstart = () => console.debug('[voice] web-speech started — secure context?', window.isSecureContext)
    recognition.onresult = (e) => {
      // This instance's full transcript = concat of all its results (interim + final).
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      currentRef.current = text
    }
    recognition.onerror = (e) => {
      console.warn(`[voice] web-speech error: ${e.error}${e.message ? ` — ${e.message}` : ''}`)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListeningRef.current = false
        setError('Microphone blocked. Allow mic access in your browser, then try again.')
      } else if (e.error === 'audio-capture') {
        wantListeningRef.current = false
        setError('No microphone found.')
      } else if (e.error === 'network') {
        wantListeningRef.current = false
        setError(UNAVAILABLE_MSG)
      } else if (FATAL_ERRORS.has(e.error)) {
        wantListeningRef.current = false
        setError('Voice recognition failed.')
      }
      // 'no-speech'/'aborted' are transient — onend handles them (restart).
    }
    recognition.onend = () => {
      recognitionRef.current = null
      // Fold this instance's text into the running total before it's replaced.
      if (currentRef.current.trim()) {
        committedRef.current = `${committedRef.current} ${currentRef.current}`.trim()
      }
      const ranMs = Date.now() - sessionStartRef.current
      const heard = currentRef.current.trim().length > 0
      currentRef.current = ''

      // Repeated instant ends with no audio = browser isn't really transcribing
      // (Brave/Firefox) or a mic/secure-context problem. Stop looping; explain it.
      if (ranMs < 400 && !heard) {
        instantEndsRef.current += 1
        if (instantEndsRef.current >= 3) {
          wantListeningRef.current = false
          if (!committedRef.current.trim()) setError(UNAVAILABLE_MSG)
        }
      } else {
        instantEndsRef.current = 0
      }

      if (wantListeningRef.current) launch() // restart WITHOUT clearing committed text
      else setListening(false)
    }
    /* eslint-enable no-console */

    recognitionRef.current = recognition
    try {
      sessionStartRef.current = Date.now()
      recognition.start()
      wantListeningRef.current = true
      setListening(true)
    } catch {
      recognitionRef.current = null
      setError('Could not start voice recognition.')
    }
  }, [])

  // User-initiated start: wipe any prior state/transcript, then launch.
  const start = useCallback(() => {
    wantListeningRef.current = false
    teardownInstance()
    committedRef.current = ''
    currentRef.current = ''
    instantEndsRef.current = 0
    setError(null)
    launch()
  }, [teardownInstance, launch])

  // User-initiated stop: hand over everything heard this session, then go idle.
  const stop = useCallback(() => {
    wantListeningRef.current = false
    const full = `${committedRef.current} ${currentRef.current}`.replace(/\s+/g, ' ').trim()
    teardownInstance()
    committedRef.current = ''
    currentRef.current = ''
    instantEndsRef.current = 0
    setListening(false)
    if (full) { onResultRef.current(full); setError(null) }
  }, [teardownInstance])

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop()
    else start()
  }, [start, stop])

  const clearError = useCallback(() => setError(null), [])

  // Full cleanup on unmount.
  useEffect(() => () => {
    wantListeningRef.current = false
    teardownInstance()
  }, [teardownInstance])

  return { supported, listening, transcribing: false, error, toggle, clearError }
}
