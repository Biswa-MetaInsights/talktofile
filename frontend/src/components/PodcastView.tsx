import { useState, useRef, useEffect } from 'react'
import { Mic, Loader2, MessageSquare, Download, Radio, Share2, Check } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import type { PodcastLine } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, downloadText, shareOrCopy, printAsPdf, escapeHtml, type SectionShareActions } from '../lib/share'
import SectionComposer from './SectionComposer'
import SectionExtras from './SectionExtras'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once the script is generated, so this section earns its "pick up where you
  // left off" star.
  onActivity?: () => void
  // When true, generate immediately on mount — the user picked this section on the
  // Landing page and proceeded, so the "Generate podcast script" step is redundant the
  // first time. Only the landing-selected section gets this; switching in via a tab
  // does not (it keeps the manual button).
  autoGenerate?: boolean
  // Register this section's header actions (Share text / Export PDF) with the shared
  // WorkspaceHeader. Called with the actions once there's a script, null when there isn't.
  registerActions?: (mode: AppMode, actions: SectionShareActions | null) => void
}

export default function PodcastView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate, registerActions }: Props) {
  const [script, setScript] = useState<PodcastLine[]>([])
  const [loading, setLoading] = useState(false)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState('')
  // The main chatbox (shared SectionComposer) is wired here: typing "continue" (or
  // similar) extends the conversation; anything else falls back to "Coming soon".
  const [chatInput, setChatInput] = useState('')
  const [shared, setShared] = useState<'shared' | 'copied' | null>(null)

  // Auto-generate once on entry when this is the section chosen on the Landing page.
  // The ref guard ensures it fires only the first time, never on a later re-render.
  const didAutoGen = useRef(false)
  useEffect(() => {
    if (autoGenerate && !didAutoGen.current) {
      didAutoGen.current = true
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  const generate = async () => {
    setLoading(true)
    setError('')
    setScript([])
    try {
      const res = await toolsApi.podcast(session.session_id)
      setScript(res.data.script)
      if (res.data.script.length) onActivity?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate podcast script. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // "continue" and friends → keep the conversation going. Anything more specific
  // (free-form chat over the document) isn't wired to the backend yet.
  const isContinueRequest = (msg: string) =>
    /\b(continue|keep going|go on|carry on|proceed|more|next|and then|go deeper)\b/i.test(msg)

  const extend = async (req: string) => {
    if (extending || !script.length) return
    setExtending(true)
    setError('')
    try {
      const res = await toolsApi.extendPodcast(session.session_id, script, req)
      setScript((prev) => [...prev, ...res.data.new_lines])
      setChatInput('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to continue the conversation. Please try again.')
    } finally {
      setExtending(false)
    }
  }

  // Handle a message typed into the shared chatbox. Returning false lets the composer
  // show its "Coming soon" bubble for anything we can't act on yet.
  const handleChatSubmit = (): boolean => {
    const msg = chatInput.trim()
    if (!msg) return true
    if (isContinueRequest(msg) && script.length && !extending) {
      extend('Continue the conversation naturally, going a little deeper on what was just discussed.')
      return true
    }
    // Backend for free-form podcast chat isn't ready yet — do nothing but signal it.
    return false
  }

  // Display speaker labels as "Host" / "Expert" (the backend returns "HOST" / "EXPERT").
  const formatSpeaker = (speaker: string) =>
    speaker ? speaker.charAt(0).toUpperCase() + speaker.slice(1).toLowerCase() : speaker

  const scriptText = () =>
    withAttribution(script.map((line) => `${formatSpeaker(line.speaker)}: ${line.text}`).join('\n\n'))

  // Register the header actions for this section: Share the dialogue as text, Export it
  // as a PDF.
  useEffect(() => {
    if (!script.length) { registerActions?.('podcast', null); return }
    registerActions?.('podcast', {
      share: () => shareOrCopy(scriptText(), 'Podcast script — Talktofile'),
      exportPdf: () => {
        const body = script
          .map((line) => `<div class="line"><span class="speaker">${escapeHtml(formatSpeaker(line.speaker))}</span><p>${escapeHtml(line.text)}</p></div>`)
          .join('')
        printAsPdf({ title: 'Podcast Script', subtitle: session.documents.map((d) => d.filename).join(', '), bodyHtml: body })
      },
    })
    return () => registerActions?.('podcast', null)
  }, [script, registerActions, session])

  const downloadScript = () => {
    if (!script.length) return
    downloadText('podcast_script.txt', scriptText())
  }

  const shareScript = async () => {
    if (!script.length) return
    const how = await shareOrCopy(scriptText(), 'Podcast script — Talktofile')
    setShared(how)
    setTimeout(() => setShared(null), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — scrolls above the pinned bottom bar */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {!script.length && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <Radio className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Podcast Scripts</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Generate a two-person conversation between a Host and an Expert discussing the key ideas
                from your document. Perfect for preparing a talk or deepening understanding.
              </p>
            </div>
            {error && <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 text-[#E2611B] animate-spin" />
            <p className="text-slate-600 dark:text-slate-300 text-sm">Writing your podcast script…</p>
          </div>
        )}

        {!!script.length && !loading && (
          <>
            {/* Note explaining the two speakers */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Note: In the script, the host is the interviewer and the expert is the domain specialist.
            </p>

            {/* Dialogue */}
            <div className="flex flex-col gap-4">
              {script.map((line, i) => {
                const isHost = line.speaker === 'HOST'
                return (
                  <div key={i} className={`flex gap-3 ${isHost ? '' : 'flex-row-reverse'}`}>
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border bg-[#E2611B]/10 border-[#E2611B]/20 text-[#E2611B]">
                      {isHost ? 'H' : 'E'}
                    </div>
                    <div className={`max-w-[80%] ${isHost ? '' : 'text-right'}`}>
                      <p className="text-[10px] font-semibold mb-1 text-[#E2611B]">{formatSpeaker(line.speaker)}</p>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed border ${isHost ? 'bg-[#E2611B]/5 border-[#E2611B]/10 text-slate-800 rounded-tl-sm dark:bg-[#E2611B]/10 dark:border-[#E2611B]/20 dark:text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700 rounded-tr-sm dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'}`}>
                        {line.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Continue — extends the conversation via the backend (same action as typing
                "continue" in the chatbox). Styled like the Flashcards "Finish" button. */}
            {!extending && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => extend('Continue the conversation naturally, going a little deeper on what was just discussed.')}
                  aria-label="Continue the conversation"
                  className="px-8 py-2.5 rounded-xl border border-[#E2611B] bg-[#E2611B] text-slate-100 text-sm font-medium hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Continuing indicator — the conversation extends via this button or the shared
                chatbox below (type "continue"). */}
            {extending && (
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 pl-12">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Continuing the conversation…
              </div>
            )}
            {error && <p className="text-brand-600 text-xs text-center">{error}</p>}
          </>
        )}

        <SectionExtras show={engagedModes.has('podcast')} />
      </div>

      {/* Bottom bar — the shared composer. The wide "Generate podcast script" button takes
          the place of the send button and actually runs the generation. */}
      <SectionComposer
        active="podcast"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder={
          script.length
            ? 'Type "continue" to keep the conversation going…'
            : 'Add your preferences here.'
        }
        value={chatInput}
        onChange={setChatInput}
        onSubmit={handleChatSubmit}
        disabled={extending}
        proceedButton={
          <button
            onClick={generate}
            disabled={loading}
            aria-label={loading ? 'Generating…' : script.length ? 'Regenerate podcast script' : 'Generate podcast script'}
            className="flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{loading ? 'Generating…' : script.length ? 'Regenerate podcast script' : 'Generate podcast script'}</span>
          </button>
        }
      />
    </div>
  )
}
