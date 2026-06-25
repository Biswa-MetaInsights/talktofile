import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Check, AlertCircle, Lock, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarUpload from './AvatarUpload'
import type { UserProfile } from '../types'

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+']

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, saveProfile } = useAuth()
  const p = user?.profile ?? {}

  const [avatar, setAvatar] = useState('')   // data URL — frontend only, not yet persisted
  const [fullName, setFullName] = useState(p.full_name ?? '')
  const [phone, setPhone] = useState(p.phone ?? '')
  const [companyName, setCompanyName] = useState(p.company_name ?? '')
  const [companyRole, setCompanyRole] = useState(p.company_role ?? '')
  const [companySize, setCompanySize] = useState(p.company_size ?? '')
  const [industry, setIndustry] = useState(p.industry ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accountEmail = p.email || user?.username || ''

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSaved(false); setLoading(true)
    try {
      // Email/username are intentionally omitted — they can't be changed here.
      const profile: UserProfile = {
        full_name: fullName,
        phone,
        company_name: companyName,
        company_role: companyRole,
        company_size: companySize,
        industry,
      }
      await saveProfile(profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Could not save your details. Please try again.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative rounded-2xl w-full max-w-lg p-6 my-auto bg-white border border-slate-200 shadow-2xl shadow-slate-900/10"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-200">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold flex items-center gap-2">
                  Your profile
                  {user?.plan === 'pro' && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-50 border border-brand-200 text-brand-600">
                      <Crown className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">View and update your details</p>
              </div>
            </div>
            <button
              onClick={onClose} aria-label="Close" title="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-red-50 hover:border-red-200 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Read-only account email */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <div className="flex items-center gap-2 input-field bg-slate-50 text-slate-500 cursor-not-allowed">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{accountEmail}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Your email and username can’t be changed.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Profile photo</p>
              <AvatarUpload value={avatar} onChange={setAvatar} name={fullName} />
            </div>

            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Your details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="input-field" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="input-field" />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Company</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <AnimatePresence>
              {saved && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                  <Check className="w-4 h-4 flex-shrink-0" /> Saved.
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><Check className="w-4 h-4" /> Save changes</>}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
