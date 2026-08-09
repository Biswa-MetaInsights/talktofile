import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ROLES, GENERAL, type Role } from '../lib/roles'

/**
 * Mandatory post-signup step: the user must pick the role that best matches their
 * work, which tunes the assistant to analyse like a professional in that field.
 *
 * Self-gating: renders only for a signed-in, non-guest user who has no persona yet
 * (and not during password recovery). Picking a role generates + saves an in-depth
 * persona and the modal disappears (persona is now set). There is deliberately NO
 * close / skip / backdrop-dismiss / Escape — the only way out is to choose a role
 * ("General" is always available), so there's no loophole around personalising.
 */
export default function RoleOnboarding() {
  const { user, setPersona, recoveryMode } = useAuth()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  const show = !!user && !user.is_guest && !user.persona && !recoveryMode
  if (!show) return null

  const choose = async (role: Role) => {
    if (pending) return
    setError('')
    setPending(role.key)
    try {
      const res = await authApi.setPersonaRole(role.key)
      // Setting the persona flips `user.persona` truthy → this component unmounts.
      setPersona(res.data.persona ?? null)
      if (!res.data.persona) {
        // Extremely unlikely (backend always returns a persona), but never dead-end.
        setError('Something went wrong preparing your assistant. Please try again.')
        setPending(null)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not set up your assistant. Please try again.')
      setPending(null)
    }
  }

  const Card = ({ role }: { role: Role }) => {
    const isPending = pending === role.key
    const dim = pending && !isPending
    return (
      <button
        onClick={() => choose(role)}
        disabled={!!pending}
        className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
          isPending
            ? 'border-[#E2611B] bg-[#E2611B]/5'
            : 'border-slate-200 bg-white hover:border-[#E2611B] hover:bg-[#E2611B]/5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-[#E2611B]'
        } ${dim ? 'opacity-40' : ''} disabled:cursor-not-allowed`}
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E2611B]/10 text-[#E2611B]">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <role.Icon className="w-5 h-5" />}
        </span>
        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{role.label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{role.desc}</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-thin rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 dark:bg-slate-900 dark:border-slate-800"
      >
        {/* Header — no close button (this step is mandatory). */}
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E2611B] to-[#bc4d14] flex items-center justify-center shadow-sm shadow-[#E2611B]/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100">Set up your assistant</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Pick the role that best fits your work. Your assistant will analyse your documents like a
          professional in that field. You can refine or change this anytime under Personalise.
        </p>

        {pending && (
          <div className="mb-4 flex items-center gap-2 text-sm text-[#E2611B] bg-[#E2611B]/10 border border-[#E2611B]/20 rounded-lg px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            Preparing your professional assistant…
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-brand-600 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ROLES.map((r) => <Card key={r.key} role={r} />)}
        </div>

        {/* General — the always-valid choice, set apart so no one is dead-ended. */}
        <div className="mt-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Not one of these? Pick a strong all-round assistant:</p>
          <button
            onClick={() => choose(GENERAL)}
            disabled={!!pending}
            className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
              pending === 'general' ? 'border-[#E2611B] bg-[#E2611B]/5' : 'border-slate-200 bg-white hover:border-[#E2611B] hover:bg-[#E2611B]/5 dark:border-slate-700 dark:bg-slate-800/60'
            } ${pending && pending !== 'general' ? 'opacity-40' : ''} disabled:cursor-not-allowed`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E2611B]/10 text-[#E2611B] flex-shrink-0">
              {pending === 'general' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-sm text-slate-900 dark:text-slate-100">{GENERAL.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{GENERAL.desc}</span>
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
