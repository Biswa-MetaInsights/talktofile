import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, User, Sparkles, Crown, LogIn, Lock, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import markColor from '../assets/mark-color.svg'
import markWhite from '../assets/mark-white-accent.svg'
import PersonaModal from './PersonaModal'
import FeedbackModal from './FeedbackModal'
import ProfileModal from './ProfileModal'
import Tooltip from './Tooltip'
import ThemeToggle from './ThemeToggle'

export default function Navbar({ onOpenAuth, onHome, onHowItWorks, onSignedOut, atHome = false }: { onOpenAuth: (mode: 'subscribe' | 'login') => void; onHome?: () => void; onHowItWorks?: () => void; onSignedOut?: () => void; atHome?: boolean }) {
  const { user, logout } = useAuth()
  const { theme } = useTheme()
  const [personaOpen, setPersonaOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isGuest = user?.is_guest ?? true
  const isPro = user?.plan === 'pro'
  const avatar = user?.profile?.avatar
  // The dark mark reads on the dark navbar; the color mark reads on the light one.
  const mark = theme === 'dark' ? markWhite : markColor

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-16 border-b border-[#303030] bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-5 sm:gap-7 min-w-0">
        {atHome ? (
          // On the home page the logo isn't a link — no tooltip and no hover/click
          // animation, since there's nowhere to navigate to.
          <div className="flex items-center gap-1 min-w-0">
            <img
              src={mark}
              alt="Talktofile"
              className="w-11 h-11 sm:w-14 sm:h-14 shrink-0"
            />
            <span className="-ml-2 sm:-ml-3 font-brand italic font-bold text-[22px] sm:text-[34px] tracking-[-0.02em] text-[#E2611B] truncate">
              Talktofile
            </span>
          </div>
        ) : (
          <Tooltip label="Back to home" side="bottom">
            <button
              onClick={onHome}
              className="flex items-center gap-1 group min-w-0"
            >
              <img
                src={mark}
                alt="Talktofile"
                className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 transition-transform group-hover:scale-105"
              />
              <span className="-ml-3 font-brand italic font-bold text-[26px] sm:text-[34px] tracking-[-0.02em] text-[#E2611B]">
                Talktofile
              </span>
            </button>
          </Tooltip>
        )}

        {/* Primary nav links — only on wider screens (lg+) so they don't crowd the
            right-side actions (Feedback etc.) near the breakpoint. */}
        <nav className="hidden lg:flex items-center gap-5">
          <Tooltip label="Click here to go to this section." side="bottom">
            <button onClick={onHowItWorks ?? onHome} className="text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors">How it works</button>
          </Tooltip>
          <Tooltip label="Read our blog" side="bottom">
            <a
              href="https://talktofile.ai/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors"
            >
              Blogs
            </a>
          </Tooltip>
        </nav>
      </div>

      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        {/* Light / dark theme switch */}
        <ThemeToggle side="bottom" />

        {/* Feedback — plain nav link, matching How it works / FAQ */}
        <Tooltip label="Send feedback" side="bottom">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-1.5 text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:block">Feedback</span>
          </button>
        </Tooltip>

        {/* Personalise — Pro-only feature */}
        <Tooltip label={!isPro ? 'Personalise your assistant (Pro feature)' : 'Personalise your assistant'} side="bottom">
          <button
            onClick={() => (!isPro ? onOpenAuth('subscribe') : setPersonaOpen(true))}
            className="flex items-center gap-1.5 text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors"
          >
            {!isPro ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {/* Collapse to icon-only at the same width Feedback does (below md). */}
            <span className="hidden md:block">{user?.persona ? 'Persona active' : 'Personalise'}</span>
          </button>
        </Tooltip>

        {isGuest ? (
          <Tooltip label="Sign in" side="bottom">
            <button
              onClick={() => onOpenAuth('login')}
              className="flex items-center gap-1.5 text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:block">Sign in</span>
            </button>
          </Tooltip>
        ) : (
          <div className="relative">
            <Tooltip label="Account" side="bottom">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] rounded-lg px-1 py-1 transition-colors"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={user?.username ?? 'Account'}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#E2611B]/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#E2611B] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <span className="hidden sm:block max-w-[140px] truncate">{user?.username}</span>
              </button>
            </Tooltip>
            {menuOpen && (
              <>
                {/* click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    onClick={() => { setMenuOpen(false); setProfileOpen(true) }}
                    className="flex items-center gap-2 w-full text-left text-sm text-slate-700 hover:bg-slate-50 px-3 py-2 transition-colors dark:text-slate-200 dark:hover:bg-slate-700/60"
                  >
                    <User className="w-4 h-4 text-slate-400" /> View profile
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); onSignedOut?.() }}
                    className="flex items-center gap-2 w-full text-left text-sm text-[#E2611B] hover:bg-slate-50 px-3 py-2 transition-colors dark:hover:bg-slate-700/60"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {isPro && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-300 text-neutral-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
            <Crown className="w-2.5 h-2.5" /> PRO
          </span>
        )}
      </div>

      {personaOpen && <PersonaModal onClose={() => setPersonaOpen(false)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </motion.nav>
  )
}
