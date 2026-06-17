import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogIn, Crown, Eye, EyeOff, AlertCircle, Check, Sparkles, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SUPABASE_ENABLED } from '../lib/supabase'
import type { UserProfile } from '../types'

type Mode = 'subscribe' | 'login'

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+']

export default function AuthModal({
  initialMode = 'subscribe',
  onClose,
}: {
  initialMode?: Mode
  onClose: () => void
}) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyRole, setCompanyRole] = useState('')
  const [companySize, setCompanySize] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo(''); setOfferSignup(false)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        const profile: UserProfile = {
          full_name: fullName,
          email: SUPABASE_ENABLED ? username : email,
          phone,
          company_name: companyName,
          company_role: companyRole,
          company_size: companySize,
          industry,
        }
        await register(username, password, profile)
      }
      onClose()
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
          className="relative rounded-2xl w-full max-w-lg p-6 my-auto bg-white border border-slate-200 shadow-2xl shadow-slate-900/10"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm shadow-indigo-200">
                {mode === 'subscribe' ? <Sparkles className="w-5 h-5 text-white" /> : <LogIn className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold">{mode === 'subscribe' ? 'Create your account' : 'Welcome back'}</h2>
                <p className="text-xs text-slate-500">
                  {mode === 'subscribe'
                    ? 'Free account — upload a document and start chatting'
                    : 'Sign in to your account'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-red-50 hover:border-red-200 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free account benefits */}
          {mode === 'subscribe' && (
            <div className="mb-5 bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Chat with your documents',
                  '1 document · up to 5MB',
                  'Personalise Sage',
                  'A saved account',
                ].map((b) => (
                  <div key={b} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" /> {b}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 pt-2.5 border-t border-indigo-100 flex items-center gap-1.5 text-xs text-slate-500">
                <Crown className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                Pro — multi-file compare &amp; larger uploads — coming soon.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            {([['subscribe', 'Sign up'], ['login', 'Sign in']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === key ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{SUPABASE_ENABLED ? 'Email' : 'Username'}</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
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
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {mode === 'subscribe' && (
              <>
                <div className="pt-1">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">Your details</p>
                  <div className="grid grid-cols-2 gap-3">
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
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                    Company <span className="text-slate-400 normal-case font-normal">— optional</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="input-field" />
                    <input value={companyRole} onChange={(e) => setCompanyRole(e.target.value)} placeholder="Your role" className="input-field" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="input-field" />
                    <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="input-field">
                      <option value="">Company size</option>
                      {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                    </select>
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
                  className="flex items-start gap-2 text-indigo-700 text-sm bg-indigo-50 rounded-lg px-3 py-2.5 border border-indigo-200"
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
                      className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
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
          </form>

          <p className="text-center text-slate-400 text-xs mt-5">
            Your documents are never stored. Sessions are memory-only.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
