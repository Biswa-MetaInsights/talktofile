import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** A small on-brand confirmation dialog for destructive/irreversible actions. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Leave',
  cancelLabel = 'Stay',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative rounded-2xl w-full max-w-sm p-6 bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 dark:bg-slate-900 dark:border-slate-800"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center flex-shrink-0 dark:bg-brand-600/15 dark:border-brand-600/30">
                <AlertTriangle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-slate-900 font-semibold dark:text-slate-100">{title}</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed dark:text-slate-400">{message}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-all shadow-sm"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
