import { useState } from 'react'
import { Presentation, Loader2, Download, Crown, Lock } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import SectionComposer from './SectionComposer'
import Tooltip from './Tooltip'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once slides have been generated, so this section earns its "pick up where you
  // left off" star.
  onActivity?: () => void
}

export default function SlidesView({ session, onSwitchMode, engagedModes, onActivity }: Props) {
  const { user } = useAuth()
  const isPro = user?.plan === 'pro'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch the PPTX as a blob and trigger download directly.
      const response = await api.post(
        `/tools/slides/${session.session_id}`,
        {},
        { responseType: 'blob' }
      )
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = session.documents[0]?.filename.replace(/\.[^.]+$/, '') ?? 'presentation'
      a.download = `${filename}.pptx`
      a.click()
      URL.revokeObjectURL(url)
      setGenerated(true)
      onActivity?.()
    } catch (err: any) {
      const detail = err.response?.data?.detail
        || (err.response?.data instanceof Blob
          ? await err.response.data.text()
          : null)
      setError(detail || 'Failed to generate slides. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const genLabel = loading ? 'Generating…' : generated ? 'Regenerate slides' : 'Generate slides'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — scrolls above the pinned bottom bar */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center gap-6 text-center">
        {!isPro ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Slide Deck Generation</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Create a downloadable, editable PowerPoint presentation from your document.
                This feature is available on the Pro plan.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
              <Lock className="w-4 h-4" /> Upgrade to Pro to unlock slide generation
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <Presentation className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Create Slide Deck</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Generate a PowerPoint presentation from your document with a title slide, content slides
                for each key section, and speaker notes. Download and edit in PowerPoint or Google Slides.
              </p>
            </div>

            {error && (
              <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 max-w-sm dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                {error}
              </p>
            )}

            {generated && !error && (
              <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400">
                <Download className="w-4 h-4" /> Presentation downloaded!
              </div>
            )}

            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
              The presentation is generated from the document content. Open in PowerPoint or Google Slides
              to edit, add branding, or rearrange slides.
            </p>
          </>
        )}
      </div>

      {/* Bottom bar — the shared composer. The wide "Generate slides" button takes the
          place of the send button and actually runs the generation. Pro-only, so it's
          disabled for free users with a "Pro only" tooltip. */}
      <SectionComposer
        active="slides"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add your preferences here."
        proceedButton={(() => {
          const btn = (
            <button
              onClick={generate}
              disabled={loading || !isPro}
              className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isPro ? <Presentation className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {genLabel}
            </button>
          )
          return isPro ? (
            <span className="flex-shrink-0 inline-flex">{btn}</span>
          ) : (
            <Tooltip label="Pro only" side="top" className="flex-shrink-0">{btn}</Tooltip>
          )
        })()}
      />
    </div>
  )
}
