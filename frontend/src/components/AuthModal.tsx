import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogIn, Crown, Eye, EyeOff, AlertCircle, Check, Sparkles, Mail, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SUPABASE_ENABLED } from '../lib/supabase'
import AvatarUpload from './AvatarUpload'
import type { UserProfile } from '../types'

type Mode = 'subscribe' | 'login' | 'reset'

/* Brand marks for the social sign-in buttons (lucide ships no brand icons).
   Frontend only — these buttons don't wire up real OAuth yet. */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
)
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] flex-shrink-0 text-slate-900 dark:text-slate-100" fill="currentColor" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.08-.46 1.58-1.518 3.12-.911 1.33-1.86 2.66-3.36 2.69-1.474.03-1.948-.87-3.63-.87-1.68 0-2.2.84-3.61.9-1.45.06-2.55-1.43-3.47-2.75-1.88-2.72-3.32-7.69-1.39-11.05.96-1.67 2.67-2.72 4.53-2.75 1.42-.03 2.75.96 3.63.96.87 0 2.49-1.18 4.2-1.01.71.03 2.72.29 4.01 2.18-.1.06-2.39 1.4-2.37 4.16.03 3.3 2.91 4.4 2.94 4.41z" />
  </svg>
)
const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M13 1h10v10H13z" />
    <path fill="#00A4EF" d="M1 13h10v10H1z" />
    <path fill="#FFB900" d="M13 13h10v10H13z" />
  </svg>
)

const SOCIAL_PROVIDERS = [
  { name: 'Google', Icon: GoogleIcon },
  { name: 'Apple', Icon: AppleIcon },
  { name: 'Microsoft', Icon: MicrosoftIcon },
] as const

/** Shared modal shell so the reset / recovery sub-views match the main modal. */
function Shell({ icon, title, subtitle, onClose, children }: {
  icon: React.ReactNode; title: string; subtitle: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative rounded-2xl w-full max-w-md p-6 my-auto bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E2611B] flex items-center justify-center shadow-sm">
                {icon}
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold dark:text-slate-100">{title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" title="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-red-50 hover:border-red-200 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/30">
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function AuthModal({
  initialMode = 'subscribe',
  onClose,
  onAuthSuccess,
  notice,
}: {
  initialMode?: Mode
  onClose: () => void
  /** Called on a successful sign in so the host can show a confirmation (e.g. a navbar toast). */
  onAuthSuccess?: (message: string) => void
  /** Optional banner shown above the form, e.g. "Your session expired — sign in again." */
  notice?: string
}) {
  const { login, register, resetPassword, updatePassword, recoveryMode, clearRecovery } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [newPassword, setNewPassword] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [avatar, setAvatar] = useState('')   // data URL — frontend only, not yet uploaded
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')          // verification / success notices (not errors)
  const [offerSignup, setOfferSignup] = useState(false)  // show "create account" CTA after a failed login

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Social sign-in/up. Frontend only for now — no real OAuth — so we just confirm
  // the same way a successful email sign in does (close box + navbar toast).
  const handleSocial = (_provider: string) => {
    onAuthSuccess?.('Sign in successful')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo(''); setOfferSignup(false)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
        // Close the box immediately; the host shows a confirmation toast on the navbar.
        onAuthSuccess?.('Sign in successful')
        onClose()
      } else {
        const profile: UserProfile = {
          full_name: fullName,
          email: SUPABASE_ENABLED ? username : email,
          phone,
          company_name: companyName,
          industry,
          avatar,
        }
        await register(username, password, profile)
        onClose()
      }
    } catch (err: any) {
      // Backend errors carry response.data.detail; Supabase auth errors carry .message.
      const raw = err.response?.data?.detail || err.message || 'Something went wrong. Please try again.'
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)

      if (/check your email|confirm your email|verification|verify/i.test(msg)) {
        // Signup succeeded but needs email verification.
        setInfo(`We've sent a verification link to ${username}. Click it to activate your account, then sign in.`)
      } else if (/email not confirmed|not confirmed/i.test(msg)) {
        // Login attempt before verifying.
        setInfo(`Your email isn't verified yet. Please click the verification link we sent to ${username}, then sign in.`)
      } else if (/invalid login credentials|invalid.*credentials/i.test(msg)) {
        // Supabase can't reveal whether the email exists — offer signup.
        setError('Incorrect email or password.')
        setOfferSignup(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true)
    try {
      await resetPassword(username)   // the email field is `username` in Supabase mode
      // Enumeration-safe: same message whether or not the email is registered.
      setInfo(`If an account exists for ${username}, we've sent a password reset link. Open it to choose a new password.`)
    } catch (err: any) {
      const raw = err.response?.data?.detail || err.message || 'Could not send the reset email. Please try again.'
      setError(typeof raw === 'string' ? raw : JSON.stringify(raw))
    } finally { setLoading(false) }
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await updatePassword(newPassword)
      onClose()   // password updated and the user is now signed in
    } catch (err: any) {
      setError(err.message || 'Could not update your password. Please try again.')
    } finally { setLoading(false) }
  }

  // The user clicked the password-reset link — show the "set a new password" form.
  if (recoveryMode) {
    return (
      <Shell icon={<KeyRound className="w-5 h-5 text-white" />} title="Set a new password"
        subtitle="Choose a new password for your account" onClose={() => { clearRecovery(); onClose() }}>
        <form onSubmit={handleSetNewPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">New password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" required
                autoComplete="new-password" className="input-field pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><Check className="w-4 h-4" /> Update password</>}
          </button>
        </form>
      </Shell>
    )
  }

  // Forgot-password: collect the email and send a reset link.
  if (mode === 'reset') {
    return (
      <Shell icon={<Mail className="w-5 h-5 text-white" />} title="Reset your password"
        subtitle="We'll email you a link to set a new password" onClose={onClose}>
        <form onSubmit={handleSendReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} type="email"
              placeholder="you@company.com" required autoComplete="email" className="input-field" />
          </div>
          {info && (
            <div className="flex items-start gap-2 text-[#E2611B] text-sm bg-[#E2611B]/10 rounded-lg px-3 py-2.5 border border-[#E2611B]/30">
              <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{info}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><Mail className="w-4 h-4" /> Send reset link</>}
          </button>
          <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:text-slate-100">
            ← Back to sign in
          </button>
        </form>
      </Shell>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative rounded-2xl w-full max-w-xl p-6 my-auto bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E2611B] flex items-center justify-center shadow-sm">
                {mode === 'subscribe' ? <Sparkles className="w-5 h-5 text-white" /> : <LogIn className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold dark:text-slate-100">{mode === 'subscribe' ? 'Create your account' : 'Welcome back'}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:whitespace-nowrap">
                  {mode === 'subscribe'
                    ? 'Free account: Have access to a personalised assistant.'
                    : 'Sign in to your account'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-red-50 hover:border-red-200 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Session-expired (or other host) notice */}
          {notice && (
            <div className="mb-5 bg-amber-50 rounded-xl p-3 border border-amber-200">
              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                {notice}
              </p>
            </div>
          )}

          {/* Free account note */}
          {mode === 'subscribe' && (
            <div className="mb-5 bg-[#E2611B]/5 rounded-xl p-3 border border-[#E2611B]/20">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Crown className="w-3.5 h-3.5 text-[#E2611B] flex-shrink-0" />
                Pro: multi-file compare &amp; larger uploads, coming soon.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5 dark:bg-slate-800">
            {([['subscribe', 'Sign up'], ['login', 'Sign in']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === key ? 'bg-white text-slate-900 shadow-sm border border-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{SUPABASE_ENABLED ? 'Email' : 'Username'} <span className="text-red-500">*</span></label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type={SUPABASE_ENABLED ? 'email' : 'text'}
                  placeholder={SUPABASE_ENABLED ? 'you@company.com' : 'username'}
                  required
                  autoComplete={SUPABASE_ENABLED ? 'email' : 'username'}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'subscribe' ? 'Min 8 characters' : 'Password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="input-field pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setInfo('') }}
                  className="text-xs text-[#E2611B] hover:text-[#E2611B]/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode === 'subscribe' && (
              <>
                <div className="pt-1">
                  <p className="text-xs font-semibold text-[#E2611B] uppercase tracking-wider mb-2">Your details</p>
                  <div className="mb-3">
                    <AvatarUpload value={avatar} onChange={setAvatar} name={fullName} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="input-field" />
                    {SUPABASE_ENABLED ? (
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="input-field" />
                    ) : (
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="input-field" />
                    )}
                  </div>
                  {!SUPABASE_ENABLED && (
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="input-field mt-3" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#E2611B] uppercase tracking-wider mb-2">
                    Company <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">(optional)</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="input-field" />
                    <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="input-field" />
                  </div>
                </div>
              </>
            )}

            <AnimatePresence>
              {info && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 text-[#E2611B] text-sm bg-[#E2611B]/10 rounded-lg px-3 py-2.5 border border-[#E2611B]/30"
                >
                  <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{info}</span>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200"
                >
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                  {offerSignup && (
                    <button
                      type="button"
                      onClick={() => { setMode('subscribe'); setError(''); setOfferSignup(false) }}
                      className="mt-2 text-xs font-semibold text-[#E2611B] hover:text-[#E2611B]/80 underline underline-offset-2"
                    >
                      New here? Create a free account →
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : mode === 'subscribe' ? (
                <><Sparkles className="w-4 h-4" /> Create free account</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign in</>
              )}
            </button>

            {/* Divider + social sign-in / sign-up (frontend only) */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400 dark:bg-slate-900 dark:text-slate-500">or {mode === 'subscribe' ? 'sign up' : 'continue'} with</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {SOCIAL_PROVIDERS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSocial(name)}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-600"
                >
                  <Icon />
                  {mode === 'subscribe' ? `Sign up with ${name} account` : `Continue with ${name} account`}
                </button>
              ))}
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
