import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import markColor from '../assets/mark-color.svg'
import markWhite from '../assets/mark-white-accent.svg'

// Promotional splash. A centered "offer card" (dim + blurred backdrop) announcing that
// Pro is free through 31 July 2026. It counts down and auto-closes, and can be dismissed
// via the X / "Maybe later" / backdrop. "Sign up free" opens the auth modal (via onSignUp)
// then closes.
//
// This is a *controlled* component: the parent (App) decides *when* to show it — it now
// appears 10s after the user's first action, gated to once per session / once every 3 days
// for users who haven't signed up. App owns all of that (visibility + the localStorage
// cooldown); this component just renders and runs the auto-close countdown.
//
// The card adopts the site body colour per theme (light #F8FAFC / dark #0b1120) — i.e.
// there are effectively two "posters" driven by the `dark` class on <html>, via Tailwind
// `dark:` variants.
const TOTAL_SECONDS = 15

// The gold countdown ring in the header — a depleting circular stroke with the whole
// seconds remaining in the middle. Track is theme-aware; the progress stroke stays gold.
function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 13
  const circumference = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, remaining / total))
  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32" aria-hidden>
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          className="stroke-slate-200 dark:stroke-white/10"
          strokeWidth="2.5"
        />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="#E2611B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <span className="absolute text-[13px] font-semibold text-[#E2611B] tabular-nums">
        {Math.ceil(remaining)}
      </span>
    </div>
  )
}

export default function IntroOfferBanner({
  show,
  onClose,
  onSignUp,
}: {
  show: boolean
  onClose: () => void
  onSignUp?: () => void
}) {
  // Same mark as the navbar: white-accent on dark, colour on light.
  const { theme } = useTheme()
  const mark = theme === 'dark' ? markWhite : markColor

  const [remaining, setRemaining] = useState(TOTAL_SECONDS)

  // Run the auto-close countdown whenever the banner is shown. Resets each time it opens.
  useEffect(() => {
    if (!show) return
    setRemaining(TOTAL_SECONDS)
    const start = Date.now()
    const id = setInterval(() => {
      const left = TOTAL_SECONDS - (Date.now() - start) / 1000
      if (left <= 0) {
        clearInterval(id)
        setRemaining(0)
        onClose()
      } else {
        setRemaining(left)
      }
    }, 80)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const close = () => onClose()
  const signUp = () => {
    onSignUp?.()
    onClose()
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro-offer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={close}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Introductory offer"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0b1120] shadow-2xl shadow-slate-500/20 dark:shadow-black/50 overflow-hidden"
          >
            {/* Header: wordmark + countdown ring */}
            <div className="flex items-center justify-between px-8 sm:px-10 py-4 border-b border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center gap-1">
                <img src={mark} alt="Talktofile" className="w-12 h-12" />
                <span className="font-brand italic font-bold text-[#E2611B] text-2xl sm:text-[26px] tracking-[-0.02em] -ml-2.5">
                  Talktofile
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs uppercase tracking-wider text-[#E2611B]">
                  closes in
                </span>
                <CountdownRing remaining={remaining} total={TOTAL_SECONDS} />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-white/40 dark:hover:text-white/80 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="relative px-8 sm:px-10 pb-10 pt-6 text-center">
              {/* Offer pill */}
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E2611B] px-4 py-1.5 -rotate-2 shadow-lg shadow-black/20 mt-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Limited-period offer
                </span>
              </div>

              {/* Headline */}
              <h2 className="font-brand font-black text-slate-900 dark:text-[#f5efe6] text-3xl sm:text-4xl sm:whitespace-nowrap leading-[1.1] tracking-tight">
                Pro is{' '}
                <span className="text-slate-400 dark:text-[#8a8073] font-normal line-through decoration-2">
                  $4.99
                </span>{' '}
                <span className="italic text-[#E2611B]">free</span>. Really.
              </h2>

              <p className="mt-4 text-slate-500 dark:text-[#b4a99a] text-base sm:text-lg">
                Sign up and access every Pro feature instantly.
              </p>

              {/* Valid-through + actions, all on one line (stacks on mobile) */}
              <div className="mt-6 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-slate-100 dark:bg-black/25 border border-slate-200 dark:border-white/[0.06] px-4 py-3.5">
                  <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-[#8a8073] whitespace-nowrap">
                    Valid through
                  </span>
                  <span className="font-bold text-slate-900 dark:text-[#f5efe6] text-lg whitespace-nowrap">31 July 2026</span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={signUp}
                    className="rounded-xl bg-[#E2611B] hover:bg-[#c9531a] text-white font-bold px-5 py-3.5 transition-colors shadow-lg shadow-[#E2611B]/20"
                  >
                    Sign up
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-xl border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-[#cfc6b8] font-semibold px-5 py-3.5 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400 dark:text-[#7a7164]">
                Free through 31 July 2026, $4.99/month after.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
