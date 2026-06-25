import { useCallback, useRef, useState, useEffect } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Crown, X, GitCompare, Files } from 'lucide-react'
import type { PipelineUpdate, SessionInfo, AppMode } from '../types'
import { PLAN_LIMITS } from '../types'
import { documentApi, createProcessWebSocket } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'

interface Props {
  onReady: (session: SessionInfo) => void
  onRequireUpgrade: () => void
  onBusyChange?: (busy: boolean) => void
  initialFiles?: File[]
  initialRejections?: FileRejection[]
  // URL passed from the landing page for web/YouTube ingestion.
  initialUrl?: string
  // Mode selected on the landing page — shown in the heading.
  selectedMode?: AppMode
}

export const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/html': ['.html', '.htm'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  // Plain-text + source-code formats (accepted silently, not shown in the UI).
  'text/plain': [
    '.txt', '.py', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.java', '.js',
    '.ts', '.tsx', '.jsx', '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt',
    '.kts', '.sql', '.sh', '.bash', '.yaml', '.yml', '.xml', '.toml', '.ini',
    '.cfg', '.css', '.scss', '.less', '.r', '.pl', '.lua', '.dart', '.scala',
    '.groovy', '.bat', '.ps1', '.tex', '.rst', '.log',
  ],
}

const MODE_LABELS: Record<string, string> = {
  chat: 'Chat with your document',
  summary: 'Generate a document summary',
  flashcards: 'Create flashcards',
  slides: 'Build a slide deck',
  translate: 'Translate your document',
  podcast: 'Create a podcast script',
  charts: 'Visualise your data as a chart',
}

export const ACCEPT_EXCEL = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
}

export default function UploadZone({ onReady, onRequireUpgrade, onBusyChange, initialFiles, initialRejections, initialUrl, selectedMode }: Props) {
  const { token, user } = useAuth()
  const plan = user?.plan ?? 'free'
  const limits = PLAN_LIMITS[plan]

  const [stage, setStage] = useState<string>('')
  const [stageMsg, setStageMsg] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>('')
  const [upgradeHint, setUpgradeHint] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => () => wsRef.current?.close(), [])

  // Mirror upload/processing state up to the parent (drives the refresh guard).
  // 'ready' still counts as busy until the session takes over a moment later.
  useEffect(() => {
    onBusyChange?.(!!stage && stage !== 'error')
    return () => onBusyChange?.(false)
  }, [stage, onBusyChange])

  const processFiles = useCallback(async (selected: File[]) => {
    setError('')
    setUpgradeHint('')
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

          const progressMap: Record<string, number> = {
            extracting: 45,
            analysing: 80,
            ready: 100,
          }
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
        ws.onclose = () => {
          if (!sessionInfo) reject(new Error('Connection closed unexpectedly'))
        }
      })

      if (sessionInfo) setTimeout(() => onReady(sessionInfo!), 500)
    } catch (err: any) {
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Upload failed. Please try again.')
      setStage('')
      setFiles([])
      setProgress(0)
    }
  }, [token, onReady])

  const processUrl = useCallback(async (url: string) => {
    setError('')
    setStage('uploading')
    setStageMsg('Fetching content from URL...')
    setProgress(10)

    try {
      const res = await documentApi.uploadUrl(url)
      const { session_id, filenames } = res.data

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
            resolve()
          } else if (data.stage === 'error') {
            reject(new Error(data.message))
          }
        }

        ws.onerror = () => reject(new Error('Connection error'))
        ws.onclose = () => { if (!sessionInfo) reject(new Error('Connection closed unexpectedly')) }
      })

      if (sessionInfo) setTimeout(() => onReady(sessionInfo!), 500)
    } catch (err: any) {
      wsRef.current?.close()
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Could not process that URL. Please try again.')
      setStage('')
      setProgress(0)
    }
  }, [token, onReady])

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setError('')
    setUpgradeHint('')

    if (accepted.length + rejections.length > limits.maxFiles) {
      if (plan === 'free') {
        setUpgradeHint(`The free plan handles ${limits.maxFiles} file at a time. Multi-file compare & analysis is coming soon with Pro.`)
        return
      }
      setError(`You can upload at most ${limits.maxFiles} files.`)
      return
    }

    const tooBig = [...accepted, ...rejections.map((r) => r.file)].find((f) => f.size > limits.maxSizeMb * 1024 * 1024)
    if (tooBig) {
      if (plan === 'free') {
        setUpgradeHint(`'${tooBig.name}' is over the ${limits.maxSizeMb}MB free limit. Larger uploads are coming soon with Pro.`)
        return
      }
      setError(`'${tooBig.name}' exceeds the ${limits.maxSizeMb}MB limit.`)
      return
    }

    if (rejections.length > 0) {
      setError('Some files have an unsupported type. Allowed: PDF, DOCX, XLSX, PPTX, HTML, JSON, TXT, CSV, MD.')
      return
    }
    if (accepted.length > 0) processFiles(accepted)
  }, [limits, plan, processFiles])

  const consumedInitial = useRef(false)
  useEffect(() => {
    if (consumedInitial.current) return
    if ((initialFiles?.length ?? 0) > 0 || (initialRejections?.length ?? 0) > 0) {
      consumedInitial.current = true
      onDrop(initialFiles ?? [], initialRejections ?? [])
    } else if (initialUrl) {
      consumedInitial.current = true
      processUrl(initialUrl)
    }
  }, [initialFiles, initialRejections, initialUrl, onDrop, processUrl])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: selectedMode === 'charts' ? ACCEPT_EXCEL : ACCEPT,
    maxFiles: limits.maxFiles,
    multiple: limits.maxFiles > 1,
    disabled: !!stage,
    maxSize: PLAN_LIMITS.pro.maxSizeMb * 1024 * 1024,
  })

  const isProcessing = !!stage && stage !== 'error'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {selectedMode && selectedMode !== 'chat'
              ? MODE_LABELS[selectedMode]
              : plan === 'pro' ? 'Upload Your Documents' : 'Upload Your Document'}
          </h2>
          <p className="text-slate-500 text-sm">
            PDF, Word, Excel, PowerPoint, HTML, JSON, CSV, text, any language
          </p>
          <p className="text-slate-400 text-xs mt-1">
            {plan === 'pro'
              ? `Up to ${limits.maxFiles} files · ${limits.maxSizeMb}MB each · compare & analyse`
              : `${limits.maxFiles} file · up to ${limits.maxSizeMb}MB`}
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
            isProcessing
              ? 'border-brand-300 bg-brand-50/40 cursor-not-allowed'
              : isDragReject
              ? 'border-red-400 bg-red-50'
              : isDragActive
              ? 'border-brand-400 bg-brand-50 scale-[1.02]'
              : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/30'
          }`}
        >
          <input {...getInputProps()} />

          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="space-y-5">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    {files.length > 1 ? <Files className="w-12 h-12 text-brand-500" /> : <FileText className="w-12 h-12 text-brand-500" />}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-slate-800 font-medium text-sm truncate">
                    {files.length > 1 ? `${files.length} files` : files[0]?.name}
                  </p>
                  <p className="text-brand-600 text-xs mt-1">{stageMsg}</p>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                </div>
              </motion.div>
            ) : stage === 'ready' ? (
              <motion.div key="ready" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-green-600 font-medium">Ready!</p>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100">
                  <Upload className="w-7 h-7 text-brand-500" />
                </motion.div>
                <div>
                  <p className="text-slate-800 font-medium">
                    {isDragActive ? 'Drop them here!' : plan === 'pro' ? 'Drag & drop your files' : 'Drag & drop your file'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">or click to browse</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {['PDF', 'DOCX', 'XLSX', 'PPTX', 'HTML', 'JSON', 'TXT', 'CSV', 'MD'].map((t) => (
                    <span key={t} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-md font-mono border border-slate-200">.{t.toLowerCase()}</span>
                  ))}
                </div>
                {plan === 'pro' && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-brand-500">
                    <GitCompare className="w-3.5 h-3.5" /> Upload 2 files to compare them, or up to 5 to analyse together
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upgrade prompt */}
        <AnimatePresence>
          {upgradeHint && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-start gap-3 bg-brand-50 rounded-xl px-4 py-3 border border-brand-200"
            >
              <Crown className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-slate-700">{upgradeHint}</p>
                {user?.is_guest && (
                  <button onClick={onRequireUpgrade} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all">
                    Create a free account
                  </button>
                )}
              </div>
              <button onClick={() => setUpgradeHint('')} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
