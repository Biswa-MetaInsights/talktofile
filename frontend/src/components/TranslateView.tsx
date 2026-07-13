import { useState, useEffect, useRef } from 'react'
import { Globe, Loader2, Download, AlertCircle, Share2, Check } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import type { TranslateDoc } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, downloadText, shareOrCopy, printAsPdf, escapeHtml, type SectionShareActions } from '../lib/share'
import SectionComposer from './SectionComposer'
import SectionExtras from './SectionExtras'
import Tooltip from './Tooltip'
import { translateSupported } from '../lib/fileSupport'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once a translation has been produced, so this section earns its "pick up
  // where you left off" star.
  onActivity?: () => void
  // Register this section's header actions (Share text / Export PDF) with the shared
  // WorkspaceHeader. Called with the actions once a translation exists, null otherwise.
  registerActions?: (mode: AppMode, actions: SectionShareActions | null) => void
}

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Polish',
  'Russian', 'Arabic', 'Hindi', 'Mandarin Chinese', 'Japanese', 'Korean',
  'Turkish', 'Swedish', 'Danish', 'Finnish', 'Norwegian', 'Romanian', 'Greek',
]

// Sentinel value for the "Add new language" dropdown entry. Selecting it doesn't change
// the target language — it reveals an inline text box where the user types a new language
// name. Wiring the actual "validate + add to the list" flow is a BACKEND TODO (see the
// "Add a custom translation language" section in CLAUDE.md).
const ADD_NEW_LANG = '__add_new_lang__'

// The Translate section renders its own bottom bar (below the results), replacing the
// shared WorkspaceComposer for this section only. That bar is where the user picks a
// language and runs the translation: the "Translate to" picker takes the place of the
// composer's "Follow-up suggestions" row, and a wide "Translate to <language>" button
// takes the place of the send button. The chat textbox is kept (smaller) alongside it
// for parity with the other sections — chatting from a tool section isn't wired to the
// backend yet, so pressing Enter shows a "Coming soon" bubble.
export default function TranslateView({ session, onSwitchMode, engagedModes, onActivity, registerActions }: Props) {
  const [targetLang, setTargetLang] = useState('Spanish')
  const [result, setResult] = useState<{ target_language: string; documents: TranslateDoc[]; note: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sharedIdx, setSharedIdx] = useState<number | null>(null)

  // Whether this file can be translated (frontend file-type heuristic). When it can't, the
  // Translate button is blurred and a warning shows above the composer on hover/press.
  const supported = translateSupported(session)
  const [showUnsupported, setShowUnsupported] = useState(false)

  // "Add new language" flow. Selecting the sentinel dropdown option reveals an inline text
  // box (to the right of the dropdown) where the user types a language name. Submitting it
  // currently just flashes a "Coming soon" bubble — the backend that validates the name and
  // adds it to LANGUAGES isn't built yet (see CLAUDE.md → "Add a custom translation language").
  const [showAddLang, setShowAddLang] = useState(false)
  const [newLang, setNewLang] = useState('')
  const [showComingSoon, setShowComingSoon] = useState(false)
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current) }, [])

  // TODO(add-language): submitting a new language just shows "Coming soon". When the backend
  // endpoint exists, this should validate `newLang`, and on success append it to the dropdown
  // list + select it (see CLAUDE.md for the full wiring plan).
  const submitNewLang = () => {
    if (!newLang.trim()) return
    setShowComingSoon(true)
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current)
    comingSoonTimer.current = setTimeout(() => setShowComingSoon(false), 2000)
  }

  const activeLang = targetLang

  // Register the header actions for this section: Share the translation(s) as text,
  // Export them as a PDF (each document under its filename + target language).
  useEffect(() => {
    const translated = result?.documents.filter((d) => d.translated_text) ?? []
    if (!translated.length) { registerActions?.('translate', null); return }
    const lang = result?.target_language ?? ''
    registerActions?.('translate', {
      share: () => {
        const text = translated
          .map((d) => `${d.filename}${lang ? ` — ${lang}` : ''}\n\n${d.translated_text}`)
          .join('\n\n———\n\n')
        return shareOrCopy(withAttribution(text), `Translation${lang ? ` — ${lang}` : ''} — Talktofile`)
      },
      exportPdf: () => {
        const body = translated
          .map((d) => `<h2>${escapeHtml(d.filename)}${lang ? ` &rarr; ${escapeHtml(lang)}` : ''}</h2><pre>${escapeHtml(d.translated_text!)}</pre>`)
          .join('')
        printAsPdf({ title: `Translation${lang ? ` — ${lang}` : ''}`, subtitle: session.documents.map((d) => d.filename).join(', '), bodyHtml: body })
      },
    })
    return () => registerActions?.('translate', null)
  }, [result, registerActions, session])

  const handleTranslate = async () => {
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
          <div key={i} className="shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{doc.filename}</span>
              {doc.translated_text && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => shareDoc(doc, i)}
                    className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-[#E2611B] dark:hover:text-[#E2611B] font-medium transition-colors"
                  >
                    {sharedIdx === i ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    {sharedIdx === i ? 'Done' : 'Share'}
                  </button>
                  <button
                    onClick={() => downloadDoc(doc)}
                    className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-[#E2611B] dark:hover:text-[#E2611B] font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download .txt
                  </button>
                </div>
              )}
            </div>
            {doc.error ? (
              <div className="px-5 py-4 text-sm text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">{doc.error}</div>
            ) : (
              <div className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                {doc.translated_text}
              </div>
            )}
          </div>
        ))}

        {/* Continue — will eventually translate the rest of a document truncated by the
            backend's input cap. The backend for that isn't built yet, so the button is a
            styled placeholder (matches the Flashcards "Finish" button) with a "Coming soon"
            tooltip and no action. */}
        {result && result.documents.some((d) => d.translated_text) && (
          <div className="shrink-0 flex justify-center pt-1">
            <Tooltip label="Coming soon">
              <button
                type="button"
                aria-label="Continue translating (coming soon)"
                className="px-8 py-2.5 rounded-xl border border-[#E2611B] bg-[#E2611B] text-slate-100 text-sm font-medium hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
              >
                Continue
              </button>
            </Tooltip>
          </div>
        )}

        <SectionExtras show={!!result} />
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
          <div className="px-4 pb-3 pt-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            {/* Label + dropdown on one line (dropdown to the right of the label), all sizes. */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-brand-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Translate to</span>
              </span>
              <select
                // Show "Add new language" as the selected value while its box is open, so the
                // box is visibly paired to that dropdown entry (and both go away together when a
                // real language is picked). The actual translation target stays in `targetLang`.
                value={showAddLang ? ADD_NEW_LANG : targetLang}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_LANG) {
                    // Reveal the inline "new language" box; keep the current target language.
                    setShowAddLang(true)
                    return
                  }
                  setShowAddLang(false)
                  setTargetLang(e.target.value)
                }}
                className="flex-1 min-w-0 sm:flex-none sm:w-72 text-sm border-2 border-[#E2611B] rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E2611B]/20 transition-all dark:bg-slate-800 dark:text-slate-100"
              >
                {/* First option (Spanish) stays first; "+ Add new language" is the second entry. */}
                <option value={LANGUAGES[0]}>{LANGUAGES[0]}</option>
                {/* Native <option> tooltip via `title` — hovering the entry shows the hint. */}
                <option value={ADD_NEW_LANG} title="Click here to add a new language to translate">
                  + Add new language
                </option>
                {LANGUAGES.slice(1).map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>

              {/* Inline "new language" box — appears to the right of the dropdown once the
                  "Add new language" option is chosen. Submitting shows "Coming soon" (the
                  backend that validates + registers the language isn't built yet). */}
              {showAddLang && (
                <div className="relative flex-1 min-w-0 sm:flex-none sm:w-56">
                  <input
                    autoFocus
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); submitNewLang() }
                    }}
                    placeholder="Enter the language name here."
                    className="w-full text-sm border-2 border-[#E2611B] rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E2611B]/20 transition-all dark:bg-slate-800 dark:text-slate-100"
                  />
                  {/* "Coming soon" bubble — same look as the composer's (dark #303030 pill). */}
                  {showComingSoon && (
                    <div className="absolute bottom-full left-0 mb-2 z-10 whitespace-nowrap rounded-lg bg-[#303030] text-white text-xs px-2.5 py-1.5 shadow-lg">
                      Coming soon
                      <span className="absolute top-full left-3.5 -mt-1 w-2 h-2 rotate-45 bg-[#303030]" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        }
        notice={!supported && showUnsupported ? 'Translation covers text only. Images, charts, and scanned pages cannot be translated.' : undefined}
        proceedButton={
          <span className="flex-shrink-0 inline-flex">
            <button
              onClick={() => { if (!supported) { setShowUnsupported(true); return } handleTranslate() }}
              onMouseEnter={() => { if (!supported) setShowUnsupported(true) }}
              onMouseLeave={() => setShowUnsupported(false)}
              disabled={loading}
              aria-label={loading ? 'Translating…' : `Translate to ${activeLang}`}
              className={`flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${!supported ? 'blur-[1.2px] opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span className="hidden sm:inline">{loading ? 'Translating…' : `Translate to ${activeLang}`}</span>
            </button>
          </span>
        }
      />
    </div>
  )
}
