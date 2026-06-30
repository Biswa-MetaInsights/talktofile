import { useState, useEffect, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { FileRejection } from 'react-dropzone'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Globe, GitCompare, Files, Check } from 'lucide-react'
import Navbar from './components/Navbar'
import UploadZone from './components/UploadZone'
import ChatWindow from './components/ChatWindow'
import AuthModal from './components/AuthModal'
import SummaryCard from './components/SummaryCard'
import ConfirmDialog from './components/ConfirmDialog'
import Landing from './components/Landing'
import { useAuth } from './context/AuthContext'
import { isProgrammaticReload } from './api/client'
import { smoothScrollTo } from './lib/smoothScroll'
import type { SessionInfo, AppMode } from './types'

const SummaryView = lazy(() => import('./components/SummaryView'))
const FlashcardsView = lazy(() => import('./components/FlashcardsView'))
const TranslateView = lazy(() => import('./components/TranslateView'))
const PodcastView = lazy(() => import('./components/PodcastView'))
const SlidesView = lazy(() => import('./components/SlidesView'))
const ChartsView = lazy(() => import('./components/ChartsView'))

type AuthModalState = { open: boolean; mode: 'subscribe' | 'login'; notice?: string }

function AppShell({ showToast }: { showToast: (message: string) => void }) {
  const { recoveryMode, sessionExpired, clearSessionExpired } = useAuth()
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [authModal, setAuthModal] = useState<AuthModalState>({ open: false, mode: 'subscribe' })
  const [confirmLeave, setConfirmLeave] = useState(false)
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

  // The landing page now uploads + processes the document itself, then hands us a
  // ready session along with the chosen mode and the user's first message. We drop
  // straight into the workspace — no separate upload step.
  const enterWorkspace = (s: SessionInfo, mode: AppMode, prompt: string) => {
    setSelectedMode(mode)
    setViewMode(mode)
    setInitialPrompt(prompt)
    setPendingUpload(null)
    setPendingUrl(null)
    setSession(s)
    setView('app')
  }

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
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [session, uploading])

  const handleReset = () => { setSession(null); setViewMode('chat'); setPendingUpload(null); setPendingUrl(null) }
  const goLanding = () => {
    setPendingUpload(null)
    setPendingUrl(null)
    setSelectedMode('chat')
    setViewMode('chat')
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

  const modeBadge = session
    ? session.mode === 'compare'
      ? { icon: GitCompare, label: 'Compare' }
      : session.mode === 'multi'
      ? { icon: Files, label: `${session.documents.length} files` }
      : { icon: FileText, label: 'Document' }
    : null

  if (view === 'landing' && !session) {
    return (
      <>
        <Navbar onOpenAuth={openAuth} onHome={goLanding} onHowItWorks={handleHowItWorks} onSignedOut={() => showToast('Sign out successful')} />
        <Landing onEnter={enterWorkspace} onBusyChange={setUploading} />
        {authModal.open && (
          <AuthModal
            initialMode={authModal.mode}
            notice={authModal.notice}
            onClose={closeAuth}
            onAuthSuccess={showToast}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 bg-grid relative overflow-x-hidden">
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
                onReady={(s) => { setSession(s); setViewMode(selectedMode) }}
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
              className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0"
            >
              {/* Left panel: document(s) info */}
              <div className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-slate-200 bg-white p-5 gap-4 flex-shrink-0 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100dvh - 4rem)' }}>
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                      {session.documents.length > 1 ? `${session.documents.length} Documents` : 'Document'}
                    </h3>
                    {modeBadge && (
                      <span className="flex items-center gap-1 text-xs text-brand-500">
                        <modeBadge.icon className="w-3 h-3" /> {modeBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {session.documents.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-800 text-sm font-medium truncate flex-1" title={d.filename}>{d.filename}</span>
                        {d.original_language && d.original_language !== 'en' && (
                          <span className="flex items-center gap-0.5 text-[10px] text-brand-600">
                            <Globe className="w-2.5 h-2.5" />{d.original_language.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {session.documents.map((d, i) => (
                  (d.summary?.overview || d.summary?.key_points?.length) ? (
                    <div key={i} className="glass-card rounded-2xl p-4">
                      <h3 className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2.5 truncate" title={d.filename}>
                        {session.documents.length > 1 ? d.filename : 'Summary'}
                      </h3>
                      <SummaryCard summary={d.summary} compact />
                    </div>
                  ) : null
                ))}
              </div>

              {/* Main panel — switches between chat and tool views */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-slate-50">
                <div className="flex-1 glass-card m-3 lg:m-4 rounded-2xl flex flex-col min-h-0 overflow-hidden" style={{ height: 'calc(100dvh - 5.5rem)' }}>
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>}>
                    {viewMode === 'summary' ? (
                      <SummaryView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : viewMode === 'flashcards' ? (
                      <FlashcardsView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : viewMode === 'translate' ? (
                      <TranslateView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : viewMode === 'podcast' ? (
                      <PodcastView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : viewMode === 'slides' ? (
                      <SlidesView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : viewMode === 'charts' ? (
                      <ChartsView session={session} onStartChat={() => setViewMode('chat')} />
                    ) : (
                      <ChatWindow session={session} onReset={handleReset} initialPrompt={initialPrompt} />
                    )}
                  </Suspense>
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
        onConfirm={() => { setConfirmLeave(false); setSession(null); goLanding() }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}

export default function App() {
  const { isLoading, user } = useAuth()
  // Transient confirmation toast (e.g. "Sign in successful" / "Sign out successful").
  // Lives here, above AppShell, so it survives the brief user→null→guest remount that
  // signing out triggers (AppShell unmounts during that window).
  const [toast, setToast] = useState('')

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  } else if (!user) {
    content = (
      <div className="min-h-screen bg-slate-50 bg-grid relative flex items-center justify-center px-4">
        <div className="relative z-10 glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-brand-600" />
          </div>
          <h2 className="text-slate-900 font-semibold text-lg mb-2">Can't reach Talktofile</h2>
          <p className="text-slate-500 text-sm mb-5">
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
    content = <AppShell showToast={setToast} />
  }

  return (
    <>
      {content}
      {toastEl}
    </>
  )
}
