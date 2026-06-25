import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipelineUpdate, SessionInfo, Plan } from '../types'
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
  processFiles: (selected: File[]) => void
  processUrl: (url: string) => void
  reset: () => void
}

export function useDocumentProcessor(token: string | null, plan: Plan): DocumentProcessor {
  const [stage, setStage] = useState('')
  const [stageMsg, setStageMsg] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => () => wsRef.current?.close(), [])

  const reset = useCallback(() => {
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
    setError('')
    setSession(null)
    setFiles(selected)
    setStage('uploading')
    setStageMsg(selected.length > 1 ? `Uploading ${selected.length} files...` : 'Uploading file...')
    setProgress(8)

    try {
      const res = await documentApi.upload(selected)
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

      if (sessionInfo) setSession(sessionInfo)
    } catch (err: any) {
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Upload failed. Please try again.')
      setStage('error')
      setFiles([])
      setProgress(0)
    }
  }, [token, plan])

  const processUrl = useCallback(async (url: string) => {
    setError('')
    setSession(null)
    setFiles([])
    setStage('uploading')
    setStageMsg('Fetching content from URL...')
    setProgress(10)

    try {
      const res = await documentApi.uploadUrl(url)
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

      if (sessionInfo) setSession(sessionInfo)
    } catch (err: any) {
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Could not process that URL. Please try again.')
      setStage('error')
      setProgress(0)
    }
  }, [token, plan])

  const processing = !!stage && stage !== 'error' && stage !== 'ready'

  return { stage, stageMsg, progress, error, files, session, processing, processFiles, processUrl, reset }
}
