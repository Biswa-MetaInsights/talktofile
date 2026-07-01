import { useCallback, useEffect, useRef, useState } from 'react'
import { toolsApi } from '../api/client'

// ACTIVE voice engine (MicButton uses this). Records audio and transcribes it
// server-side with Whisper — works in every browser, including Brave. The free
// Web Speech API alternative in `useWebSpeech.ts` is the dormant fallback.
//
// Voice dictation that records audio in the browser and transcribes it server-side
// with OpenAI Whisper (see backend POST /api/tools/transcribe). Unlike the Web
// Speech API, this does NOT depend on the browser shipping audio to Google, so it
// works everywhere getUserMedia + MediaRecorder do — including Brave and Firefox.
//
// Flow: click → record (MediaRecorder) → click again → stop, upload the clip,
// Whisper returns text → deliver to `onResult`. The caller appends it to its input.
//
// Resilience: every attempt begins with `hardReset()`, so a previous attempt that
// got stuck (e.g. an error mid-recording) can never block a new one — the button
// self-heals in a single click. All failure paths set a human-readable `error`.

interface Options {
  /** Called once with the transcribed text after the user stops recording. */
  onResult: (text: string) => void
}

// Pick a container the browser can actually record (Chrome/Brave: webm; Safari: mp4).
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export function useVoiceDictation({ onResult }: Options) {
  const [supported] = useState<boolean>(
    () => typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && typeof MediaRecorder !== 'undefined',
  )
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Force everything back to a clean idle state. Safe to call at any time, from any
  // state — this is what guarantees the button never gets permanently stuck.
  const hardReset = useCallback(() => {
    const rec = recorderRef.current
    if (rec) {
      rec.ondataavailable = null
      rec.onstop = null
      rec.onerror = null
      try { if (rec.state !== 'inactive') rec.stop() } catch { /* already stopped */ }
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => { try { t.stop() } catch { /* noop */ } })
    streamRef.current = null
    chunksRef.current = []
    setListening(false)
    setTranscribing(false)
  }, [])

  const fail = useCallback((msg: string) => {
    // eslint-disable-next-line no-console
    console.warn(`[voice] ${msg}`)
    hardReset()
    setError(msg)
  }, [hardReset])

  const start = useCallback(async () => {
    // Always start from a clean slate so a stuck prior attempt can't block us.
    hardReset()
    setError(null)
    if (!supported) { setError('Voice input is not supported in this browser.'); return }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const name = (e as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') fail('Microphone blocked. Allow mic access in your browser, then try again.')
      else if (name === 'NotFoundError') fail('No microphone found.')
      else fail('Could not access the microphone.')
      return
    }
    streamRef.current = stream

    let recorder: MediaRecorder
    try {
      const mimeType = pickMimeType()
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      fail('Audio recording is not supported in this browser.')
      return
    }

    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onerror = () => fail('Recording failed. Please try again.')
    recorder.onstop = async () => {
      // Tear down the recording resources immediately, regardless of what follows.
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      chunksRef.current = []
      streamRef.current?.getTracks().forEach((t) => { try { t.stop() } catch { /* noop */ } })
      streamRef.current = null
      recorderRef.current = null
      setListening(false)

      if (blob.size === 0) { setError("Didn't catch any audio. Try again."); return }

      setTranscribing(true)
      try {
        const { data } = await toolsApi.transcribe(blob)
        const text = data.text?.trim()
        if (text) { onResultRef.current(text); setError(null) }
        else setError("Didn't catch that. Please try again.")
      } catch (e) {
        const resp = (e as { response?: { status?: number; data?: { detail?: string } } }).response
        if (resp?.status) setError(resp.data?.detail ? `Transcription failed: ${resp.data.detail}` : `Transcription failed (error ${resp.status}).`)
        else setError("Couldn't reach the server. Is the backend running?")
      } finally {
        // Always clear — this is what stops the "stuck on Transcribing" state.
        setTranscribing(false)
      }
    }

    try {
      recorder.start()
    } catch {
      fail('Could not start recording.')
      return
    }
    recorderRef.current = recorder
    setListening(true)
  }, [supported, hardReset, fail])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') {
      try { rec.stop() } catch { hardReset() } // onstop handles the upload
    } else {
      hardReset()
    }
  }, [hardReset])

  const toggle = useCallback(() => {
    if (transcribing) return // busy uploading; ignore clicks
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') stop()
    else void start() // start() hard-resets first, healing any stuck state
  }, [transcribing, start, stop])

  const clearError = useCallback(() => setError(null), [])

  // Clean up if the component unmounts mid-recording.
  useEffect(() => () => { hardReset() }, [hardReset])

  return { supported, listening, transcribing, error, toggle, clearError }
}
