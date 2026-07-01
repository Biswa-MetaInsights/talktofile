import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageSquare, Star, Check, AlertCircle } from 'lucide-react'
import { feedbackApi } from '../api/client'

const CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'bug', label: 'Bug' },
  { key: 'feature', label: 'Feature idea' },
  { key: 'praise', label: 'Praise' },
] as const

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<string>('general')
  const [rating, setRating] = useState<number>(0)
  const [hover, setHover] = useState<number>(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!message.trim()) { setError('Please write a short message.'); return }
    setError(''); setLoading(true)
    try {
      await feedbackApi.submit({ message, rating: rating || null, category })
      setDone(true)
      setTimeout(onClose, 1300)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not send feedback. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative rounded-2xl w-full max-w-md p-6 bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-800"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E2611B] to-[#bc4d14] flex items-center justify-center shadow-sm shadow-[#E2611B]/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold dark:text-slate-100">Send feedback</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Help us make Talktofile better</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" title="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-red-50 hover:border-red-200 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-red-500/10 dark:hover:border-red-500/30">
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="py-8 text-center">
              <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-900 font-medium dark:text-slate-100">Thank you!</p>
              <p className="text-slate-500 text-sm dark:text-slate-400">Your feedback was received.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      category === c.key ? 'bg-[#E2611B]/10 border-[#E2611B]/20 text-[#E2611B]' : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Rating <span className="text-slate-400">(optional)</span></label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n === rating ? 0 : n)}
                      className="p-0.5" aria-label={`${n} star`}>
                      <Star className={`w-6 h-6 transition-colors ${(hover || rating) >= n ? 'text-brand-600 fill-brand-600' : 'text-slate-300 dark:text-slate-600'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Message</label>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={4000}
                  placeholder="What did you like, or what could be better?"
                  className="input-field resize-none"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Send feedback</>}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
