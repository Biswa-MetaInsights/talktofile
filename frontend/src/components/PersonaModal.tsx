import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Wand2, Pencil, RotateCcw, AlertCircle, Check, Loader2 } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ALL_ROLES } from '../lib/roles'

export default function PersonaModal({ onClose }: { onClose: () => void }) {
  const { user, setPersona } = useAuth()
  const [tab, setTab] = useState<'guided' | 'manual'>('guided')

  // Manual / preview
  const [draft, setDraft] = useState(user?.persona ?? '')
  const [loading, setLoading] = useState(false)
  // Which role card is currently being applied (its key), for a per-card spinner.
  const [pickingRole, setPickingRole] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [hint, setHint] = useState(false)

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // One-click role change: regenerate the in-depth persona for that role and apply it
  // immediately (same backend path as signup onboarding).
  const handlePickRole = async (roleKey: string) => {
    if (pickingRole) return
    setError('')
    setHint(false)
    setPickingRole(roleKey)
    try {
      const res = await authApi.setPersonaRole(roleKey)
      setPersona(res.data.persona ?? null)
      setDraft(res.data.persona ?? '')
      flash()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not update your assistant. Try again.')
    } finally {
      setPickingRole(null)
    }
  }

  const handleSave = async () => {
    setError('')
    setHint(false)
    setLoading(true)
    try {
      const value = draft.trim() || null
      const res = await authApi.setPersona(value)
      setPersona(res.data.persona ?? null)
      flash()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setError('')
    setHint(false)
    setLoading(true)
    try {
      await authApi.setPersona(null)
      setDraft('')
      setPersona(null)
      flash()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not reset. Try again.')
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
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E2611B] to-[#bc4d14] flex items-center justify-center shadow-sm shadow-[#E2611B]/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold dark:text-slate-100">Personalise your assistant</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Teach your assistant to speak your domain's language</p>
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

          {/* Active persona display */}
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                {user?.persona ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /><span className="text-green-600 dark:text-green-400">Active persona</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /><span className="text-slate-500 dark:text-slate-400">Default</span></>
                )}
              </span>
              {user?.persona && (
                <span className="text-[10px] text-[#E2611B] bg-[#E2611B]/10 border border-[#E2611B]/20 rounded px-1.5 py-0.5">Custom</span>
              )}
            </div>
            <div className="px-4 py-3">
              {user?.persona ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap dark:text-slate-300">{user.persona}</p>
              ) : (
                <p className="text-sm text-slate-500 leading-relaxed dark:text-slate-400">
                  Your assistant answers as a neutral expert document assistant. Personalise it below to match your role, domain, and tone.
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5 dark:bg-slate-800">
            {([
              ['guided', 'Guided', Wand2],
              ['manual', 'Edit prompt', Pencil],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(''); setHint(false) }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab === key ? 'bg-white text-slate-900 shadow-sm border border-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {tab === 'guided' ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {user?.persona ? 'Switch your assistant to a different role' : 'Pick the role that fits your work'}
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                Choosing a role instantly rebuilds your assistant to analyse like a professional in that field.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ALL_ROLES.map((r) => {
                  const isPicking = pickingRole === r.key
                  const dim = pickingRole && !isPicking
                  return (
                    <button
                      key={r.key}
                      onClick={() => handlePickRole(r.key)}
                      disabled={!!pickingRole}
                      className={`group flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                        isPicking
                          ? 'border-[#E2611B] bg-[#E2611B]/5'
                          : 'border-slate-200 bg-white hover:border-[#E2611B] hover:bg-[#E2611B]/5 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-[#E2611B]'
                      } ${dim ? 'opacity-40' : ''} disabled:cursor-not-allowed`}
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E2611B]/10 text-[#E2611B]">
                        {isPicking ? <Loader2 className="w-4 h-4 animate-spin" /> : <r.Icon className="w-4 h-4" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">{r.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{r.desc}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
                Want to fine-tune the wording? Use the <span className="font-medium">Edit prompt</span> tab.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Your assistant's persona</label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  maxLength={1200}
                  placeholder="You are a legal analyst specialising in Belgian contract law. Respond in precise, formal legal language and cite article numbers where possible..."
                  className="input-field resize-none font-mono text-xs leading-relaxed"
                />
                <p className="text-right text-xs text-slate-400 dark:text-slate-500 mt-1">{draft.length}/1200</p>
              </div>

              <AnimatePresence>
                {hint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-[#E2611B] text-sm bg-[#E2611B]/10 rounded-lg px-3 py-2 border border-[#E2611B]/20"
                  >
                    <Sparkles className="w-4 h-4 flex-shrink-0" /> Persona drafted. Review and tweak it above, then click Save persona to apply it.
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-all dark:text-slate-400 dark:hover:text-slate-100 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="w-4 h-4" /> Reset to default
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Check className="w-4 h-4" /> Save persona</>
                  )}
                </button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-brand-600 text-sm bg-brand-50 rounded-lg px-3 py-2 border border-brand-200 mt-4 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </motion.div>
            )}
            {saved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2 border border-green-200 mt-4 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400"
              >
                <Check className="w-4 h-4 flex-shrink-0" /> Saved. Your assistant will use this on your next question.
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-slate-400 dark:text-slate-500 text-xs mt-5">
            Your assistant still answers only from your document. The persona only changes how it speaks.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
