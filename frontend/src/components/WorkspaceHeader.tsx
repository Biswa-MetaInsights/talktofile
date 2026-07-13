import { useRef, useState, type ChangeEvent } from 'react'
import { FileText, Files, GitCompare, PanelLeftClose, PanelLeftOpen, Share2, Check, Download, Plus, Link2, X, LogOut, ScrollText, AlertCircle } from 'lucide-react'
import { MODE_LABELS } from './ModeSwitcher'
import type { SessionInfo, AppMode } from '../types'
import { useAuth } from '../context/AuthContext'

interface Props {
  session: SessionInfo
  // The active tool section — its name is shown as the header title.
  mode: AppMode
  onEndSession: () => void
  // Left overview panel collapse state + toggle (owned by AppShell). The header hosts
  // the show/hide control for it.
  sidebarHidden: boolean
  onToggleSidebar: () => void
  // Original-document panel open state + toggle (owned by AppShell). This header hosts a
  // show/hide control for it so it's reachable from every section, not just via the sidebar.
  docPanelOpen: boolean
  onToggleDocPanel: () => void
  // Header actions on the CURRENTLY OPEN section. Each tool view registers both with
  // AppShell: `onShare` opens the native share sheet / clipboard with the section's TEXT
  // (podcast script, translation, …) and resolves to how it was handled; `onExport` opens
  // a print / Save-as-PDF view of the section. `canAct` is false until that section has
  // content (undefined handlers otherwise).
  onShare: () => Promise<'shared' | 'copied'> | undefined
  onExport: () => void
  canAct: boolean
}

const PRO_HINT = 'Interacting with multiple files in a single conversation is a Pro feature.'

// Section-specific scope warnings shown inline next to the header title, so the
// caveats live right where the section is named (Translate = text-only; Charts =
// spreadsheets only). Keyed by mode; sections without an entry show no warning.
const MODE_WARNINGS: Partial<Record<AppMode, string>> = {
  translate: 'Translation covers text only. Images, charts, and scanned pages cannot be translated.',
  charts: 'Charts cover spreadsheets only (.xlsx and .csv files).',
}

// The shared workspace top bar. It duplicates every property of the chat header row
// (file icon + title, status line, View-summaries drawer, Share, Export, Add files/URLs,
// End session) so the tool sections (summary, flashcards, slides, translate, podcast,
// charts) look and behave consistently with the chat. Chat keeps its own inline header
// (the reference); this is a self-contained copy for the other sections. Both Share and
// Export now act on the currently open section: Share opens the native share sheet /
// clipboard with the section's text, Export opens a print / Save-as-PDF view of it.
export default function WorkspaceHeader({ session, mode, onEndSession, sidebarHidden, onToggleSidebar, docPanelOpen, onToggleDocPanel, onShare, onExport, canAct }: Props) {
  const { user } = useAuth()
  const isPro = user?.plan === 'pro'
  const [shared, setShared] = useState<'shared' | 'copied' | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [extraUrl, setExtraUrl] = useState('')
  const [addHint, setAddHint] = useState('')
  const [extraSources, setExtraSources] = useState<{ id: number; type: 'file' | 'url'; label: string }[]>([])
  const extraFileInputRef = useRef<HTMLInputElement>(null)
  const extraIdRef = useRef(0)
  const addHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const docs = session.documents
  const HeaderIcon = session.mode === 'compare' ? GitCompare : session.mode === 'multi' ? Files : FileText
  // The header row shows the active section name (Summary / Flashcards / …) instead of the
  // filename. The filename(s) stay reachable via the hover tooltip and the left panel.
  const headerTitle = MODE_LABELS[mode]
  const nonEnglishCount = docs.filter((d) => d.original_language && d.original_language !== 'en').length

  // ── Add more sources (Pro only; additive — never removes the current file) ──
  // Phase 2: adding files/URLs mid-session isn't wired to the backend yet, so both
  // entry points just surface "Coming soon!" — no file picker, no URL input box.
  // (The scaffold below — URL box, source chips, handlers — is kept for when a
  // backend add-to-session endpoint lands; restore the picker/URL behaviour then.)
  const showComingSoon = () => {
    setAddingUrl(false)
    setAddHint('Coming soon!')
    if (addHintTimerRef.current) clearTimeout(addHintTimerRef.current)
    addHintTimerRef.current = setTimeout(() => setAddHint(''), 10000)
  }
  const openAddFiles = () => showComingSoon()
  const startAddUrl = () => showComingSoon()
  const onExtraFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) {
      setExtraSources((prev) => [
        ...picked.map((f) => ({ id: ++extraIdRef.current, type: 'file' as const, label: f.name })),
        ...prev,
      ])
    }
    e.target.value = ''
  }
  const saveExtraUrl = () => {
    const u = extraUrl.trim()
    if (!u) return
    setExtraSources((prev) => [{ id: ++extraIdRef.current, type: 'url', label: u }, ...prev])
    setExtraUrl('')
    setAddingUrl(false)
  }
  const removeExtra = (id: number) => setExtraSources((prev) => prev.filter((s) => s.id !== id))

  // Share the open section's TEXT via the native share sheet / clipboard, then briefly
  // show a tick reflecting how it was handled ("shared" vs "copied").
  const handleShare = async () => {
    if (!canAct) return
    const how = await onShare()
    if (how) {
      setShared(how)
      setTimeout(() => setShared(null), 2000)
    }
  }

  return (
    <div className="flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0 dark:bg-brand-600/15 dark:border-brand-600/30">
            <HeaderIcon className="w-4 h-4 text-brand-500" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 dark:text-slate-100 text-sm font-medium truncate" title={docs.map((d) => d.filename).join(', ')}>{headerTitle}</p>
            {(session.mode === 'compare' || nonEnglishCount > 0) && (
              <div className="flex items-center gap-2">
                {session.mode === 'compare' && <span className="text-xs text-brand-500">Compare mode</span>}
                {nonEnglishCount > 0 && (
                  <span className="text-xs text-brand-500">{session.mode === 'compare' ? '· ' : ''}answers in English</span>
                )}
              </div>
            )}
          </div>
          {/* Section scope warning (translate/charts) — sits right after the title so the
              caveat reads with the section name. Shown ONLY on the largest screens (`xl`+); on
              smaller widths it crowded the header actions, so it's hidden there. */}
          {MODE_WARNINGS[mode] && (
            <div className="hidden xl:flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{MODE_WARNINGS[mode]}</span>
            </div>
          )}
        </div>
        <div className="relative flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="hidden lg:inline-flex items-center justify-center p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15"
            title={sidebarHidden ? 'View overview' : 'Hide overview'}
          >
            {sidebarHidden ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleDocPanel}
            className={`p-1.5 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 ${docPanelOpen ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/15' : 'text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400'}`}
            title={docPanelOpen ? 'Hide the original document' : 'See the original document'}
          >
            <ScrollText className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            disabled={!canAct}
            className="flex items-center gap-1 p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title={canAct ? `Share ${MODE_LABELS[mode]}` : `Generate ${MODE_LABELS[mode]} first to share it`}
          >
            {shared ? <Check className="w-4 h-4 text-[#E2611B]" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onExport}
            disabled={!canAct}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title={canAct ? `Download ${MODE_LABELS[mode]} as a pdf` : `Generate ${MODE_LABELS[mode]} first to download it`}
          >
            <Download className="w-4 h-4" />
          </button>
          <div>
            <button
              onClick={() => { setShowAddMenu((v) => !v); setAddHint(''); setAddingUrl(false) }}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-600/15"
              title="Add files or URLs"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showAddMenu && (
              <>
                {/* Click-away backdrop */}
                <div className="fixed inset-0 z-30" onClick={() => { setShowAddMenu(false); setAddingUrl(false) }} />
                <div className={`absolute right-0 mt-2 z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/60 dark:shadow-black/40 p-3 space-y-2 ${
                  // The whole button group is the positioning context (relative), so
                  // right-0 pins the popover's right edge to End session's right edge.
                  // Widen it while adding a URL so the box + its Add button run longer.
                  addingUrl ? 'w-80' : 'w-64'
                }`}>
                  {extraSources.length > 0 && (
                    <div className="space-y-1.5">
                      {extraSources.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5">
                          {s.type === 'url'
                            ? <Link2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                            : <FileText className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={s.label}>{s.label}</span>
                          <button onClick={() => removeExtra(s.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingUrl ? (
                    <div className="flex items-stretch gap-1.5">
                      <input
                        type="text"
                        value={extraUrl}
                        onChange={(e) => setExtraUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveExtraUrl() } }}
                        placeholder="Paste a link"
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-400"
                      />
                      <button onClick={saveExtraUrl} className="px-2.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors flex-shrink-0">
                        Add
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button onClick={openAddFiles} className="w-full flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-white hover:bg-brand-50 dark:hover:bg-brand-600/15 rounded-lg px-2 py-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Add files
                      </button>
                      <button onClick={startAddUrl} className="w-full flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-white hover:bg-brand-50 dark:hover:bg-brand-600/15 rounded-lg px-2 py-1.5 transition-colors">
                        <Plus className="w-4 h-4" /> Add URLs
                      </button>
                    </div>
                  )}

                  {addHint && (
                    <p className="text-xs text-[#E2611B] bg-[#E2611B]/5 border border-[#E2611B]/20 rounded-lg px-2.5 py-1.5">
                      {addHint}
                    </p>
                  )}
                </div>
              </>
            )}

            <input
              ref={extraFileInputRef}
              type="file"
              multiple
              onChange={onExtraFilesSelected}
              accept=".pdf,.docx,.xlsx,.pptx,.html,.htm,.json,.csv,.md,.txt"
              className="hidden"
            />
          </div>
          <button
            onClick={onEndSession}
            className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30"
            title="End this session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">End session</span>
          </button>
        </div>
      </div>
    </div>
  )
}
