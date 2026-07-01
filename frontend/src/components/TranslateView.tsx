import { useState } from 'react'
import { Globe, Loader2, MessageSquare, Download, AlertCircle, Share2, Check } from 'lucide-react'
import type { SessionInfo } from '../types'
import type { TranslateDoc } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, downloadText, shareOrCopy } from '../lib/share'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Polish',
  'Russian', 'Arabic', 'Hindi', 'Mandarin Chinese', 'Japanese', 'Korean',
  'Turkish', 'Swedish', 'Danish', 'Finnish', 'Norwegian', 'Romanian', 'Greek',
]

export default function TranslateView({ session, onStartChat }: Props) {
  const [targetLang, setTargetLang] = useState('Spanish')
  const [customLang, setCustomLang] = useState('')
  const [result, setResult] = useState<{ target_language: string; documents: TranslateDoc[]; note: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sharedIdx, setSharedIdx] = useState<number | null>(null)

  const handleTranslate = async () => {
    const lang = customLang.trim() || targetLang
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await toolsApi.translate(session.session_id, lang)
      setResult(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Translation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const downloadDoc = (doc: TranslateDoc) => {
    if (!doc.translated_text) return
    const lang = result?.target_language ?? 'translated'
    const name = `${doc.filename.replace(/\.[^.]+$/, '')}_${lang}.txt`
    downloadText(name, withAttribution(doc.translated_text))
  }

  const shareDoc = async (doc: TranslateDoc, idx: number) => {
    if (!doc.translated_text) return
    const lang = result?.target_language ?? ''
    const how = await shareOrCopy(
      withAttribution(doc.translated_text),
      `${doc.filename}${lang ? ` — ${lang}` : ''} — Talktofile`,
    )
    setSharedIdx(idx)
    setTimeout(() => setSharedIdx((c) => (c === idx ? null : c)), 2000)
    return how
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#E2611B]" />
          <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100">Translate</h2>
        </div>
        <button
          onClick={onStartChat}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300"
        >
          <MessageSquare className="w-4 h-4" /> Chat instead
        </button>
      </div>

      {/* Note about images */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Translation covers text only. Images, charts, and scanned pages cannot be translated.</span>
      </div>

      {/* Language picker */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Translate to</h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => { setTargetLang(lang); setCustomLang('') }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                targetLang === lang && !customLang
                  ? 'bg-[#E2611B] text-white border-[#E2611B]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#E2611B] hover:text-[#E2611B] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customLang}
            onChange={(e) => setCustomLang(e.target.value)}
            placeholder="Or type any language…"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#E2611B] focus:ring-2 focus:ring-[#E2611B]/20 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <button
          onClick={handleTranslate}
          disabled={loading}
          className="self-start flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {loading ? 'Translating…' : `Translate to ${customLang.trim() || targetLang}`}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Results */}
      {result && result.documents.map((doc, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{doc.filename}</span>
            {doc.translated_text && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => shareDoc(doc, i)}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-[#E2611B] font-medium transition-colors"
                >
                  {sharedIdx === i ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  {sharedIdx === i ? 'Done' : 'Share'}
                </button>
                <button
                  onClick={() => downloadDoc(doc)}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-[#E2611B] font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download .txt
                </button>
              </div>
            )}
          </div>
          {doc.error ? (
            <div className="px-5 py-4 text-sm text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">{doc.error}</div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
              {doc.translated_text}
            </div>
          )}
        </div>
      ))}

      {result && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{result.note}</p>
      )}

      <button
        onClick={onStartChat}
        className="self-center flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
      >
        <MessageSquare className="w-4 h-4" />
        Chat with your document
      </button>
    </div>
  )
}
