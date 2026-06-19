import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Globe, GitCompare, Files } from 'lucide-react'
import Navbar from './components/Navbar'
import UploadZone from './components/UploadZone'
import ChatWindow from './components/ChatWindow'
import AuthModal from './components/AuthModal'
import SummaryCard from './components/SummaryCard'
import ConfirmDialog from './components/ConfirmDialog'
import Landing from './components/Landing'
import { useAuth } from './context/AuthContext'
import type { SessionInfo } from './types'

type AuthModalState = { open: boolean; mode: 'subscribe' | 'login' }

function AppShell() {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [authModal, setAuthModal] = useState<AuthModalState>({ open: false, mode: 'subscribe' })
  const [confirmLeave, setConfirmLeave] = useState(false)
  // The landing page is the front door — always shown first. "Get started"
  // (or "Sign in") moves into the app.
  const [view, setView] = useState<'landing' | 'app'>('landing')

  const enterApp = () => setView('app')

  const handleReset = () => setSession(null)
  // The logo returns to the landing page. Mid-chat it confirms first (the
  // conversation would be lost); otherwise it goes straight to the landing.
  const handleHome = () => {
    if (session) setConfirmLeave(true)
    else setView('landing')
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
        <Landing onGetStarted={enterApp} onSignIn={() => { enterApp(); openAuth('login') }} />
        {authModal.open && (
          <AuthModal initialMode={authModal.mode} onClose={() => setAuthModal((s) => ({ ...s, open: false }))} />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 bg-grid relative">
      <Navbar onOpenAuth={openAuth} onHome={handleHome} />

      <main className="relative z-10 pt-14 min-h-screen flex">
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
              <UploadZone onReady={setSession} onRequireUpgrade={() => openAuth('subscribe')} />
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
              <div className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-slate-200 bg-white p-5 gap-4 flex-shrink-0 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 3.5rem)' }}>
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                      {session.documents.length > 1 ? `${session.documents.length} Documents` : 'Document'}
                    </h3>
                    {modeBadge && (
                      <span className="flex items-center gap-1 text-xs text-indigo-500">
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
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
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
                      <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2.5 truncate" title={d.filename}>
                        {session.documents.length > 1 ? d.filename : 'Summary'}
                      </h3>
                      <SummaryCard summary={d.summary} compact />
                    </div>
                  ) : null
                ))}
              </div>

              {/* Chat panel */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-slate-50">
                <div className="flex-1 glass-card m-3 lg:m-4 rounded-2xl flex flex-col min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 5rem)' }}>
                  <ChatWindow session={session} onReset={handleReset} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {authModal.open && (
        <AuthModal initialMode={authModal.mode} onClose={() => setAuthModal((s) => ({ ...s, open: false }))} />
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this chat?"
        message="Your conversation and the uploaded document will be cleared. This can't be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmLeave(false); setSession(null); setView('landing') }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}

export default function App() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 bg-grid relative flex items-center justify-center px-4">
        <div className="relative z-10 glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-slate-900 font-semibold text-lg mb-2">Can't reach TalkToFile</h2>
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
  }

  return <AppShell />
}
