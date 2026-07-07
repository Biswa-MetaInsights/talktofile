import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipelineUpdate, SessionInfo, SessionMode, Plan } from '../types'
import { documentApi, createProcessWebSocket } from '../api/client'
import { track } from '../lib/analytics'

// Shared upload→process pipeline used by both the Landing hero (so the upload can
// run while the user is still on the home page) and the in-app UploadZone fallback.
// It uploads file bytes / a URL, drives the processing WebSocket, and surfaces the
// stage, progress and the resulting ready session. It does NOT navigate anywhere —
// the caller decides what to do once `session` is set.
export interface DocumentProcessor {
  stage: string
  stageMsg: string
  progress: number
  error: string
  files: File[]
  session: SessionInfo | null
  processing: boolean
  removing: boolean
  processFiles: (selected: File[]) => void
  processUrl: (url: string) => void
  removeFile: (filename: string) => void
  reset: () => void
}

export function useDocumentProcessor(token: string | null, plan: Plan): DocumentProcessor {
  const [stage, setStage] = useState('')
  const [stageMsg, setStageMsg] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [session, setSession] = useState<SessionInfo | null>(null)
  // True while a server-side file removal is in flight (the UI has already updated
  // optimistically; this tracks the backend catching up). The caller can gate actions
  // that need the server to be consistent — e.g. entering the chat.
  const [removing, setRemoving] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  // Monotonic id for the current upload attempt. Bumped whenever a new upload
  // starts (or on reset) so a superseded/aborted upload's async handlers can
  // detect they're stale and stop mutating shared state. Without this, deleting
  // one file mid-upload (which restarts the pipeline on the survivors) let the
  // original batch's WebSocket close/error handlers run — and their catch block
  // calls setFiles([]), wiping *all* the rows instead of just the deleted one.
  const uploadGen = useRef(0)

  useEffect(() => () => wsRef.current?.close(), [])

  const reset = useCallback(() => {
    uploadGen.current++
    wsRef.current?.close()
    wsRef.current = null
    setStage('')
    setStageMsg('')
    setFiles([])
    setError('')
    setProgress(0)
    setSession(null)
  }, [])

  const processFiles = useCallback(async (selected: File[]) => {
    // Supersede any in-flight upload: bump the generation and close its socket so
    // its stale handlers can't write to shared state (see uploadGen above).
    const gen = ++uploadGen.current
    wsRef.current?.close()
    wsRef.current = null

    setError('')
    setSession(null)
    setFiles(selected)
    setStage('uploading')
    setStageMsg(selected.length > 1 ? `Uploading ${selected.length} files...` : 'Uploading file...')
    setProgress(8)

    try {
      const res = await documentApi.upload(selected)
      if (uploadGen.current !== gen) return // superseded while the upload request was in flight
      const { session_id, filenames } = res.data

      setStage('extracting')
      setProgress(20)

      const ws = createProcessWebSocket(session_id, token!)
      wsRef.current = ws
      let sessionInfo: SessionInfo | null = null

      await new Promise<void>((resolve, reject) => {
        ws.onopen = async () => {
          try {
            for (let i = 0; i < filenames.length; i++) {
              ws.send(await selected[i].arrayBuffer())
            }
          } catch {
            reject(new Error('Failed to read file for upload'))
          }
        }

        ws.onmessage = (evt) => {
          if (uploadGen.current !== gen) return // a newer upload took over — ignore stale events
          const data: PipelineUpdate = JSON.parse(evt.data)
          setStage(data.stage)
          setStageMsg(data.message)

          const progressMap: Record<string, number> = { extracting: 45, analysing: 80, ready: 100 }
          setProgress(progressMap[data.stage] ?? 50)

          if (data.stage === 'ready') {
            sessionInfo = {
              session_id,
              documents: data.documents ?? [],
              mode: data.mode ?? 'single',
              suggested_questions: data.suggested_questions ?? [],
              ready: true,
            }
            track('document_uploaded', { count: selected.length, mode: sessionInfo.mode, plan })
            resolve()
          } else if (data.stage === 'error') {
            reject(new Error(data.message))
          }
        }

        ws.onerror = () => reject(new Error('Connection error'))
        ws.onclose = () => { if (!sessionInfo) reject(new Error('Connection closed unexpectedly')) }
      })

      if (sessionInfo && uploadGen.current === gen) setSession(sessionInfo)
    } catch (err: any) {
      if (uploadGen.current !== gen) return // superseded — don't clobber the current upload's state
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Upload failed. Please try again.')
      setStage('error')
      setFiles([])
      setProgress(0)
    }
  }, [token, plan])

  const processUrl = useCallback(async (url: string) => {
    const gen = ++uploadGen.current
    wsRef.current?.close()
    wsRef.current = null

    setError('')
    setSession(null)
    setFiles([])
    setStage('uploading')
    setStageMsg('Fetching content from URL...')
    setProgress(10)

    try {
      const res = await documentApi.uploadUrl(url)
      if (uploadGen.current !== gen) return // superseded while the request was in flight
      const { session_id } = res.data

      setStage('extracting')
      setProgress(25)

      const ws = createProcessWebSocket(session_id, token!)
      wsRef.current = ws
      let sessionInfo: SessionInfo | null = null

      await new Promise<void>((resolve, reject) => {
        // URL sessions: just open the WS and wait — no binary data to send.
        ws.onopen = () => {}

        ws.onmessage = (evt) => {
          if (uploadGen.current !== gen) return // a newer upload took over — ignore stale events
          const data: PipelineUpdate = JSON.parse(evt.data)
          setStage(data.stage)
          setStageMsg(data.message)

          const progressMap: Record<string, number> = { extracting: 50, analysing: 85, ready: 100 }
          setProgress(progressMap[data.stage] ?? 50)

          if (data.stage === 'ready') {
            sessionInfo = {
              session_id,
              documents: data.documents ?? [],
              mode: data.mode ?? 'single',
              suggested_questions: data.suggested_questions ?? [],
              ready: true,
            }
            track('document_uploaded', { count: 1, mode: sessionInfo.mode, plan })
            resolve()
          } else if (data.stage === 'error') {
            reject(new Error(data.message))
          }
        }

        ws.onerror = () => reject(new Error('Connection error'))
        ws.onclose = () => { if (!sessionInfo) reject(new Error('Connection closed unexpectedly')) }
      })

      if (sessionInfo && uploadGen.current === gen) setSession(sessionInfo)
    } catch (err: any) {
      if (uploadGen.current !== gen) return // superseded — don't clobber the current upload's state
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Could not process that URL. Please try again.')
      setStage('error')
      setProgress(0)
    }
  }, [token, plan])

  // Remove a single file from the upload.
  //  • If a session already exists (processing finished), drop the file from the UI
  //    *immediately* and optimistically trim the session — the survivors keep their
  //    built indexes server-side, so nothing is re-processed. We then call the server
  //    in the background to actually drop the document and swap in its authoritative
  //    response (refreshed suggested questions, etc.). Because the session stays
  //    `ready` throughout, the surviving rows never flash back to "processing".
  //  • If processing hasn't produced a session yet, there's nothing server-side to
  //    trim, so fall back to re-running the pipeline on the remaining files.
  //  • Removing the last file clears everything.
  const removeFile = useCallback(async (filename: string) => {
    const remaining = files.filter((f) => f.name !== filename)
    if (remaining.length === 0) {
      reset()
      return
    }
    if (!session) {
      processFiles(remaining)
      return
    }

    const prevSession = session
    const prevFiles = files
    const mode: SessionMode = remaining.length <= 1 ? 'single' : remaining.length === 2 ? 'compare' : 'multi'
    // Optimistic update — instant, no await, session stays ready.
    setFiles(remaining)
    setSession({
      ...session,
      documents: session.documents.filter((d) => d.filename !== filename),
      mode,
    })
    setRemoving(true)
    try {
      const res = await documentApi.removeFile(prevSession.session_id, filename)
      setSession(res.data)
    } catch (err: any) {
      // Roll back the optimistic change so the UI matches the server again.
      setFiles(prevFiles)
      setSession(prevSession)
      setError(err.response?.data?.detail || err.message || 'Could not remove that file.')
    } finally {
      setRemoving(false)
    }
  }, [files, session, processFiles, reset])

  const processing = !!stage && stage !== 'error' && stage !== 'ready'

  return { stage, stageMsg, progress, error, files, session, processing, removing, processFiles, processUrl, removeFile, reset }
}
