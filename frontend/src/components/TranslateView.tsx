import { useState } from 'react'
import { Globe, Loader2, Download, AlertCircle, Share2, Check } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import type { TranslateDoc } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, downloadText, shareOrCopy } from '../lib/share'
import SectionComposer from './SectionComposer'
import Tooltip from './Tooltip'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once a translation has been produced, so this section earns its "pick up
  // where you left off" star.
  onActivity?: () => void
}

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Polish',
  'Russian', 'Arabic', 'Hindi', 'Mandarin Chinese', 'Japanese', 'Korean',
  'Turkish', 'Swedish', 'Danish', 'Finnish', 'Norwegian', 'Romanian', 'Greek',
]

// The Translate section renders its own bottom bar (below the results), replacing the
// shared WorkspaceComposer for this section only. That bar is where the user picks a
// language and runs the translation: the "Translate to" picker takes the place of the
// composer's "Follow-up suggestions" row, and a wide "Translate to <language>" button
// takes the place of the send button. The chat textbox is kept (smaller) alongside it
// for parity with the other sections — chatting from a tool section isn't wired to the
// backend yet, so pressing Enter shows a "Coming soon" bubble.
export default function TranslateView({ session, onSwitchMode, engagedModes, onActivity }: Props) {
  const [targetLang, setTargetLang] = useState('Spanish')
  const [customLang, setCustomLang] = useState('')
  const [result, setResult] = useState<{ target_language: string; documents: TranslateDoc[]; note: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sharedIdx, setSharedIdx] = useState<number | null>(null)

  const activeLang = customLang.trim() || targetLang
  // A typed ("Or type any language…") language is NOT validated by the backend yet,
  // so running it could ask for a nonexistent language. Gate it off for now: the
  // Translate button is disabled and shows a "Coming soon" tooltip instead of
  // advancing to a result. Picking one of the LANGUAGES pills clears customLang, so
  // this is only true while the user has typed a custom language.
  const isCustomLang = customLang.trim().length > 0

  const handleTranslate = async () => {
    // Guard: typed languages aren't wired up yet (see isCustomLang) — don't proceed.
    if (isCustomLang) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await toolsApi.translate(session.session_id, activeLang)
      setResult(res.data)
      onActivity?.()
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Results / content — scrolls above the pinned translate bar */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* The "text only" scope note now lives next to the section title (WorkspaceHeader). */}
        {/* Empty state — centered "what this does" blurb (mirrors ChartsView's), shown until
            a translation has been produced. A failed translate clears the result, so the
            error surfaces here too. */}
        {!result && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <Globe className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Translate Your Document</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Pick a language below and we'll translate your document into it. Supports 20+ languages.
              </p>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 max-w-sm text-left dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
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
      </div>

      {/* Bottom bar — the shared composer. The "Translate to" picker takes the place of the
          composer's "Follow-up suggestions" row (via pickerRow), and the wide "Translate to
          <language>" button takes the place of the send button. */}
      <SectionComposer
        active="translate"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add your preferences here."
        pickerRow={
          <div className="px-4 pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-2 pt-3">
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Translate to</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <input
                type="text"
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
                placeholder="Or type any language here"
                className="w-64 text-sm border border-slate-200 rounded-full px-4 py-1.5 focus:outline-none focus:border-[#E2611B] focus:ring-2 focus:ring-[#E2611B]/20 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          </div>
        }
        proceedButton={(() => {
          // A typed custom language isn't supported by the backend yet, so the button is
          // disabled and shows a "Coming soon" tooltip (see isCustomLang).
          const btn = (
            <button
              onClick={handleTranslate}
              disabled={loading || isCustomLang}
              className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {loading ? 'Translating…' : `Translate to ${activeLang}`}
            </button>
          )
          return isCustomLang ? (
            <Tooltip label="Coming soon" side="top" className="flex-shrink-0">{btn}</Tooltip>
          ) : (
            <span className="flex-shrink-0 inline-flex">{btn}</span>
          )
        })()}
      />
    </div>
  )
}
