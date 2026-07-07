import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { FileRejection } from 'react-dropzone'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Globe, Check, ChevronRight } from 'lucide-react'
import Navbar from './components/Navbar'
import UploadZone from './components/UploadZone'
import ChatWindow from './components/ChatWindow'
import WorkspaceHeader from './components/WorkspaceHeader'
import AuthModal from './components/AuthModal'
import SummaryCard from './components/SummaryCard'
import DocumentPanel from './components/DocumentPanel'
import Tooltip from './components/Tooltip'
import ConfirmDialog from './components/ConfirmDialog'
import FeedbackModal from './components/FeedbackModal'
import Landing from './components/Landing'
import IntroOfferBanner from './components/IntroOfferBanner'
import { useAuth } from './context/AuthContext'
import { isProgrammaticReload, documentApi } from './api/client'
import { smoothScrollTo } from './lib/smoothScroll'
import type { SessionInfo, AppMode } from './types'

const SummaryView = lazy(() => import('./components/SummaryView'))
const FlashcardsView = lazy(() => import('./components/FlashcardsView'))
const TranslateView = lazy(() => import('./components/TranslateView'))
const PodcastView = lazy(() => import('./components/PodcastView'))
const SlidesView = lazy(() => import('./components/SlidesView'))
const ChartsView = lazy(() => import('./components/ChartsView'))

type AuthModalState = { open: boolean; mode: 'subscribe' | 'login'; notice?: string }

// The non-chat sections, in tab order. Each stays mounted once visited so its
// generated content survives switching away and back.
const TOOL_MODES: AppMode[] = ['summary', 'flashcards', 'slides', 'translate', 'podcast', 'charts']

// A reload / tab-close happens outside our control (the browser owns the native
// "Reload site?" prompt), so we can't open our modal mid-unload. Instead the
// beforeunload guard drops this flag; if the page actually unloads, it survives to
// the next load and we open the feedback form then. If the user cancels the reload,
// the guard clears it again (see the beforeunload effect).
const PENDING_FEEDBACK_KEY = 'ttf_pending_feedback'

// The intro-offer banner is shown at most once per browser session, and no more often
// than once every 3 days. This stores the last-shown epoch time (ms); it re-shows once
// the cooldown has elapsed.
const INTRO_OFFER_SEEN_KEY = 'ttf_intro_offer_seen'
const INTRO_OFFER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

// How long after the user's first action (first chat answer / generated summary /
// flashcards / podcast script, etc.) the intro-offer banner appears.
const INTRO_OFFER_DELAY_MS = 5_000

// The left details panel is drag-resizable (like a standard resizable sidebar). These bound
// its width in px: DEFAULT is the "standard size" it opens at (matches the old w-72), and a
// drag narrower than COLLAPSE snaps it shut (sidebarHidden) — the header toggle reopens it at
// DEFAULT. Double-clicking the drag handle also resets to DEFAULT.
const SIDEBAR_DEFAULT_WIDTH = 288
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 560
const SIDEBAR_COLLAPSE_WIDTH = 180

function AppShell({ showToast, signupNonce, onFirstAction }: { showToast: (message: string) => void; signupNonce: number; onFirstAction: () => void }) {
  const { recoveryMode, sessionExpired, clearSessionExpired } = useAuth()
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [authModal, setAuthModal] = useState<AuthModalState>({ open: false, mode: 'subscribe' })
  const [confirmLeave, setConfirmLeave] = useState(false)
  // When true, the feedback form is shown automatically because a session just
  // closed (End session, "Leave this chat?", or a reload/tab-close — see below).
  const [feedbackPrompt, setFeedbackPrompt] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<'landing' | 'app'>('landing')
  const [pendingUpload, setPendingUpload] = useState<{ accepted: File[]; rejections: FileRejection[] } | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  // The mode selected on the Landing page — drives which view shows after upload.
  const [selectedMode, setSelectedMode] = useState<AppMode>('chat')
  // viewMode can be switched to 'chat' from any tool view via "Start chatting".
  const [viewMode, setViewMode] = useState<AppMode>('chat')
  // The user's first request, typed on the landing chat box — auto-sent by ChatWindow.
  const [initialPrompt, setInitialPrompt] = useState('')
  // Sections the user has opened at least once. Their views stay mounted (hidden) so
  // switching between tabs never loses generated content — true browser-tab behaviour.
  // Chat is always mounted, so it doesn't need tracking here.
  const [visited, setVisited] = useState<Set<AppMode>>(() => new Set(['chat']))
  // Sections the user has actually produced content in (chatted, generated flashcards,
  // …). These get a star + "pick up where you left off" tooltip on their tab.
  const [engaged, setEngaged] = useState<Set<AppMode>>(() => new Set())
  // Which file's overview the left panel is showing, when there's more than one file.
  const [activeOverview, setActiveOverview] = useState(0)
  // The document whose full original text is open in the slide-in panel (null = closed).
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  // The left details panel (document + overview) can be collapsed and pulled back out at
  // any time via the header toggle. It defaults to visible (on lg+ screens, where the
  // panel exists); hiding it only lasts for the current session — a reload starts visible.
  const [sidebarHidden, setSidebarHidden] = useState(false)
  // The left panel's current width in px (drag-resizable — see the edge handle below). Starts
  // at the standard width; a drag persists for the session only, like sidebarHidden.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  // True only while the user is actively dragging the resize handle — used to highlight the
  // handle and to suppress transitions/selection during the drag.
  const [resizingSidebar, setResizingSidebar] = useState(false)

  // Begin a drag on the panel's right-edge handle. Tracks the mouse on window (so the drag
  // continues even if the cursor outruns the thin handle), clamps the width to [MIN, MAX], and
  // snaps the panel shut if dragged narrower than COLLAPSE (reopened at DEFAULT via the header
  // toggle). Body cursor/selection are locked for the duration so the whole page reads as a drag.
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    setResizingSidebar(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const stop = () => {
      setResizingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', stop)
    }
    const onMove = (ev: MouseEvent) => {
      const next = startWidth + (ev.clientX - startX)
      if (next < SIDEBAR_COLLAPSE_WIDTH) {
        // Dragged too narrow — minimise it. Reset the stored width so the header toggle
        // reopens it at the standard size.
        setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
        setSidebarHidden(true)
        stop()
        return
      }
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next)))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stop)
  }

  // Switch the active section, remembering that it's now been opened (so its view is
  // kept mounted). This is what the feature tabs call — same effect as picking the
  // section on the Landing page, but on the live session.
  const switchMode = (mode: AppMode) => {
    setViewMode(mode)
    setVisited((prev) => (prev.has(mode) ? prev : new Set(prev).add(mode)))
  }
  // The very first time the user produces content in any section (their first chat
  // answer / generated summary / flashcards / podcast script, whichever mode they chose
  // on the home page), tell App so it can schedule the intro-offer banner. Guarded to
  // fire once per AppShell mount; App additionally gates it to once-per-day + not-signed-up.
  const firstActionRef = useRef(false)
  // Mark a section as having produced content (idempotent) → earns its tab a star.
  const markEngaged = (mode: AppMode) => {
    if (!firstActionRef.current) {
      firstActionRef.current = true
      onFirstAction()
    }
    setEngaged((prev) => (prev.has(mode) ? prev : new Set(prev).add(mode)))
  }

  // The landing page now uploads + processes the document itself, then hands us a
  // ready session along with the chosen mode and the user's first message. We drop
  // straight into the workspace — no separate upload step.
  const enterWorkspace = (s: SessionInfo, mode: AppMode, prompt: string) => {
    setSelectedMode(mode)
    setViewMode(mode)
    setInitialPrompt(prompt)
    setVisited(new Set<AppMode>(['chat', mode]))
    setEngaged(new Set())
    setPendingUpload(null)
    setPendingUrl(null)
    setOpenDoc(null)
    setSession(s)
    setView('app')
  }

  // Open the feedback form. Called whenever a session closes in-app, so we ask for
  // feedback at the natural end of a session (chat, summary, flashcards, …).
  const promptFeedback = () => setFeedbackPrompt(true)

  // A session was closed by a reload/tab-close on the previous page load (the guard
  // left PENDING_FEEDBACK_KEY behind). Ask for feedback now, then clear the flag so
  // it fires only once.
  useEffect(() => {
    if (localStorage.getItem(PENDING_FEEDBACK_KEY)) {
      localStorage.removeItem(PENDING_FEEDBACK_KEY)
      setFeedbackPrompt(true)
    }
  }, [])

  // When the user returns via a password-reset link, drop them into the app and
  // open the modal (which shows the "set new password" form).
  useEffect(() => {
    if (recoveryMode) {
      setView('app')
      setAuthModal({ open: true, mode: 'login' })
    }
  }, [recoveryMode])

  // A session expired mid-use (a 401 was handled gracefully under the hood — the
  // app is now a guest). Invite the user to sign in again, without losing context.
  useEffect(() => {
    if (sessionExpired) {
      setAuthModal({ open: true, mode: 'login', notice: 'Your session expired. Please sign in again to continue.' })
    }
  }, [sessionExpired])

  // "Sign up free" on the first-load intro-offer banner bumps signupNonce — open the
  // subscribe modal in response. Guarded by > 0 so it never fires on initial mount.
  useEffect(() => {
    if (signupNonce > 0) setAuthModal({ open: true, mode: 'subscribe' })
  }, [signupNonce])

  // Close the auth modal and clear any session-expired notice together, so the
  // banner can't linger on a later, unrelated open.
  const closeAuth = () => {
    setAuthModal((s) => ({ ...s, open: false, notice: undefined }))
    clearSessionExpired()
  }

  // Guard against an accidental refresh or tab-close while work would be lost:
  // either a document chat is active, or a file is mid-upload/processing. The
  // session and the upload both live in memory only, so a reload throws them
  // away. The browser shows its own generic "Leave site? / Reload site?"
  // confirmation; the wording can't be customised.
  useEffect(() => {
    if (!session && !uploading) return
    const handler = (e: BeforeUnloadEvent) => {
      // Don't intercept a reload the app started itself (e.g. recovering from an
      // expired session on a 401) — only accidental, user-initiated reloads.
      if (isProgrammaticReload()) return
      e.preventDefault()
      e.returnValue = ''
      // The user is trying to leave with a live session. Drop a flag so that, if
      // they confirm the reload/close, the next load asks for feedback. If they
      // cancel and stay, the page keeps running and this timeout clears the flag
      // (a truly-unloaded page never runs it, so the flag only survives a real exit).
      localStorage.setItem(PENDING_FEEDBACK_KEY, '1')
      setTimeout(() => localStorage.removeItem(PENDING_FEEDBACK_KEY), 0)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [session, uploading])

  const handleReset = () => { setSession(null); setViewMode('chat'); setVisited(new Set(['chat'])); setEngaged(new Set()); setPendingUpload(null); setPendingUrl(null); setOpenDoc(null) }
  // "End session" (from the chat header or a tool-view WorkspaceHeader) drops the
  // session and returns the user to the home page — not back to the upload screen.
  const endToHome = () => { setSession(null); setOpenDoc(null); goLanding(); promptFeedback() }
  // Tool-view WorkspaceHeader's End session: also drop the server-side session first.
  const endWorkspaceSession = () => {
    if (session) documentApi.deleteSession(session.session_id).catch(() => {})
    endToHome()
  }
  const goLanding = () => {
    setPendingUpload(null)
    setPendingUrl(null)
    setSelectedMode('chat')
    setViewMode('chat')
    setVisited(new Set(['chat']))
    setEngaged(new Set())
    setInitialPrompt('')
    setView('landing')
  }
  // The logo returns to the landing page. Mid-chat it confirms first (the
  // conversation would be lost); otherwise it goes straight to the landing.
  const handleHome = () => {
    if (session) setConfirmLeave(true)
    else goLanding()
  }
  // "How it works" nav link: land on the home page and scroll to that section.
  // Mid-chat we confirm first (same as Home), since leaving loses the conversation.
  const handleHowItWorks = () => {
    if (session) { setConfirmLeave(true); return }
    goLanding()
    setTimeout(() => {
      smoothScrollTo('how-it-works', { offset: 80 })
    }, 50)
  }
  const openAuth = (mode: 'subscribe' | 'login' = 'subscribe') => setAuthModal({ open: true, mode })

  // The document the header "original document" toggle acts on — the one whose overview
  // is currently shown in the left panel (first file when single). Toggling closes the
  // panel if any document is already open, else opens this one.
  const activeDocName = session
    ? session.documents[Math.min(activeOverview, session.documents.length - 1)]?.filename
    : undefined
  const toggleDocPanel = () => setOpenDoc((cur) => (cur ? null : activeDocName ?? null))

  if (view === 'landing' && !session) {
    return (
      <>
        <Navbar onOpenAuth={openAuth} onHome={goLanding} onHowItWorks={handleHowItWorks} onSignedOut={() => showToast('Sign out successful')} atHome />
        <Landing onEnter={enterWorkspace} onBusyChange={setUploading} />
        {authModal.open && (
          <AuthModal
            initialMode={authModal.mode}
            notice={authModal.notice}
            onClose={closeAuth}
            onAuthSuccess={showToast}
          />
        )}
        {feedbackPrompt && <FeedbackModal onClose={() => setFeedbackPrompt(false)} />}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-grid relative overflow-x-hidden">
      <Navbar onOpenAuth={openAuth} onHome={handleHome} onHowItWorks={handleHowItWorks} onSignedOut={() => showToast('Sign out successful')} />

      <main className="relative z-10 pt-16 min-h-screen flex overflow-x-hidden">
        <AnimatePresence mode="wait">
          {!session ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col"
            >
              <UploadZone
                onReady={(s) => { setSession(s); setViewMode(selectedMode); setVisited(new Set<AppMode>(['chat', selectedMode])); setEngaged(new Set()) }}
                onRequireUpgrade={() => openAuth('subscribe')}
                onBusyChange={setUploading}
                initialFiles={pendingUpload?.accepted}
                initialRejections={pendingUpload?.rejections}
                initialUrl={pendingUrl ?? undefined}
                selectedMode={selectedMode}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex-1 flex flex-col lg:flex-row gap-0 min-h-0 h-[calc(100dvh-4rem)] overflow-hidden"
            >
              {/* Left details panel: document(s) info + overview. Collapsible — hidden when
                  sidebarHidden, and pulled back out via the edge handle on the main panel. */}
              {!sidebarHidden && (
              <div
                className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 relative ${resizingSidebar ? '' : 'transition-[width] duration-150'}`}
                style={{ width: sidebarWidth, maxHeight: 'calc(100dvh - 4rem)' }}
              >
                <div className="flex flex-col p-5 gap-4 overflow-y-auto scrollbar-thin min-h-0 flex-1">
                <div className="glass-card rounded-2xl p-4">
                  <div className="space-y-2">
                    {/* Each filename is a clickable brand-orange link that toggles the full
                        original document in a slide-in panel (like citation "Jump to source"):
                        click to show it, click again to hide it. */}
                    {session.documents.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                        <Tooltip
                          label={openDoc === d.filename ? 'Click here to hide the original document' : 'Click here to see the original document'}
                          side="bottom"
                          className="min-w-0 flex-1"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              // Drop focus after clicking so the tooltip (which also shows on
                              // focus-within for keyboard users) doesn't linger once the cursor
                              // leaves the name.
                              e.currentTarget.blur()
                              setOpenDoc((cur) => (cur === d.filename ? null : d.filename))
                            }}
                            className="text-brand-600 dark:text-brand-400 text-sm font-medium truncate w-full text-left hover:underline hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                          >
                            {d.filename}
                          </button>
                        </Tooltip>
                        {d.original_language && d.original_language !== 'en' && (
                          <span className="flex items-center gap-0.5 text-[10px] text-brand-600">
                            <Globe className="w-2.5 h-2.5" />{d.original_language.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overview card. With more than one file it's switchable: a button per file
                    (only shown when documents.length > 1) swaps which file's overview is shown. */}
                {(() => {
                  const docs = session.documents
                  const multi = docs.length > 1
                  const idx = Math.min(activeOverview, docs.length - 1)
                  const d = docs[idx]
                  const hasContent = d?.summary?.overview || d?.summary?.key_points?.length
                  return (
                    <div className="glass-card rounded-2xl p-4">
                      {multi && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {docs.map((doc, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveOverview(i)}
                              aria-pressed={i === idx}
                              title={doc.filename}
                              className={`flex items-center gap-1 max-w-full text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                i === idx
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:border-brand-600/40 dark:hover:text-brand-300'
                              }`}
                            >
                              <FileText className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{doc.filename}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <h3 className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2.5 truncate" title={d?.filename}>
                        {multi ? d?.filename : 'Overview'}
                      </h3>
                      {hasContent
                        ? <SummaryCard summary={d.summary} compact />
                        : <p className="text-xs text-slate-400 dark:text-slate-500">No overview available for this file.</p>}
                    </div>
                  )
                })()}
                </div>

                {/* Right-edge resize handle. Hover shows the ↔ resize cursor; drag adjusts the
                    panel width, drag narrow to minimise, double-click to reset to standard size.
                    Straddles the border (translate-x-1/2) and sits above content via z-index. */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize · double-click to reset · drag left to minimise"
                  onMouseDown={startSidebarResize}
                  onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
                  className="group absolute top-0 right-0 z-30 h-full w-2 translate-x-1/2 cursor-col-resize flex justify-center"
                >
                  <div className={`h-full w-0.5 transition-colors ${resizingSidebar ? 'bg-brand-500' : 'bg-transparent group-hover:bg-brand-400/70'}`} />
                </div>
              </div>
              )}

              {/* Left-edge "put it back" tab — shown only while the panel is minimised. Sits on the
                  workspace's left border and reopens the panel at its standard width. The header
                  toggle does the same; this is the on-the-border affordance. lg+ only (the panel is). */}
              {sidebarHidden && (
                <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 z-30">
                  <Tooltip label="Show the overview panel" side="right">
                    <button
                      type="button"
                      onClick={() => setSidebarHidden(false)}
                      aria-label="Show the overview panel"
                      className="flex items-center justify-center w-6 h-16 rounded-r-xl border border-l-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-brand-600 hover:border-brand-300 dark:hover:text-brand-400 shadow-sm transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Full original-document panel. Sits in-flow between the sidebar and the
                  main panel (like the citation "Jump to source" panel) so the chat/tool
                  view shrinks to make room rather than being covered. */}
              <AnimatePresence>
                {openDoc && (
                  <DocumentPanel
                    sessionId={session.session_id}
                    filename={openDoc}
                    onClose={() => setOpenDoc(null)}
                  />
                )}
              </AnimatePresence>

              {/* Main panel — switches between chat and tool views */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-slate-50 dark:bg-slate-950">
                <div className="flex-1 glass-card m-3 lg:m-4 rounded-2xl flex flex-col min-h-0 overflow-hidden">
                  {/* Chat stays mounted across tab switches (hidden, not unmounted) so the
                      conversation, WebSocket and history survive when the user hops to
                      another section and back — true browser-tab behaviour. It keeps its
                      own inline header (the reference layout) and renders the tab bar itself. */}
                  <div className={viewMode === 'chat' ? 'flex-1 min-h-0 overflow-hidden' : 'hidden'}>
                    <ChatWindow
                      session={session}
                      onReset={endToHome}
                      // Only auto-send the landing prompt when the user actually entered
                      // via Chat. Chat now stays mounted under the tool views, so a prompt
                      // typed alongside a non-chat mode must not silently fire in the
                      // background.
                      initialPrompt={selectedMode === 'chat' ? initialPrompt : ''}
                      activeMode={viewMode}
                      onSwitchMode={switchMode}
                      engagedModes={engaged}
                      onActivity={() => markEngaged('chat')}
                      sidebarHidden={sidebarHidden}
                      onToggleSidebar={() => setSidebarHidden((v) => !v)}
                      docPanelOpen={!!openDoc}
                      onToggleDocPanel={toggleDocPanel}
                    />
                  </div>

                  {/* Tool layer — shared header + persistent views + tabs. Every visited
                      tool section stays mounted (hidden when not active) so its generated
                      content survives switching away. The whole layer is hidden while chat
                      is active, but kept mounted so that content isn't lost. */}
                  {TOOL_MODES.some((m) => visited.has(m)) && (
                    <div className={viewMode !== 'chat' ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'hidden'}>
                      <WorkspaceHeader session={session} mode={viewMode} onEndSession={endWorkspaceSession} sidebarHidden={sidebarHidden} onToggleSidebar={() => setSidebarHidden((v) => !v)} docPanelOpen={!!openDoc} onToggleDocPanel={toggleDocPanel} />
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {TOOL_MODES.filter((m) => visited.has(m)).map((m) => (
                          <div key={m} className={viewMode === m ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'hidden'}>
                            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>}>
                              {m === 'summary' ? (
                                <SummaryView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('summary')} autoGenerate={selectedMode === 'summary'} />
                              ) : m === 'flashcards' ? (
                                <FlashcardsView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('flashcards')} autoGenerate={selectedMode === 'flashcards'} />
                              ) : m === 'translate' ? (
                                // Translate is intentionally excluded from auto-run — it needs a target
                                // language choice first (like chat needs a typed prompt), so it keeps its
                                // manual "Translate to <language>" button even when entered from Landing.
                                <TranslateView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('translate')} />
                              ) : m === 'podcast' ? (
                                <PodcastView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('podcast')} autoGenerate={selectedMode === 'podcast'} />
                              ) : m === 'slides' ? (
                                <SlidesView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('slides')} autoGenerate={selectedMode === 'slides'} />
                              ) : m === 'charts' ? (
                                <ChartsView session={session!} onSwitchMode={switchMode} engagedModes={engaged} onActivity={() => markEngaged('charts')} autoGenerate={selectedMode === 'charts'} />
                              ) : null}
                            </Suspense>
                          </div>
                        ))}
                      </div>
                      {/* Every tool section now renders its own bottom bar (its picker/generate
                          button in the send-button spot + tabs), so the shared WorkspaceComposer
                          is no longer used here. */}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {authModal.open && (
        <AuthModal
          initialMode={authModal.mode}
          notice={authModal.notice}
          onClose={closeAuth}
          onAuthSuccess={showToast}
        />
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this chat?"
        message="Your conversation and the uploaded document will be cleared. This can't be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmLeave(false); setSession(null); goLanding(); promptFeedback() }}
        onCancel={() => setConfirmLeave(false)}
      />

      {feedbackPrompt && <FeedbackModal onClose={() => setFeedbackPrompt(false)} />}
    </div>
  )
}

export default function App() {
  const { isLoading, user } = useAuth()
  // Transient confirmation toast (e.g. "Sign in successful" / "Sign out successful").
  // Lives here, above AppShell, so it survives the brief user→null→guest remount that
  // signing out triggers (AppShell unmounts during that window).
  const [toast, setToast] = useState('')
  // Bumped when the intro-offer banner's "Sign up free" is clicked; AppShell watches it
  // and opens the subscribe modal.
  const [signupNonce, setSignupNonce] = useState(0)

  // The intro-offer banner now appears 10s AFTER the user's first action (their first
  // chat answer / generated summary / flashcards / podcast script, whichever they chose
  // on the home page) — not on load. It shows once per browser session, and no more often
  // than once every 3 days, and only for users who haven't signed up.
  const [showIntroOffer, setShowIntroOffer] = useState(false)
  const introFiredRef = useRef(false)
  const introTimerRef = useRef<ReturnType<typeof setTimeout>>()
  // Latest user, readable at the timer's fire time (they may sign up during the delay).
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  // Called once per session, the first time the user produces content in any section. If
  // they haven't signed up and the 3-day cooldown has elapsed, show it after a delay.
  const handleFirstAction = () => {
    if (introFiredRef.current) return // once per session
    introFiredRef.current = true
    if (user && !user.is_guest) return // already signed up — don't nag them
    try {
      const last = Number(localStorage.getItem(INTRO_OFFER_SEEN_KEY))
      if (last && Date.now() - last < INTRO_OFFER_COOLDOWN_MS) return // still in cooldown
    } catch {
      // localStorage unavailable (privacy mode / blocked) — fall through and show.
    }
    introTimerRef.current = setTimeout(() => {
      // Re-check sign-up at fire time — they may have signed up during the delay.
      if (userRef.current && !userRef.current.is_guest) return
      try {
        localStorage.setItem(INTRO_OFFER_SEEN_KEY, String(Date.now()))
      } catch {
        /* best effort — worst case it shows again next visit */
      }
      setShowIntroOffer(true)
    }, INTRO_OFFER_DELAY_MS)
  }
  useEffect(() => () => clearTimeout(introTimerRef.current), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Centered confirmation toast, sitting on top of the navbar. Centering is done by the
  // flex wrapper, not a Tailwind translate — framer-motion sets an inline `transform`
  // for the entrance, which would otherwise clobber a `-translate-x-1/2`.
  const toastEl = (
    <div className="fixed top-3 inset-x-0 z-[60] flex justify-center pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#E2611B] text-white text-sm font-medium px-4 py-2 shadow-lg shadow-[#E2611B]/30"
          >
            <Check className="w-4 h-4 flex-shrink-0" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  let content: ReactNode
  if (isLoading) {
    content = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  } else if (!user) {
    content = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-grid relative flex items-center justify-center px-4">
        <div className="relative z-10 glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-4 dark:bg-brand-600/15 dark:border-brand-600/30">
            <FileText className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-slate-900 dark:text-slate-100 font-semibold text-lg mb-2">Can't reach Talktofile</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
            We couldn't start a session. Please check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary inline-flex items-center justify-center gap-2 px-5"
          >
            Retry
          </button>
        </div>
      </div>
    )
  } else {
    content = <AppShell showToast={setToast} signupNonce={signupNonce} onFirstAction={handleFirstAction} />
  }

  return (
    <>
      {content}
      {toastEl}
      {/* Promo splash — a centered offer card that counts down and auto-closes. It appears
          10s after the user's first action (see handleFirstAction), not on load. Sits above
          everything (incl. the toast) via its own z-index. "Sign up free" bumps signupNonce,
          which AppShell watches to open the subscribe modal. */}
      <IntroOfferBanner
        show={showIntroOffer}
        onClose={() => setShowIntroOffer(false)}
        onSignUp={() => setSignupNonce((n) => n + 1)}
      />
    </>
  )
}
