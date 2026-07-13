import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Trophy, RotateCcw, Eye, EyeOff, Share2, Check, Sparkles } from 'lucide-react'
import type { SessionInfo, AppMode } from '../types'
import type { Flashcard } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, shareOrCopy, printAsPdf, escapeHtml, type SectionShareActions } from '../lib/share'
import SectionComposer from './SectionComposer'
import SectionExtras from './SectionExtras'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once the user has generated cards, so this section earns its "pick up where
  // you left off" star.
  onActivity?: () => void
  // When true, generate immediately on mount — the user picked this section on the
  // Landing page and proceeded, so the "Generate flashcards" step is redundant the
  // first time. Only the landing-selected section gets this; switching in via a tab
  // does not (it keeps the manual button).
  autoGenerate?: boolean
  // Register this section's header actions (Share text / Export PDF) with the shared
  // WorkspaceHeader. Called with the actions once cards exist, null when there are none.
  registerActions?: (mode: AppMode, actions: SectionShareActions | null) => void
}

export default function FlashcardsView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate, registerActions }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Per-card UI state — keyed by card index so every card in the scrollable list keeps
  // its own reveal / hint / score independently.
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [hints, setHints] = useState<Record<number, boolean>>({})
  const [scores, setScores] = useState<Record<number, boolean>>({})
  const [finished, setFinished] = useState(false)
  const [shared, setShared] = useState<'shared' | 'copied' | null>(null)

  const generate = async () => {
    setLoading(true)
    setError('')
    setCards([])
    setRevealed({})
    setHints({})
    setScores({})
    setFinished(false)
    try {
      const res = await toolsApi.flashcards(session.session_id)
      setCards(res.data.flashcards)
      if (res.data.flashcards.length) onActivity?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate flashcards. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

  // Register the header actions for this section: Share the Q&A set as text, Export it
  // as a PDF.
  useEffect(() => {
    if (!cards.length) { registerActions?.('flashcards', null); return }
    registerActions?.('flashcards', {
      share: () => {
        const text = 'Flashcards\n\n' + cards
          .map((c, i) => {
            const hint = c.hint ? `\nHint: ${c.hint}` : ''
            return `${i + 1}. Q: ${c.question}${hint}\n   A: ${c.answer}`
          })
          .join('\n\n')
        return shareOrCopy(withAttribution(text), 'Flashcards — Talktofile')
      },
      exportPdf: () => {
        const body = cards
          .map((c, i) => {
            const hint = c.hint ? `<div class="hint">Hint: ${escapeHtml(c.hint)}</div>` : ''
            return `<div class="card"><div class="q">${i + 1}. ${escapeHtml(c.question)}</div>${hint}<div class="a">Ans: ${escapeHtml(c.answer)}</div></div>`
          })
          .join('')
        printAsPdf({ title: 'Flashcards', subtitle: session.documents.map((d) => d.filename).join(', '), bodyHtml: body })
      },
    })
    return () => registerActions?.('flashcards', null)
  }, [cards, registerActions, session])

  const totalCards = cards.length
  const answered = Object.keys(scores).length
  const correctCount = Object.values(scores).filter(Boolean).length
  const allAnswered = totalCards > 0 && answered === totalCards
  const showResults = allAnswered || finished

  const reveal = (idx: number) => setRevealed((prev) => ({ ...prev, [idx]: true }))
  const toggleHint = (idx: number) => setHints((prev) => ({ ...prev, [idx]: !prev[idx] }))
  const markAnswer = (idx: number, correct: boolean) => setScores((prev) => ({ ...prev, [idx]: correct }))

  const restart = () => {
    setRevealed({})
    setHints({})
    setScores({})
    setFinished(false)
  }

  const shareSet = async () => {
    if (!cards.length) return
    const body =
      'Flashcards\n\n' +
      cards
        .map((c, i) => {
          const hint = c.hint ? `\nHint: ${c.hint}` : ''
          return `${i + 1}. Q: ${c.question}${hint}\n   A: ${c.answer}`
        })
        .join('\n\n')
    const how = await shareOrCopy(withAttribution(body), 'Flashcards — Talktofile')
    setShared(how)
    setTimeout(() => setShared(null), 2000)
  }

  const pct = totalCards ? Math.round((correctCount / totalCards) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — the empty/loading/cards states, above the pinned bottom bar */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {!cards.length && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Flashcards</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Generate Q&amp;A flashcards from your document to test your knowledge.
              </p>
            </div>
            {error && <p className="text-brand-600 text-sm bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 text-[#E2611B] animate-spin" />
            <p className="text-slate-600 dark:text-slate-300 text-sm">Generating flashcards from your document…</p>
          </div>
        )}

        {!!cards.length && !loading && (
          <div className="flex flex-col h-full">
            {/* Fixed progress header */}
            <div className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>{answered} of {totalCards} answered</span>
                <span className="text-[#E2611B] font-medium">{correctCount} correct</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-[#E2611B] rounded-full"
                  animate={{ width: `${(answered / totalCards) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Scrollable list of all cards */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5 space-y-4">
              {cards.map((card, i) => {
                const isRevealed = revealed[i]
                const showHint = hints[i]
                const score = scores[i]
                return (
                  <div
                    key={i}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800"
                  >
                    <div className="p-6">
                      {/* Numbered question with its difficulty tag to the right */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-slate-900 dark:text-slate-100 font-medium text-base leading-relaxed">
                          <span className="text-slate-900 dark:text-slate-100 font-semibold mr-1.5">{i + 1}.</span>
                          {card.question}
                        </p>
                        {card.difficulty && (
                          <span className="shrink-0 mt-0.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700">
                            {card.difficulty}
                          </span>
                        )}
                      </div>

                      {isRevealed && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4"
                        >
                          {/* Answer — full width, its own line(s) below the question so the
                              right/wrong buttons never squeeze it. */}
                          <p className="text-sm leading-relaxed">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Ans: </span>
                            <span className="text-[#E2611B] font-medium">{card.answer}</span>
                          </p>
                          {/* Right/wrong on their own row below. Just ✗ / ✓ on mobile; full
                              labels from `sm` up. */}
                          <div className="flex gap-2 justify-end mt-3">
                            <button
                              onClick={() => markAnswer(i, false)}
                              aria-label="Got it wrong"
                              title="Got it wrong"
                              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${score === false ? 'bg-[#E2611B] border-[#E2611B] text-slate-100' : 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 hover:bg-[#E2611B]/10'}`}
                            >
                              <span className="sm:hidden">✗</span>
                              <span className="hidden sm:inline">✗ Got it wrong</span>
                            </button>
                            <button
                              onClick={() => markAnswer(i, true)}
                              aria-label="Got it right"
                              title="Got it right"
                              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${score === true ? 'bg-[#E2611B] border-[#E2611B] text-slate-100' : 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 hover:bg-[#E2611B]/10'}`}
                            >
                              <span className="sm:hidden">✓</span>
                              <span className="hidden sm:inline">✓ Got it right</span>
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Before reveal: the hint (when shown) appears full-width on its own
                          line(s) below the question; the Show-hint / Reveal-answer buttons sit on
                          their own row underneath, so nothing squeezes the hint text. */}
                      {!isRevealed && (
                        <>
                          {showHint && card.hint && (
                            <motion.p
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 text-sm text-slate-500 italic dark:text-slate-400 leading-relaxed"
                            >
                              Hint: {card.hint}
                            </motion.p>
                          )}
                          <div className="mt-5 flex items-center gap-3">
                            {card.hint && (
                              <button
                                onClick={() => toggleHint(i)}
                                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300"
                              >
                                {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {showHint ? 'Hide hint' : 'Show hint'}
                              </button>
                            )}
                            <button
                              onClick={() => reveal(i)}
                              className="shrink-0 ml-auto px-6 py-2.5 rounded-xl border border-[#E2611B] bg-white text-[#E2611B] text-sm font-medium hover:bg-[#E2611B]/5 transition-all dark:bg-slate-900 dark:hover:bg-[#E2611B]/10"
                            >
                              Reveal answer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Finish early — jumps straight to the results */}
              {!showResults && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setFinished(true)}
                    className="px-8 py-2.5 rounded-xl border border-[#E2611B] bg-[#E2611B] text-slate-100 text-sm font-medium hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
                  >
                    Finish
                  </button>
                </div>
              )}

              {/* Inline completion panel — appears once every card is marked or the user finishes */}
              {showResults && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-5 p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-800"
                >
                  <div className="w-20 h-20 rounded-full bg-[#E2611B]/10 flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-[#E2611B]" />
                  </div>
                  <div>
                    <h2 className="font-brand font-bold text-2xl text-slate-900 dark:text-slate-100 mb-1">Session Complete!</h2>
                    <p className="text-4xl font-bold text-[#E2611B] my-3">{correctCount}/{totalCards}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {pct >= 80 ? 'Excellent work! 🎉' : pct >= 60 ? 'Good job! Keep practising.' : 'Keep going. You\'ll get there!'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={restart} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300">
                      <RotateCcw className="w-4 h-4" /> Try again
                    </button>
                    <button onClick={shareSet} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300">
                      {shared ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
                      {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share set'}
                    </button>
                  </div>
                </motion.div>
              )}

              <SectionExtras show={!!cards.length} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar — the shared composer. The wide "Generate flashcards" button takes the
          place of the send button and actually runs the generation. */}
      <SectionComposer
        active="flashcards"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add your preferences here."
        proceedButton={
          <button
            onClick={generate}
            disabled={loading}
            aria-label={loading ? 'Generating…' : cards.length ? 'Regenerate flashcards' : 'Generate flashcards'}
            className="flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{loading ? 'Generating…' : cards.length ? 'Regenerate flashcards' : 'Generate flashcards'}</span>
          </button>
        }
      />
    </div>
  )
}
