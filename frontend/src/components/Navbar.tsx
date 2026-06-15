import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, LogOut, User, Sparkles, Crown, LogIn, Lock, MessageSquare, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PersonaModal from './PersonaModal'
import FeedbackModal from './FeedbackModal'

export default function Navbar({ onOpenAuth, onHome }: { onOpenAuth: (mode: 'subscribe' | 'login') => void; onHome?: () => void }) {
  const { user, logout } = useAuth()
  const [personaOpen, setPersonaOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isGuest = user?.is_guest ?? true

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-slate-200 bg-white"
    >
      <button
        onClick={onHome}
        className="flex items-center gap-2.5 group"
        title="Back to home"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm shadow-indigo-200">
          <FileText className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-brand font-bold text-[15px] tracking-[-0.02em] text-slate-900 group-hover:text-indigo-600 transition-colors">
          TalkToFile
        </span>
        {user?.plan === 'pro' && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Crown className="w-2.5 h-2.5" /> PRO
          </span>
        )}
      </button>

      <div className="flex items-center gap-3">
        {/* Feedback */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all"
          title="Send feedback"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden md:block">Feedback</span>
        </button>

        {/* Persona — Pro-only feature */}
        <button
          onClick={() => (isGuest ? onOpenAuth('subscribe') : setPersonaOpen(true))}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
            user?.persona
              ? 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              : isGuest
              ? 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
              : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
          }`}
          title={isGuest ? 'Personalise Sage — sign up to unlock' : 'Personalise Sage for your domain'}
        >
          {isGuest ? <Lock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span className="hidden sm:block">{user?.persona ? 'Persona active' : 'Personalise Sage'}</span>
        </button>

        {isGuest ? (
          <>
            <button
              onClick={() => onOpenAuth('subscribe')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium shadow-sm hover:bg-indigo-700 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sign up</span>
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors px-2 py-1.5"
              title="Sign in"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sign in</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                <User className="w-3 h-3 text-indigo-600" />
              </div>
              <span className="hidden sm:block">{user?.username}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </>
        )}
      </div>

      {personaOpen && <PersonaModal onClose={() => setPersonaOpen(false)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </motion.nav>
  )
}
