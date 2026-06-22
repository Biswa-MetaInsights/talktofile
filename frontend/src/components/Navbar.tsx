import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, LogOut, User, Sparkles, Crown, LogIn, Lock, MessageSquare, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PersonaModal from './PersonaModal'
import FeedbackModal from './FeedbackModal'
import ProfileModal from './ProfileModal'

export default function Navbar({ onOpenAuth, onHome }: { onOpenAuth: (mode: 'subscribe' | 'login') => void; onHome?: () => void }) {
  const { user, logout } = useAuth()
  const [personaOpen, setPersonaOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isGuest = user?.is_guest ?? true
  const isPro = user?.plan === 'pro'

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[#303030] bg-[#F8FAFC]"
    >
      <div className="flex items-center gap-5 sm:gap-7">
        <button
          onClick={onHome}
          className="flex items-center gap-2.5 group"
          title="Back to home"
        >
          <div className="w-7 h-7 rounded-lg bg-[#E60026] flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-brand font-bold text-lg tracking-[-0.02em] text-[#E60026]">
            TalkToFile
          </span>
          {user?.plan === 'pro' && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-300 text-neutral-900">
              <Crown className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </button>

        {/* Primary nav links */}
        <nav className="hidden md:flex items-center gap-5">
          <button onClick={onHome} className="text-lg font-medium text-[#303030] hover:text-[#E60026] transition-colors">How it works</button>
        </nav>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {/* Feedback — plain nav link, matching How it works / FAQ */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex items-center gap-1.5 text-lg font-medium text-[#303030] hover:text-[#E60026] transition-colors"
          title="Send feedback"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden md:block">Feedback</span>
        </button>

        {/* Personalise — Pro-only feature */}
        <button
          onClick={() => (!isPro ? onOpenAuth('subscribe') : setPersonaOpen(true))}
          className="flex items-center gap-1.5 text-lg font-medium text-[#303030] hover:text-[#E60026] transition-colors"
          title={!isPro ? 'Personalise your assistant — Pro feature' : 'Personalise your assistant'}
        >
          {!isPro ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          <span className="hidden sm:block">{user?.persona ? 'Persona active' : 'Personalise'}</span>
        </button>

        {isGuest ? (
          <button
            onClick={() => onOpenAuth('login')}
            className="flex items-center gap-1.5 text-lg font-medium text-[#303030] hover:text-[#E60026] transition-colors"
            title="Sign in"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:block">Sign in</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              title="Account"
              className="flex items-center gap-2 text-lg font-medium text-[#303030] hover:text-[#E60026] rounded-lg px-1 py-1 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#E60026] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="hidden sm:block max-w-[140px] truncate">{user?.username}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <>
                {/* click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); setProfileOpen(true) }}
                    className="flex items-center gap-2 w-full text-left text-sm text-slate-700 hover:bg-slate-50 px-3 py-2 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" /> View profile
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); logout() }}
                    className="flex items-center gap-2 w-full text-left text-sm text-[#E60026] hover:bg-slate-50 px-3 py-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {personaOpen && <PersonaModal onClose={() => setPersonaOpen(false)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </motion.nav>
  )
}
