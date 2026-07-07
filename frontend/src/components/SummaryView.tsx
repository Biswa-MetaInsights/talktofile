import { useState, useRef, useEffect } from 'react'
import { FileText, Tag, List, Loader2 } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import SectionComposer from './SectionComposer'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once the user has generated (revealed) the summary, so this section earns its
  // "pick up where you left off" star — mirrors the other tool sections.
  onActivity?: () => void
  // When true, reveal the summary immediately on mount — the user picked this section
  // on the Landing page and proceeded, so the "Generate summary" step is redundant the
  // first time. Only the landing-selected section gets this; switching in via a tab
  // does not (it keeps the manual button).
  autoGenerate?: boolean
}

export default function SummaryView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate }: Props) {
  // The summary itself is produced by the upload pipeline (analyst agent) and already
  // lives on `session.documents[i].summary`. Per product decision it is no longer shown
  // automatically: the user clicks "Generate summary" (below, in the bottom bar) to reveal
  // it — matching Flashcards/Podcast/etc. There is no backend regenerate endpoint, so
  // `generate` reveals the precomputed summary after a brief "Summarising…" beat for parity.
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)
  const genTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generate = () => {
    if (loading) return
    setLoading(true)
    if (genTimer.current) clearTimeout(genTimer.current)
    genTimer.current = setTimeout(() => {
      setLoading(false)
      setGenerated(true)
      onActivity?.()
    }, 500)
  }

  useEffect(() => () => { if (genTimer.current) clearTimeout(genTimer.current) }, [])

  // Auto-reveal on entry when this is the section chosen on the Landing page. There's
  // nothing to actually generate (the summary is precomputed by the upload pipeline) —
  // this just reveals it after the same brief "Summarising…" beat for parity.
  //
  // IMPORTANT: this uses a *self-contained* timer with its own cleanup rather than the
  // ref-guarded generate(). React StrictMode double-invokes effects in dev
  // (setup → cleanup → setup); a ref-guarded version schedules the reveal timer on the
  // first setup, has it cleared by the separate unmount-cleanup effect above, and then
  // the ref blocks the second setup from rescheduling — leaving the section stuck on
  // "Summarising…" forever. Scheduling the timer here (and cancelling it in this
  // effect's own cleanup) is StrictMode-safe: the second setup reschedules its own timer.
  useEffect(() => {
    if (!autoGenerate) return
    setLoading(true)
    const t = setTimeout(() => { setLoading(false); setGenerated(true); onActivity?.() }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — scrolls above the pinned bottom bar */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {!generated && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Summary</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Generate a concise overview, key points, and the topics covered in your document.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 text-[#E2611B] animate-spin" />
            <p className="text-slate-600 dark:text-slate-300 text-sm">Summarising your document…</p>
          </div>
        )}

        {generated && !loading && session.documents.map((doc, idx) => {
          const s = doc.summary
          return (
            <div key={idx} className="flex flex-col gap-4">
              {session.documents.length > 1 && (
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
                  <FileText className="w-4 h-4" />
                  {doc.filename}
                </div>
              )}

              {/* Overview */}
              {s?.overview && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 text-sm uppercase tracking-wide">Overview</h3>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{s.overview}</p>
                </div>
              )}

              {/* Key points */}
              {s?.key_points?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <List className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wide">Key Points</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {s.key_points.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <span className="mt-1 w-5 h-5 rounded-full bg-[#E2611B]/10 text-[#E2611B] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Topics */}
              {s?.topics?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wide">Topics Covered</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.topics.map((topic: string, i: number) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback when the pipeline produced no summary for this file */}
              {!s?.overview && !s?.key_points?.length && !s?.topics?.length && (
                <p className="text-sm text-slate-400 dark:text-slate-500">No summary available for this file.</p>
              )}

              {idx < session.documents.length - 1 && (
                <hr className="border-slate-200 dark:border-slate-800" />
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom bar — the shared composer. The wide "Generate summary" button takes the
          place of the send button and reveals the summary. */}
      <SectionComposer
        active="summary"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add your preferences here."
        proceedButton={
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Generating…' : generated ? 'Regenerate summary' : 'Generate summary'}
          </button>
        }
      />
    </div>
  )
}
