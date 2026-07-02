import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion } from 'framer-motion'
import {
  FileText, Upload, MessageSquare, Sparkles, Globe, Files, BookOpen, Link2,
  ShieldCheck, Lock, Zap, ArrowUp, Loader2, CheckCircle, AlertCircle, RotateCcw, X, Plus,
  GraduationCap, Scale, LineChart, HeartPulse, Briefcase, ScrollText, Check, Crown,
} from 'lucide-react'
import { ACCEPT } from './UploadZone'
import Tooltip from './Tooltip'
import MicButton from './MicButton'
import { smoothScrollTo } from '../lib/smoothScroll'
import { useAuth } from '../context/AuthContext'
import { useDocumentProcessor } from '../hooks/useDocumentProcessor'
import markWhite from '../assets/mark-white.svg'
import { PLAN_LIMITS } from '../types'
import type { AppMode, SessionInfo } from '../types'

interface Props {
  // Called once the upload has finished AND the user has picked what to do.
  // The session is already processed and ready; `prompt` is the user's first
  // chat message (auto-sent in chat mode, carried along otherwise).
  onEnter: (session: SessionInfo, mode: AppMode, prompt: string) => void
  // Mirrors upload-in-progress up to the app shell (drives the refresh guard).
  onBusyChange?: (busy: boolean) => void
}

const FORMATS = ['PDF', 'Word', 'Excel', 'PowerPoint', 'HTML', 'JSON', 'CSV', 'Text']

// The first step's body is rendered specially (it contains in-page links to the
// hero drop zone and URL box), so its `body` is filled in at render time.
const STEPS = [
  { icon: Upload, title: 'Upload your documents and URLs', body: '' },
  { icon: MessageSquare, title: 'Ask the assistant', body: "Pick how you want to use the document, then ask away. Chat by typing a question, get a summary in a click, choose what goes into your flashcards or slides, and more. You're in control of what comes back." },
  { icon: Sparkles, title: 'Get the response', body: "The assistant answers within seconds, using only what you added. The answer also cites the exact page it's taken from." },
]

const FEATURES = [
  { icon: FileText, title: 'Answers only from your file', body: 'Every answer is pulled straight from your document and shows where it came from. Nothing borrowed from the open web.' },
  { icon: ShieldCheck, title: 'It says “I don’t know”', body: 'If the answer isn’t in your file, you’ll be told. No guessing, no filling the gap.' },
  { icon: Lock, title: 'Nothing is stored', body: 'Your file lives in memory for one session and disappears on refresh. Never written to disk, never trained on.' },
  { icon: Zap, title: 'No account, no setup', body: 'Drop a file and start asking. No sign-up, no email, no paywall to read your document. Sign in only when you want to chat with several files at once.' },
  { icon: Globe, title: 'Any language in, any language out', body: 'Supports more than 15+ languages, including Arabic, Chinese, Hindi and Spanish. Upload in any of them and get clear answers in the language you choose.' },
  { icon: Files, title: 'Works with any file', body: 'PDF, Word, Excel, PowerPoint and more. If it’s a document, you can talk to it.' },
  { icon: BookOpen, title: 'Handles long documents', body: 'Drop in a 200 page report or a whole textbook. Ask about any part of it, including tables and figures, without scrolling to find it.' },
  { icon: Link2, title: 'Talk to links too', body: 'Paste a web page or video link and ask about it, the same way you would a document.' },
]

const AUDIENCES = [
  { icon: GraduationCap, title: 'Students and researchers', body: 'Turn dense textbooks, lecture slides, and papers into summaries, flashcards, and quick answers, without reading every page.' },
  { icon: Scale, title: 'Legal and contracts', body: 'Pull clauses, deadlines, and obligations out of contracts, leases, and policies. Nothing you upload is stored, so client-sensitive files stay private.' },
  { icon: LineChart, title: 'Finance and analysts', body: 'Question your spreadsheets and reports, turn the tables into charts, and pull out the figures that matter. Every number comes straight from your file, never invented.' },
  { icon: HeartPulse, title: 'Medical and health records', body: 'Make sense of lab results, medical letters, and insurance documents in plain English, privately, with no account.' },
  { icon: Briefcase, title: 'Professionals and consultants', body: 'Get through long reports, manuals, and meeting notes fast, and ask exactly what you need to know.' },
  { icon: ScrollText, title: 'Anyone reading the fine print', body: 'Terms of service, warranties, rental agreements. Find out what you are actually agreeing to in seconds.' },
]

// Plan comparison rows. `basic` / `pro` mark whether the feature is included on each
// plan (tick vs cross). Kept in sync with the plan tiers in CLAUDE.md / core/config.py.
const PLAN_FEATURES: { name: string; basic: boolean; pro: boolean }[] = [
  { name: 'Chat with your documents', basic: true, pro: true },
  { name: 'Summaries, flashcards and slides', basic: true, pro: true },
  { name: 'Translation and podcasts', basic: true, pro: true },
  { name: 'Source-cited answers', basic: true, pro: true },
  { name: 'Talk to web and video links', basic: true, pro: true },
  { name: 'Private, nothing stored', basic: true, pro: true },
  { name: 'Upload several files at once', basic: false, pro: true },
  { name: 'Larger file uploads (up to 8MB)', basic: false, pro: true },
  { name: 'Compare documents side by side', basic: false, pro: true },
  { name: 'Multi-file analysis', basic: false, pro: true },
  { name: 'Personalised assistant', basic: false, pro: true },
]

// A single source's display state. Used for the first upload and every added
// file/URL so they all render through the same `SourceRow` look.
type SourceStatus = 'uploading' | 'ready' | 'error'

// One source row. Every source (the first upload and any added file/URL) renders
// through this so they look identical in every aspect: grey card body, a rounded
// brand icon-chip that shows a spinner-less file icon while uploading and a tick
// once ready, the same right-side spinner + progress bar while uploading, and a
// remove button. Rows are stacked newest-on-top by the caller.
function SourceRow({
  label,
  status,
  progress,
  statusMsg,
  onRemove,
}: {
  label: string
  status: SourceStatus
  progress: number
  statusMsg?: string
  onRemove?: () => void
}) {
  const ready = status === 'ready'
  const error = status === 'error'
  const uploading = status === 'uploading'
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#E2611B]/10 flex items-center justify-center flex-shrink-0">
          {error ? <AlertCircle className="w-4 h-4 text-brand-500" />
            : ready ? <CheckCircle className="w-4 h-4 text-[#E2611B]" />
            : <FileText className="w-4 h-4 text-[#E2611B]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate" title={label}>{label}</p>
          <p className={`text-xs ${error ? 'text-brand-500' : 'text-[#E2611B]'}`}>
            {error ? 'Upload failed' : ready ? 'Ready' : (statusMsg || 'Processing…')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {uploading && <Loader2 className="w-4 h-4 text-[#E2611B] animate-spin" />}
          {!error && onRemove && (
            <Tooltip label="Remove" side="right">
              <button
                onClick={onRemove}
                aria-label="Remove"
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {uploading && (
        <div className="mt-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#E2611B]/70 to-[#E2611B] rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  )
}

// Mode tabs shown on the hero upload card. Selecting one switches the active mode,
// which the upload pipeline then uses. The blurb shows below the tabs, above the
// drop zone, for the active mode. ('charts' has no backend mode yet — it falls
// back to chat on upload.)
const MODES: { value: AppMode | 'charts'; label: string; blurb: string }[] = [
  { value: 'chat', label: 'Chat', blurb: 'Ask anything in plain language and get answers pulled straight from your file. Follow-up questions remember what you already asked.' },
  { value: 'summary', label: 'Summary', blurb: 'Turn a long document into a clear, structured summary. The key points, without reading every page.' },
  { value: 'flashcards', label: 'Flashcards', blurb: 'Generate study-ready flashcards from any document. Useful for revision, onboarding, or learning something new fast.' },
  { value: 'slides', label: 'Slides', blurb: 'Turn a report or dense document into a clean slide deck you can present or share.' },
  { value: 'translate', label: 'Translate', blurb: 'Read documents in any language. Upload in one, get clear results in another.' },
  { value: 'podcast', label: 'Podcasts', blurb: 'Turn your document into a natural, listenable audio rundown for when you’d rather listen than read.' },
  { value: 'charts', label: 'Charts', blurb: 'Turn the tables in your file into bar, line, or pie charts, and more. See the numbers, don’t just read them.' },
]

// Warning shown when an upload (file or URL) is rejected for being a copy of a
// source already in the session. Names are compared case-insensitively elsewhere;
// this just phrases the notice.
function duplicateRejectionMessage(names: string[]): string {
  if (names.length === 1) return `'${names[0]}' was rejected since a copy already exists.`
  return `${names.map((n) => `'${n}'`).join(', ')} were rejected since copies already exist.`
}

export default function Landing({ onEnter, onBusyChange }: Props) {
  const { token, user } = useAuth()
  const plan = user?.plan ?? 'free'
  const limits = PLAN_LIMITS[plan]

  const { stage, stageMsg, progress, error, session, processing, removing, files, processFiles, processUrl, removeFile, reset } =
    useDocumentProcessor(token, plan)

  // Mode chosen inside the chat box that appears once an upload starts.
  const [selectedMode, setSelectedMode] = useState<AppMode | 'charts'>('chat')
  // What the user wants to do with the document — becomes the first chat message.
  const [prompt, setPrompt] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')
  const [heroError, setHeroError] = useState('')
  // Friendly label of what's being processed (filename(s) or the URL).
  const [sourceLabel, setSourceLabel] = useState('')
  // When a "How it works" link points at the hero drop zone, briefly highlight it
  // (same active styling as a drag) so it's obvious where to go.
  const [dropHighlight, setDropHighlight] = useState(false)

  // Multi-source add (Pro only, front-end scaffold for now): extra files/URLs the
  // user adds inside the chat box. These are display-only at the moment — they are
  // NOT yet uploaded or merged into the session (the backend builds a session from a
  // single batch; wiring this up is a follow-up). See CLAUDE.md.
  const [extraSources, setExtraSources] = useState<{ id: number; type: 'file' | 'url'; label: string; status: SourceStatus; progress: number }[]>([])
  const [addingUrl, setAddingUrl] = useState(false)
  const [extraUrl, setExtraUrl] = useState('')
  // Per-source simulated-upload timers (front-end only — added sources aren't
  // really uploaded yet, so we fake the same progress/ready animation the first
  // file gets). Keyed by source id so each can be cancelled on remove/unmount.
  const extraTimersRef = useRef<Record<number, number>>({})
  // Shown to non-Pro users who try to add a source — the controls are visible to
  // everyone, but only Pro can actually add more.
  const [multiHint, setMultiHint] = useState('')
  const extraFileInputRef = useRef<HTMLInputElement>(null)
  const extraIdRef = useRef(0)
  const isPro = plan === 'pro'

  // The upload has begun (or finished/failed) — the chat box takes over the card.
  const started = stage !== ''
  // 'charts' has no backend mode yet — fall back to chat.
  const effectiveMode: AppMode = selectedMode === 'charts' ? 'chat' : selectedMode
  // Proceed lights up once the document is ready. Chat needs a typed prompt first;
  // the other modes generate from the document, so they only need the upload done.
  const canProceed = !!session && (effectiveMode !== 'chat' || prompt.trim().length > 0)

  // Per-file status for a multi-file upload. The backend processes the batch as one
  // unit but extracts the files in order, emitting a "(i/total)" marker as it starts
  // each one — so we can show each row moving through queued → processing → ready on
  // its own, instead of every row sharing the single overall progress number. `i` in
  // the marker is 1-based; `activeFileIdx` is the 0-based index currently extracting
  // (everything before it is done, everything after is queued).
  const activeFileIdx = (() => {
    if (session) return files.length          // ready → every file done
    if (stage === 'analysing') return files.length  // extraction finished for all
    const m = stageMsg.match(/\((\d+)\/\d+\)/)
    return m ? parseInt(m[1], 10) - 1 : 0
  })()

  // Status/progress/label for one file row, derived from where the pipeline is.
  const fileRowProps = (idx: number): { status: SourceStatus; progress: number; statusMsg?: string } => {
    if (error) return { status: 'error', progress: 0 }
    if (idx < activeFileIdx) return { status: 'ready', progress: 100 }
    if (idx === activeFileIdx) return { status: 'uploading', progress: Math.max(progress, 35) }
    return { status: 'uploading', progress: 0, statusMsg: 'Queued' }
  }

  // While an upload/processing is in flight, mark the app busy so an accidental
  // refresh is guarded ('error' doesn't count — nothing is being lost).
  useEffect(() => {
    onBusyChange?.(!!stage && stage !== 'error')
    return () => onBusyChange?.(false)
  }, [stage, onBusyChange])

  // Auto-dismiss the "Pro feature" upgrade hint 5s after it appears.
  useEffect(() => {
    if (!multiHint) return
    const t = window.setTimeout(() => setMultiHint(''), 5_000)
    return () => window.clearTimeout(t)
  }, [multiHint])

  // Cancel any in-flight simulated-upload timers when the component unmounts.
  useEffect(() => () => {
    Object.values(extraTimersRef.current).forEach((t) => window.clearTimeout(t))
  }, [])

  // Drive a fake upload for an added source: ramp its progress, then mark it
  // ready (with the tick). Mirrors the first file's spinner + progress + ready
  // animation. Front-end only — nothing is actually uploaded.
  const simulateExtraUpload = (id: number) => {
    let p = 0
    const step = () => {
      p = Math.min(100, p + Math.random() * 22 + 12)
      const ready = p >= 100
      setExtraSources((prev) => prev.map((s) =>
        s.id === id ? { ...s, progress: p, status: ready ? 'ready' : 'uploading' } : s
      ))
      if (ready) {
        delete extraTimersRef.current[id]
      } else {
        extraTimersRef.current[id] = window.setTimeout(step, 320)
      }
    }
    extraTimersRef.current[id] = window.setTimeout(step, 200)
  }

  // Scroll the hero drop zone into view, focus it, and flash the active highlight.
  const focusDropZone = () => {
    const el = document.getElementById('hero-dropzone')
    el?.focus({ preventScroll: true })
    smoothScrollTo(el, { block: 'center' })
    setDropHighlight(true)
    window.setTimeout(() => setDropHighlight(false), 2500)
  }

  // Scroll the hero URL input into view and place the cursor inside it.
  const focusUrlInput = () => {
    const el = document.getElementById('hero-url-input') as HTMLInputElement | null
    el?.focus({ preventScroll: true })
    smoothScrollTo(el, { block: 'center' })
  }

  const handleAddUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('Please enter a full URL starting with https://')
      return
    }
    setUrlError('')
    setSourceLabel(trimmed)
    processUrl(trimmed)
  }

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setHeroError('')
    setMultiHint('')

    let acceptedFiles = accepted
    let fileRejections = rejections

    // Reject duplicate filenames within the dropped batch (e.g. the same file
    // dragged in twice, or a copy picked from another folder). Keep the first and
    // drop the rest; the warning is surfaced via multiHint once the chat box shows.
    const dupInBatch: string[] = []
    {
      const seen = new Set<string>()
      const unique: File[] = []
      for (const f of acceptedFiles) {
        const key = f.name.trim().toLowerCase()
        if (seen.has(key)) { dupInBatch.push(f.name); continue }
        seen.add(key)
        unique.push(f)
      }
      acceptedFiles = unique
    }

    // The free plan can now *select* several files (the picker is no longer
    // single-select), but only one is actually uploaded. Trim the picked set to
    // the first allowed file and flag the Pro-only notice surfaced below.
    let trimmedForFree = false
    if (acceptedFiles.length + fileRejections.length > limits.maxFiles) {
      if (plan !== 'free') {
        setHeroError(`You can upload at most ${limits.maxFiles} files.`)
        return
      }
      trimmedForFree = true
      acceptedFiles = acceptedFiles.slice(0, limits.maxFiles)
      // Prefer a valid file; only keep a rejection if nothing valid was picked
      // (so the unsupported-type error below still fires for an all-bad selection).
      fileRejections = acceptedFiles.length > 0 ? [] : fileRejections.slice(0, limits.maxFiles)
    }

    const tooBig = [...acceptedFiles, ...fileRejections.map((r) => r.file)].find((f) => f.size > limits.maxSizeMb * 1024 * 1024)
    if (tooBig) {
      setHeroError(plan === 'free'
        ? `'${tooBig.name}' is over the ${limits.maxSizeMb}MB free limit. Larger uploads are coming soon with Pro.`
        : `'${tooBig.name}' exceeds the ${limits.maxSizeMb}MB limit.`)
      return
    }
    if (fileRejections.length > 0) {
      setHeroError('Some files have an unsupported type. Allowed: PDF, DOCX, XLSX, PPTX, HTML, JSON, TXT, CSV, MD.')
      return
    }
    if (acceptedFiles.length > 0) {
      setSourceLabel(acceptedFiles.length > 1 ? `${acceptedFiles.length} files` : acceptedFiles[0].name)
      // heroError lives only on the pre-upload view, which unmounts the instant
      // processing starts — so surface notices via multiHint, which renders inside
      // the chat box the upload morphs into.
      const notices: string[] = []
      if (trimmedForFree) notices.push('Multiple uploads are possible only on a Pro account. Only the first file was uploaded.')
      if (dupInBatch.length) notices.push(duplicateRejectionMessage(dupInBatch))
      if (notices.length) setMultiHint(notices.join(' '))
      processFiles(acceptedFiles)
    }
  }, [limits, plan, processFiles])

  // Set when the user hits Proceed while a file removal is still settling on the
  // backend (see `removing`). We hold them on the page with a "Please wait…" button
  // and enter the chat the moment the server confirms, so the session they enter is
  // guaranteed consistent with what they see.
  const [proceedPending, setProceedPending] = useState(false)

  const handleProceed = () => {
    if (!canProceed || !session) return
    if (removing) {
      setProceedPending(true)  // wait for the backend removal to finish, then enter
      return
    }
    onEnter(session, effectiveMode, prompt.trim())
  }

  // Once a pending removal settles, complete the queued Proceed. If the removal failed
  // it rolled back and surfaced an `error`, so we don't enter — the user stays to see it.
  useEffect(() => {
    if (!proceedPending || removing) return
    setProceedPending(false)
    if (error || !session) return
    if (effectiveMode !== 'chat' || prompt.trim().length > 0) {
      onEnter(session, effectiveMode, prompt.trim())
    }
  }, [proceedPending, removing, error, session, effectiveMode, prompt, onEnter])

  // ── Multi-source add (controls visible to all; only Pro can add — front-end only) ──
  const openExtraFilePicker = () => {
    if (!isPro) { setMultiHint('Adding more files is a Pro feature. Upgrade to add several sources.'); return }
    extraFileInputRef.current?.click()
  }

  const startAddUrl = () => {
    if (!isPro) { setMultiHint('Adding more URLs is a Pro feature. Upgrade to add several sources.'); return }
    setAddingUrl(true)
  }

  // Filenames / URLs already in this session: the initial upload's files (or its
  // URL label) plus any added extra sources. Compared case-insensitively so a copy
  // of something already added can be rejected.
  const existingSourceKeys = useCallback(() => {
    const keys = new Set<string>()
    files.forEach((f) => keys.add(f.name.trim().toLowerCase()))
    if (files.length === 0 && sourceLabel) keys.add(sourceLabel.trim().toLowerCase())
    extraSources.forEach((s) => keys.add(s.label.trim().toLowerCase()))
    return keys
  }, [files, sourceLabel, extraSources])

  const handleExtraFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    // Reject any file whose name already exists in the session (or is repeated
    // within this pick), keeping the first copy. Works the same whether files are
    // picked one after another or together in a multiple-selection.
    const existing = existingSourceKeys()
    const accepted: File[] = []
    const rejected: string[] = []
    for (const f of picked) {
      const key = f.name.trim().toLowerCase()
      if (existing.has(key)) { rejected.push(f.name); continue }
      existing.add(key)
      accepted.push(f)
    }
    if (accepted.length) {
      // Newly added sources appear above the existing ones (newest on top).
      const newItems = accepted.map((f) => ({
        id: ++extraIdRef.current, type: 'file' as const, label: f.name, status: 'uploading' as SourceStatus, progress: 0,
      }))
      setExtraSources((prev) => [...newItems, ...prev])
      newItems.forEach((it) => simulateExtraUpload(it.id))
    }
    if (rejected.length) setMultiHint(duplicateRejectionMessage(rejected))
    e.target.value = '' // allow re-picking the same file
  }

  const saveExtraUrl = () => {
    const u = extraUrl.trim()
    if (!u) return
    // Reject a URL that's already in the session.
    if (existingSourceKeys().has(u.toLowerCase())) {
      setMultiHint(duplicateRejectionMessage([u]))
      setExtraUrl('')
      setAddingUrl(false)
      return
    }
    const id = ++extraIdRef.current
    // Prepend so the newest source sits on top.
    setExtraSources((prev) => [{ id, type: 'url', label: u, status: 'uploading', progress: 0 }, ...prev])
    simulateExtraUpload(id)
    setExtraUrl('')
    setAddingUrl(false)
  }

  const removeExtraSource = (id: number) => {
    if (extraTimersRef.current[id]) {
      window.clearTimeout(extraTimersRef.current[id])
      delete extraTimersRef.current[id]
    }
    setExtraSources((prev) => prev.filter((s) => s.id !== id))
  }

  // Start over after an error (or to pick a different file).
  const startOver = () => {
    reset()
    setPrompt('')
    setSourceLabel('')
    setHeroError('')
    Object.values(extraTimersRef.current).forEach((t) => window.clearTimeout(t))
    extraTimersRef.current = {}
    setExtraSources([])
    setAddingUrl(false)
    setExtraUrl('')
    setMultiHint('')
  }

  // Remove one file from a multi-file upload. Delegates to the hook's `removeFile`,
  // which asks the server to drop just that document (the survivors keep their built
  // indexes — no re-processing). Removing the last file clears the whole upload, so we
  // route that through `startOver` to also reset this component's own state (prompt,
  // any added sources, timers).
  const removeFileAt = (idx: number) => {
    const target = files[idx]
    if (!target) return
    if (files.length <= 1) {
      startOver()
      return
    }
    removeFile(target.name)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    // Allow selecting several files even on the free plan — onDrop trims to the
    // first one and shows the Pro-only notice. (No `maxFiles` here, so extra picks
    // arrive as accepted files rather than 'too-many-files' rejections.)
    multiple: true,
    disabled: started,
  })

  // Mode selection (chat / summary / flashcards / …) + the blurb for the active
  // mode. Rendered identically in two places — below the drop zone before an upload
  // and inside the white chat box once it appears — differing only in the pill's
  // background colour (so it blends with whatever surface it sits on).
  // `spotlightId` namespaces the sliding active-pill `layoutId` per instance. The
  // tabs render in two places (the uploader card and, after upload, the chat box);
  // sharing one layoutId across both makes framer-motion try to animate the pill
  // *between* the two surfaces, which is wrong — each surface keeps its own pill.
  const renderModeTabs = (pillBg: string, spotlightId: string) => (
    <>
      <div className={`flex flex-wrap items-center justify-center gap-1 rounded-3xl border border-[#303030] dark:border-slate-700 p-1 ${pillBg}`}>
        {MODES.map(({ value, label }) => {
          const isActive = selectedMode === value
          return (
            <button
              key={value}
              onClick={() => setSelectedMode(value)}
              className="relative text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
            >
              {isActive && (
                <motion.span
                  layoutId={spotlightId}
                  className="absolute inset-0 rounded-full bg-[#E2611B] shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                />
              )}
              <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B]'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
      <motion.p
        key={selectedMode}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-4 text-center text-[18px] text-[#E2611B]"
      >
        {MODES.find((m) => m.value === selectedMode)?.blurb}
      </motion.p>
    </>
  )

  return (
    // The whole landing page is rendered at 90% scale so every font (and its
    // surrounding chrome) is proportionally smaller by default — i.e. it looks the
    // way the browser does one step down from 100% (Ctrl+-). `zoom` scales all
    // descendants uniformly, so no per-element font size needs touching and nothing
    // is missed. (Kept off the shared Navbar, which lives outside Landing.)
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-grid" style={{ zoom: 0.9 }}>
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Hero headline — always exactly 2 lines, with the break controlled
              explicitly (not left to auto-wrap) so the second line's content is
              consistent as the window scales. Discrete, breakpoint-stepped sizes keep
              it larger than the 18px body at every width.

              The break is a single, monotonic transition:
                • lg and up  → line 1 "Upload files. Paste website links." / line 2 "Ask anything."
                • below lg   → line 1 "Upload files. Paste website" / line 2 "links. Ask anything."
              Because the break below lg is forced (the mobile <br/>), narrowing the
              window never moves "links." back up to line 1 — it stays on line 2 the
              whole way down. Font steps are sized to keep each forced line on one row. */}
          <h1 className="font-merriweather font-extrabold tracking-[-0.03em] text-[#303030] dark:text-slate-100 leading-[1.1] text-[20px] min-[360px]:text-[23px] min-[420px]:text-[27px] min-[520px]:text-[34px] sm:text-[44px] md:text-[56px]">
            {'Upload files. Paste website'}
            <br className="lg:hidden" />
            {' links.'}
            <br className="hidden lg:block" />
            {' '}
            <span className="italic text-[#E2611B] whitespace-nowrap">Ask anything.</span>
          </h1>
          {/* Trust medallions — circular icon-over-label version. Kept commented out in
              favour of the hairline-divider row below; re-enable if we want the medallions.
          <div className="mt-8 flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
            <div className="flex flex-col items-center w-28">
              <div className="w-14 h-14 rounded-full bg-[#E2611B]/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#E2611B]" strokeWidth={2.25} />
              </div>
              <span className="mt-3 font-merriweather font-medium text-[15px] text-slate-700 text-center leading-snug">Nothing stored</span>
            </div>
            <div className="flex flex-col items-center w-28">
              <div className="w-14 h-14 rounded-full bg-[#E2611B]/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#E2611B]" strokeWidth={2.25} />
              </div>
              <span className="mt-3 font-merriweather font-medium text-[15px] text-slate-700 text-center leading-snug">No sign-up needed</span>
            </div>
            <div className="flex flex-col items-center w-28">
              <div className="w-14 h-14 rounded-full bg-[#E2611B]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#E2611B]" strokeWidth={2.25} />
              </div>
              <span className="mt-3 font-merriweather font-medium text-[15px] text-slate-700 text-center leading-snug">Answers only from your file</span>
            </div>
            <div className="flex flex-col items-center w-28">
              <div className="w-14 h-14 rounded-full bg-[#E2611B]/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-[#E2611B]" strokeWidth={2.25} />
              </div>
              <span className="mt-3 font-merriweather font-medium text-[15px] text-slate-700 text-center leading-snug">15+ languages</span>
            </div>
          </div>
          */}
          {/* Trust row — four reassurance signals as inline orange-icon + label items,
              separated by whitespace only (no dividers). Labels use the headline's font
              treatment (Merriweather extrabold, tight tracking, near-black) at a smaller
              size. Wraps on narrow screens. Sits between the headline and (a hidden)
              subheading. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-2 sm:gap-y-3 font-merriweather tracking-[-0.03em] text-[#303030] dark:text-slate-200 text-sm min-[420px]:text-base sm:text-lg md:text-xl lg:text-2xl">
            <span className="inline-flex items-center gap-2 sm:gap-2.5">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#E2611B] shrink-0" strokeWidth={2.25} />
              <span>Nothing stored</span>
            </span>
            <span className="inline-flex items-center gap-2 sm:gap-2.5">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#E2611B] shrink-0" strokeWidth={2.25} />
              <span>No sign-up needed</span>
            </span>
            <span className="inline-flex items-center gap-2 sm:gap-2.5">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#E2611B] shrink-0" strokeWidth={2.25} />
              <span>Answers only from your file</span>
            </span>
          </div>
          {/* Subline hidden for now — re-enable if the hero feels like it needs it.
          <p className="mt-4 font-merriweather text-lg text-[#303030] mx-auto leading-relaxed lg:whitespace-nowrap">
            Upload anything in any language. Get answers in seconds, drawn only from your file.
          </p>
          */}

          {/* Upload card — before an upload starts: drop a file or paste a link.
              Once an upload begins, this morphs into the chat box (below). Widened to
              max-w-3xl so the mode tabs sit on one line at full width (they still wrap
              on narrow screens via flex-wrap). */}
          <div className="mt-10 max-w-3xl mx-auto text-left">
            {/* Plain conditional swap (no AnimatePresence): the mode-tab spotlight's
                layoutId animation prevents framer's exit from ever completing, which
                left the exiting uploader mounted (invisible but occupying space) and
                the chat box never fully taking over. Each side keeps its own entrance
                animation; the outgoing one unmounts immediately. */}
            {!started ? (
                <motion.div
                  key="uploader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Drop zone — accepts a real file and starts the upload right here */}
                  <div
                    {...getRootProps()}
                    id="hero-dropzone"
                    className={`scroll-mt-24 rounded-2xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-all ${
                      isDragActive || dropHighlight ? 'border-[#E2611B] bg-[#E2611B]/5 ring-2 ring-[#E2611B]/30' : 'border-[#303030] dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-[#E2611B] dark:hover:border-[#E2611B] hover:bg-[#E2611B]/5 dark:hover:bg-[#E2611B]/10'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E2611B]/10 mb-4">
                      <ArrowUp className="w-6 h-6 text-[#E2611B]" />
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {isDragActive
                        ? 'Drop your document here'
                        : <>Drop a document, or <span className="text-[#E2611B] underline underline-offset-2">browse to upload</span></>}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">PDF · Word · Excel · PowerPoint</p>
                  </div>

                  {heroError && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-brand-500 px-1">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {heroError}
                    </p>
                  )}

                  {/* OR divider */}
                  <div className="my-5 flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">OR</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>

                  {/* Paste a link */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-[#303030] dark:border-slate-600 bg-white dark:bg-slate-900 px-4 hover:border-[#E2611B] dark:hover:border-[#E2611B] focus-within:border-[#E2611B] focus-within:ring-2 focus-within:ring-[#E2611B]/20 transition-all">
                        <input
                          id="hero-url-input"
                          type="text"
                          value={urlInput}
                          onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                          placeholder="Paste a webpage or video link"
                          className="flex-1 min-w-0 bg-transparent py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleAddUrl}
                        className="px-6 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>
                    {urlError && (
                      <p className="text-xs text-brand-500 px-1">{urlError}</p>
                    )}
                  </div>

                  {/* Mode selection — sits below the drop zone / URL box before upload */}
                  <div className="mt-8">
                    {renderModeTabs('bg-[#F8FAFC] dark:bg-slate-900', 'mode-spotlight-hero')}
                  </div>
                </motion.div>
              ) : (
                // The chat box — appears the moment an upload starts. The user picks
                // what they want to do and types their first request; the Proceed
                // button lights up once the document is ready.
                <motion.div
                  key="chatbox"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
                >
                  {/* Source rows — every source (the first upload and any added
                      file/URL) uses the same SourceRow look: grey card body, a tick
                      once ready, the same spinner + progress while uploading. Newest
                      sits on top, so the first upload is the last row. */}
                  <div className="space-y-2">
                    {extraSources.map((s) => (
                      <SourceRow
                        key={s.id}
                        label={s.label}
                        status={s.status}
                        progress={s.progress}
                        onRemove={() => removeExtraSource(s.id)}
                      />
                    ))}
                    {/* The first upload. When several files were uploaded together we
                        show each filename on its own row so a multi-file upload reads
                        the same as uploading them one by one — each row tracks that
                        file's own status/progress (see `fileRowProps`), and its X
                        removes just that file (re-processing the rest via
                        `removeFileAt`). URL sources have no File, so they fall back to
                        the single friendly `sourceLabel` row. */}
                    {files.length > 0 ? (
                      files.map((f, i) => {
                        const rp = fileRowProps(i)
                        return (
                          <SourceRow
                            key={`${f.name}-${i}`}
                            label={f.name}
                            status={rp.status}
                            progress={rp.progress}
                            statusMsg={rp.statusMsg}
                            onRemove={() => removeFileAt(i)}
                          />
                        )
                      })
                    ) : (
                      <SourceRow
                        label={sourceLabel}
                        status={error ? 'error' : session ? 'ready' : 'uploading'}
                        progress={progress}
                        statusMsg={stageMsg}
                        onRemove={startOver}
                      />
                    )}
                  </div>

                  {error ? (
                    <div className="mt-4 flex flex-col items-start gap-3">
                      <p className="flex items-center gap-1.5 text-sm text-brand-600 bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-2.5 w-full dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                      </p>
                      <button
                        onClick={startOver}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-[#E2611B] text-white hover:bg-[#E2611B]/90 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Try another file
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Add more sources. Controls show for everyone, but only Pro
                          can actually add (non-Pro gets an upgrade hint). Front-end
                          scaffold: added files/URLs show as rows but aren't uploaded
                          or merged into the session yet (see CLAUDE.md). */}
                      <div className="mt-3 space-y-2">
                          {/* Add controls: two "+" buttons, or the URL input box */}
                          {addingUrl ? (
                            <div className="flex items-stretch gap-2">
                              <div className="flex-1 min-w-0 flex items-center rounded-xl border border-[#303030] dark:border-slate-600 bg-white dark:bg-slate-800 px-3 focus-within:border-[#E2611B] focus-within:ring-2 focus-within:ring-[#E2611B]/20 transition-all">
                                <input
                                  type="text"
                                  value={extraUrl}
                                  onChange={(e) => setExtraUrl(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveExtraUrl() } }}
                                  placeholder="Paste a webpage or video link"
                                  autoFocus
                                  className="flex-1 min-w-0 bg-transparent py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                                />
                              </div>
                              <button
                                onClick={saveExtraUrl}
                                className="px-4 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all flex-shrink-0"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setAddingUrl(false); setExtraUrl('') }}
                                aria-label="Cancel"
                                className="w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={openExtraFilePicker}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E2611B] hover:text-[#E2611B]/80 transition-colors"
                              >
                                <Plus className="w-4 h-4" /> Add more files
                              </button>
                              <button
                                onClick={startAddUrl}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E2611B] hover:text-[#E2611B]/80 transition-colors"
                              >
                                <Plus className="w-4 h-4" /> Add more URLs
                              </button>
                            </div>
                          )}

                          {/* Upgrade hint for non-Pro users */}
                          {multiHint && (
                            <p className="text-xs text-[#E2611B] bg-[#E2611B]/5 border border-[#E2611B]/20 rounded-lg px-3 py-2">
                              {multiHint}
                            </p>
                          )}

                          <input
                            ref={extraFileInputRef}
                            type="file"
                            multiple
                            onChange={handleExtraFilesSelected}
                            accept=".pdf,.docx,.xlsx,.pptx,.html,.htm,.json,.csv,.md,.txt"
                            className="hidden"
                          />
                      </div>

                      {/* Chat input + the orange "proceed" button. All guidance lives
                          in the input placeholder (mode-dependent). */}
                      <div className="mt-4 flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-[#E2611B] focus-within:ring-2 focus-within:ring-[#E2611B]/20 transition-all dark:border-slate-700 dark:bg-slate-800/60">
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleProceed()
                            }
                          }}
                          rows={1}
                          placeholder={effectiveMode === 'chat'
                            ? 'Type your first question here.'
                            : 'Add specific instructions here (optional).'}
                          className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                          style={{ maxHeight: '120px' }}
                        />
                        <MicButton
                          onTranscript={(text) =>
                            setPrompt((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                          }
                        />
                        <Tooltip
                          label={proceedPending ? 'Finishing up, one moment…' : canProceed ? 'Proceed' : !session ? 'Hang on, still reading your document' : 'Please enter your first chat on the chatbox.'}
                          side="right"
                        >
                          <motion.button
                            whileHover={canProceed && !proceedPending ? { scale: 1.05 } : undefined}
                            whileTap={canProceed && !proceedPending ? { scale: 0.95 } : undefined}
                            onClick={handleProceed}
                            disabled={!canProceed || proceedPending}
                            aria-label="Proceed"
                            className="w-10 h-10 rounded-full bg-[#E2611B] text-white flex items-center justify-center flex-shrink-0 shadow-sm transition-all hover:bg-[#E2611B]/90 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {proceedPending || (!session && processing)
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <ArrowUp className="w-4 h-4" />}
                          </motion.button>
                        </Tooltip>
                      </div>

                      {/* Mode selection — now lives inside the white box (white pill
                          background so it blends with the card) */}
                      <div className="mt-5">
                        {renderModeTabs('bg-white dark:bg-slate-900', 'mode-spotlight-chat')}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pt-6 pb-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">Features</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] dark:text-slate-100 tracking-[-0.02em]">
            Built to be <span className="italic text-[#E2611B]">trusted.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-[18px] text-slate-500 dark:text-slate-400 italic">Grounded answers, zero storage, no account required.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.08 }}
              className="group font-merriweather bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] dark:hover:bg-[#E2611B] hover:border-[#E2611B] dark:hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              {/* Mobile (single column): icon + title sit side by side. From sm up
                  (multi-column) they stack, icon on top. */}
              <div className="flex items-center gap-3 mb-1.5 sm:block sm:mb-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center sm:mb-4 transition-colors">
                  <f.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-white dark:group-hover:text-white sm:mb-1.5 transition-colors">{f.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-white dark:group-hover:text-white leading-relaxed transition-colors">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">How it works</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] dark:text-slate-100 tracking-[-0.02em]">
            Three steps. <span className="italic text-[#E2611B]">No setup.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-[18px] text-slate-500 dark:text-slate-400 italic">No learning curve, no account, no waiting.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] dark:hover:bg-[#E2611B] hover:border-[#E2611B] dark:hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              {/* Mobile (single column): the number+icon pair and the title sit side
                  by side. From md up (multi-column) the title drops below. */}
              <div className="flex items-center gap-3 mb-1.5 md:block md:mb-0">
                <div className="flex items-center gap-3 shrink-0 md:mb-4">
                  {/* Step number to the left of the icon */}
                  <span className="w-8 h-8 rounded-full bg-[#E2611B] text-white group-hover:bg-white group-hover:text-[#E2611B] text-sm font-bold flex items-center justify-center transition-colors">{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center transition-colors">
                    <s.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
                  </div>
                </div>
                <h3 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-white dark:group-hover:text-white md:mb-1.5 transition-colors">{s.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-white dark:group-hover:text-white leading-relaxed transition-colors">
                {i === 0 ? (
                  <>
                    Have a file? Drop it into the{' '}
                    <Tooltip label="Click here to see where the file needs to be uploaded." side="right">
                      <button
                        type="button"
                        onClick={focusDropZone}
                        className="font-medium text-[#E2611B] underline underline-offset-2 transition-colors group-hover:text-white hover:!text-black"
                      >
                        upload box
                      </button>
                    </Tooltip>{' '}
                    and please wait till the upload is finished. Got a link instead? Paste it into the{' '}
                    <Tooltip label="Click here to see where the link needs to be pasted." side="right">
                      <button
                        type="button"
                        onClick={focusUrlInput}
                        className="font-medium text-[#E2611B] underline underline-offset-2 transition-colors group-hover:text-white hover:!text-black"
                      >
                        URL box
                      </button>
                    </Tooltip>
                    . Works with PDF, Word, Excel, PowerPoint, web pages and videos, in any language.
                  </>
                ) : (
                  s.body
                )}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">Who it's for</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] dark:text-slate-100 tracking-[-0.02em]">
            One tool, <span className="italic text-[#E2611B]">many use cases.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-[18px] text-slate-500 dark:text-slate-400 italic">Grounded in your file, private by default, whatever you’re using it for.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="group font-merriweather bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] dark:hover:bg-[#E2611B] hover:border-[#E2611B] dark:hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              {/* Mobile (single column): icon + title sit side by side. From sm up
                  (multi-column) they stack, icon on top. */}
              <div className="flex items-center gap-3 mb-1.5 sm:block sm:mb-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center sm:mb-4 transition-colors">
                  <a.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-white dark:group-hover:text-white sm:mb-1.5 transition-colors">{a.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-white dark:group-hover:text-white leading-relaxed transition-colors">{a.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Plans — Basic vs Pro feature comparison */}
      <section id="plans" className="scroll-mt-20 px-6 py-16 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">Plans</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] dark:text-slate-100 tracking-[-0.02em]">
            Start free, <span className="italic text-[#E2611B]">upgrade anytime.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-[18px] text-slate-500 dark:text-slate-400 italic">Explore the core features for free. Go Pro for more files, bigger uploads, and file comparisons.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-3 items-center bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="px-4 sm:px-6 py-4 text-[20px] font-bold text-[#303030] dark:text-slate-100">Feature</div>
            <div className="px-3 sm:px-6 py-4 text-center text-[20px] font-bold text-[#303030] dark:text-slate-100">Basic plan</div>
            <div className="px-3 sm:px-6 py-4 text-center text-[20px] font-bold text-[#E2611B] flex items-center justify-center gap-1.5">
              <Crown className="w-4 h-4 flex-shrink-0" /> Pro plan
            </div>
          </div>

          {/* Feature rows */}
          {PLAN_FEATURES.map((f) => (
            <div
              key={f.name}
              className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-3 items-center bg-white dark:bg-slate-900"
            >
              <div className="px-4 sm:px-6 py-3.5 text-sm font-normal text-slate-700 dark:text-slate-300">{f.name}</div>
              <div className="px-3 sm:px-6 py-3.5 flex justify-center">
                {f.basic
                  ? <Check className="w-5 h-5 text-[#E2611B]" aria-label="Included" />
                  : <X className="w-5 h-5 text-[#E2611B]" aria-label="Not included" />}
              </div>
              <div className="px-3 sm:px-6 py-3.5 flex justify-center">
                {f.pro
                  ? <Check className="w-5 h-5 text-[#E2611B]" aria-label="Included" />
                  : <X className="w-5 h-5 text-[#E2611B]" aria-label="Not included" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#E2611B] text-slate-50 px-6 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 sm:gap-8">
            {/* Brand — inverted wordmark for the orange surface (see CLAUDE.md) */}
            <div className="max-w-sm">
              <div className="flex items-center gap-1">
                <img
                  src={markWhite}
                  alt="Talktofile"
                  className="w-14 h-14 sm:w-16 sm:h-16"
                />
                <span className="-ml-3 font-brand italic font-bold text-[26px] sm:text-[34px] tracking-[-0.02em] text-slate-50">
                  Talktofile
                </span>
              </div>
            </div>

            {/* Quick links */}
            <nav className="flex flex-col gap-2 sm:gap-2.5 text-sm">
              <span className="font-semibold text-slate-50">Product</span>
              <a
                href="#how-it-works"
                onClick={(e) => { e.preventDefault(); smoothScrollTo('how-it-works', { offset: 80 }) }}
                className="text-slate-50/80 hover:text-slate-50 transition-colors"
              >
                How it works
              </a>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="mt-6 pt-5 sm:mt-10 sm:pt-6 border-t border-slate-50/20 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-sm text-slate-50/80">
            <span>© {new Date().getFullYear()} MetaInsights. All rights reserved.</span>
            <span>Private by default · No file storage · Answers only from your document</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
