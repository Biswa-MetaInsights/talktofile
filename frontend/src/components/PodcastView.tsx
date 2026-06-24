import { useState } from 'react'
import { Mic, Loader2, MessageSquare, Download, Radio } from 'lucide-react'
import type { SessionInfo } from '../types'
import type { PodcastLine } from '../api/client'
import { toolsApi } from '../api/client'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

const SPEAKER_COLORS: Record<string, string> = {
  HOST: 'bg-[#E2611B]/10 border-[#E2611B]/20 text-[#E2611B]',
  EXPERT: 'bg-slate-100 border-slate-200 text-slate-600',
}

export default function PodcastView({ session, onStartChat }: Props) {
  const [script, setScript] = useState<PodcastLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    setScript([])
    try {
      const res = await toolsApi.podcast(session.session_id)
      setScript(res.data.script)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate podcast script. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const downloadScript = () => {
    if (!script.length) return
    const text = script.map((line) => `${line.speaker}: ${line.text}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'podcast_script.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!script.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
          <Radio className="w-8 h-8 text-[#E2611B]" />
        </div>
        <div>
          <h2 className="font-brand font-bold text-xl text-slate-900 mb-2">Podcast Script</h2>
          <p className="text-slate-500 text-sm max-w-sm">
            Generate a two-person conversation between a HOST and an EXPERT discussing the key ideas
            from your document. Perfect for preparing a talk or deepening understanding.
          </p>
        </div>
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={generate}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
          >
            <Mic className="w-4 h-4" /> Generate podcast script
          </button>
          <button onClick={onStartChat} className="text-sm text-slate-500 hover:text-[#E2611B] flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Start chatting instead
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 text-[#E2611B] animate-spin" />
        <p className="text-slate-600 text-sm">Writing your podcast script…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#E2611B]" />
          <h2 className="font-brand font-bold text-xl text-slate-900">Podcast Script</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadScript}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all"
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            onClick={onStartChat}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all"
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E2611B]" /> HOST: interviewer</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> EXPERT: domain specialist</span>
      </div>

      {/* Dialogue */}
      <div className="flex flex-col gap-4">
        {script.map((line, i) => {
          const isHost = line.speaker === 'HOST'
          return (
            <div key={i} className={`flex gap-3 ${isHost ? '' : 'flex-row-reverse'}`}>
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${isHost ? 'bg-[#E2611B]/10 border-[#E2611B]/20 text-[#E2611B]' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                {isHost ? 'H' : 'E'}
              </div>
              <div className={`max-w-[80%] ${isHost ? '' : 'text-right'}`}>
                <p className={`text-[10px] font-semibold mb-1 ${isHost ? 'text-[#E2611B]' : 'text-slate-500'}`}>{line.speaker}</p>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed border ${isHost ? 'bg-[#E2611B]/5 border-[#E2611B]/10 text-slate-800 rounded-tl-sm' : 'bg-slate-50 border-slate-100 text-slate-700 rounded-tr-sm'}`}>
                  {line.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-3 pt-4">
        <button
          onClick={generate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all"
        >
          <Mic className="w-4 h-4" /> Regenerate
        </button>
        <button
          onClick={onStartChat}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 transition-all"
        >
          <MessageSquare className="w-4 h-4" /> Chat with your document
        </button>
      </div>
    </div>
  )
}
