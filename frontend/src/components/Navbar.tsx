import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, User, Sparkles, Crown, LogIn, Lock, MessageSquare, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import markColor from '../assets/mark-color.svg'
import markWhite from '../assets/mark-white-accent.svg'
import PersonaModal from './PersonaModal'
import FeedbackModal from './FeedbackModal'
import ProfileModal from './ProfileModal'
import Tooltip from './Tooltip'
import ThemeToggle from './ThemeToggle'
import { displayName } from '../lib/displayName'
import { USE_CASES, getLandingVariant } from '../lib/landingVariants'

export default function Navbar({ onOpenAuth, onHome, onHowItWorks, onSignedOut, atHome = false }: { onOpenAuth: (mode: 'subscribe' | 'login') => void; onHome?: () => void; onHowItWorks?: () => void; onSignedOut?: () => void; atHome?: boolean }) {
  const { user, logout } = useAuth()
  const { theme } = useTheme()
  const [personaOpen, setPersonaOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // "Use cases" dropdown. Opens on mouse hover (with a short close delay so the
  // cursor can cross into the menu), or on click/tap/Enter for touch + keyboard.
  // Closes on outside click / Escape via document listeners rather than a fixed
  // backdrop, which this transformed (motion) nav could trap.
  const [useCasesOpen, setUseCasesOpen] = useState(false)
  const useCasesRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number>()
  // Pointer type of the press that led to the current click ('' for keyboard).
  const lastPointerRef = useRef('')
  const currentSlug = getLandingVariant(window.location.pathname).slug
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return  // touch "hover" would fight the tap toggle
    window.clearTimeout(closeTimerRef.current)
    setUseCasesOpen(true)
  }
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    closeTimerRef.current = window.setTimeout(() => setUseCasesOpen(false), 150)
  }
  // A mouse click on a hover-opened menu shouldn't close it; touch/keyboard toggle.
  const clickTrigger = () => {
    const wasMouse = lastPointerRef.current === 'mouse'
    lastPointerRef.current = ''
    setUseCasesOpen((o) => (wasMouse ? true : !o))
  }
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])
  useEffect(() => {
    if (!useCasesOpen) return
    const onDown = (e: MouseEvent) => {
      if (!useCasesRef.current?.contains(e.target as Node)) setUseCasesOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUseCasesOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [useCasesOpen])
  const isGuest = user?.is_guest ?? true
  const isPro = user?.plan === 'pro'
  const avatar = user?.profile?.avatar
  // Never show a raw email here — full name if we have one, else the bit before "@".
  const name = displayName(user)
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
          {/* Use-case landing pages (lib/landingVariants.ts). Plain links → a full
              page load, since Landing picks its content from the path on mount.
              Mid-session, App's beforeunload guard asks before leaving. No tooltip:
              it would sit on top of the open menu. Hover handlers sit on the wrapper,
              and the menu hangs off it with top padding (not margin) so the gap
              between button and panel still counts as "inside" while the cursor
              crosses it. */}
          <div
            ref={useCasesRef}
            className="relative"
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
          >
            <button
              onPointerDown={(e) => { lastPointerRef.current = e.pointerType }}
              onClick={clickTrigger}
              aria-haspopup="menu"
              aria-expanded={useCasesOpen}
              className={`flex items-center gap-1 text-lg font-medium transition-colors hover:text-[#E2611B] dark:hover:text-[#E2611B] ${useCasesOpen ? 'text-[#E2611B] dark:text-[#E2611B]' : 'text-[#303030] dark:text-slate-300'}`}
            >
              Use cases
              <ChevronDown className={`w-4 h-4 transition-transform ${useCasesOpen ? 'rotate-180' : ''}`} />
            </button>
            {useCasesOpen && (
              <div className="absolute left-0 top-full pt-3 z-50">
                <div
                  role="menu"
                  className="w-72 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  {USE_CASES.map(({ slug, nav: { label, icon: Icon } }) => {
                    const active = slug === currentSlug
                    return (
                      <a
                        key={slug}
                        href={`/${slug}`}
                        role="menuitem"
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors focus-visible:outline-none ${active
                          ? 'text-[#E2611B] dark:text-[#E2611B] bg-[#E2611B]/5'
                          : 'text-slate-700 dark:text-slate-200 hover:text-[#E2611B] dark:hover:text-[#E2611B] focus-visible:text-[#E2611B] dark:focus-visible:text-[#E2611B] hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/60 dark:focus-visible:bg-slate-700/60'}`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-[#E2611B]/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-[#E2611B]" />
                        </span>
                        {label}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
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

        {/* Personalise — available to every signed-in (registered) user, since the role
            step is now a mandatory part of signup. Guests are prompted to sign up first. */}
        <Tooltip label={isGuest ? 'Sign up to personalise your assistant' : 'Personalise your assistant'} side="bottom">
          <button
            onClick={() => (isGuest ? onOpenAuth('subscribe') : setPersonaOpen(true))}
            className="flex items-center gap-1.5 text-lg font-medium text-[#303030] dark:text-slate-300 hover:text-[#E2611B] dark:hover:text-[#E2611B] transition-colors"
          >
            {isGuest ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
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
                    alt={name || 'Account'}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#E2611B]/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#E2611B] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <span className="hidden sm:block max-w-[140px] truncate">{name}</span>
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
