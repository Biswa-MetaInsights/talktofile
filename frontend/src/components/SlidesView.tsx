import { useState } from 'react'
import { Presentation, Loader2, MessageSquare, Download, Crown, Lock } from 'lucide-react'
import type { SessionInfo } from '../types'
import { toolsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

export default function SlidesView({ session, onStartChat }: Props) {
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

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Crown className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="font-brand font-bold text-xl text-slate-900 mb-2">Slide Deck Generation</h2>
          <p className="text-slate-500 text-sm max-w-sm">
            Create a downloadable, editable PowerPoint presentation from your document.
            This feature is available on the Pro plan.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <Lock className="w-4 h-4" /> Upgrade to Pro to unlock slide generation
        </div>
        <button
          onClick={onStartChat}
          className="text-sm text-slate-500 hover:text-[#E2611B] flex items-center gap-1.5"
        >
          <MessageSquare className="w-4 h-4" /> Start chatting instead
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
        <Presentation className="w-8 h-8 text-[#E2611B]" />
      </div>
      <div>
        <h2 className="font-brand font-bold text-xl text-slate-900 mb-2">Create Slide Deck</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          Generate a PowerPoint presentation from your document with a title slide, content slides
          for each key section, and speaker notes. Download and edit in PowerPoint or Google Slides.
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm">
          {error}
        </p>
      )}

      {generated && !error && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <Download className="w-4 h-4" /> Presentation downloaded!
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 disabled:opacity-50 transition-all shadow-md shadow-[#E2611B]/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? 'Generating…' : generated ? 'Download again' : 'Generate & Download .pptx'}
        </button>
        <button
          onClick={onStartChat}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-[#E2611B] hover:text-[#E2611B] transition-all"
        >
          <MessageSquare className="w-4 h-4" /> Chat with your document
        </button>
      </div>

      <p className="text-xs text-slate-400 max-w-sm">
        The presentation is generated from the document content. Open in PowerPoint or Google Slides
        to edit, add branding, or rearrange slides.
      </p>
    </div>
  )
}
