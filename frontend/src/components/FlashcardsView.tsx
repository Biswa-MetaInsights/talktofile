import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, MessageSquare, Loader2, Trophy, RotateCcw, Eye, EyeOff, Share2, Check } from 'lucide-react'
import type { SessionInfo } from '../types'
import type { Flashcard } from '../api/client'
import { toolsApi } from '../api/client'
import { withAttribution, shareOrCopy } from '../lib/share'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

const DIFF_COLOR = { easy: 'text-green-600 bg-green-50 border-green-200', medium: 'text-amber-600 bg-amber-50 border-amber-200', hard: 'text-red-600 bg-red-50 border-red-200' }

export default function FlashcardsView({ session, onStartChat }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [scores, setScores] = useState<Record<number, boolean>>({})
  const [finished, setFinished] = useState(false)
  const [shared, setShared] = useState<'shared' | 'copied' | null>(null)

  const generate = async () => {
    setLoading(true)
    setError('')
    setCards([])
    setCurrentIdx(0)
    setShowAnswer(false)
    setShowHint(false)
    setScores({})
    setFinished(false)
    try {
      const res = await toolsApi.flashcards(session.session_id)
      setCards(res.data.flashcards)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate flashcards. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const card = cards[currentIdx]
  const totalCards = cards.length
  const answered = Object.keys(scores).length

  const markAnswer = (correct: boolean) => {
    setScores((prev) => ({ ...prev, [currentIdx]: correct }))
    setShowAnswer(false)
    setShowHint(false)
    const next = currentIdx + 1
    if (next >= totalCards) {
      setFinished(true)
    } else {
      setCurrentIdx(next)
    }
  }

  const restart = () => {
    setCurrentIdx(0)
    setShowAnswer(false)
    setShowHint(false)
    setScores({})
    setFinished(false)
  }

  const correctCount = Object.values(scores).filter(Boolean).length

  const shareSet = async () => {
    if (!cards.length) return
    const body =
      'FLASHCARDS\n\n' +
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

  if (!cards.length && !loading) {
    return (
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
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">{error}</p>}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={generate}
            className="px-6 py-3 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
          >
            Generate flashcards
          </button>
          <button onClick={onStartChat} className="text-sm text-slate-500 dark:text-slate-400 hover:text-[#E2611B] flex items-center gap-1.5">
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
        <p className="text-slate-600 dark:text-slate-300 text-sm">Generating flashcards from your document…</p>
      </div>
    )
  }

  if (finished) {
    const pct = Math.round((correctCount / totalCards) * 100)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
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
          <button onClick={generate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300">
            New set
          </button>
          <button onClick={shareSet} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300">
            {shared ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
            {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share set'}
          </button>
          <button onClick={onStartChat} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 transition-all">
            <MessageSquare className="w-4 h-4" /> Start chatting
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-5 gap-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>Card {currentIdx + 1} of {totalCards}</span>
        <span className="text-green-600 dark:text-green-400 font-medium">{correctCount} correct</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-full bg-[#E2611B] rounded-full"
          animate={{ width: `${((currentIdx) / totalCards) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            {card?.difficulty && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${DIFF_COLOR[card.difficulty] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                {card.difficulty}
              </span>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">Question</span>
          </div>

          <div className="flex-1 flex flex-col justify-between p-6">
            <p className="text-slate-900 dark:text-slate-100 font-medium text-base leading-relaxed">{card?.question}</p>

            {showHint && card?.hint && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-sm text-slate-500 italic bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100 dark:text-slate-400 dark:bg-slate-800/60 dark:border-slate-700"
              >
                Hint: {card.hint}
              </motion.p>
            )}

            {showAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4"
              >
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-2">Answer</p>
                <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{card?.answer}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {!showAnswer ? (
          <div className="flex gap-2">
            {card?.hint && (
              <button
                onClick={() => setShowHint((s) => !s)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300"
              >
                {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showHint ? 'Hide hint' : 'Show hint'}
              </button>
            )}
            <button
              onClick={() => setShowAnswer(true)}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Reveal answer
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => markAnswer(false)}
              className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-all"
            >
              ✗ Got it wrong
            </button>
            <button
              onClick={() => markAnswer(true)}
              className="flex-1 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm font-medium hover:bg-green-100 transition-all"
            >
              ✓ Got it right
            </button>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-3">
            <button onClick={onStartChat} className="flex items-center gap-1 hover:text-[#E2611B] transition-colors">
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </button>
            <button onClick={shareSet} className="flex items-center gap-1 hover:text-[#E2611B] transition-colors">
              {shared ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
              {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share'}
            </button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { if (currentIdx > 0) { setCurrentIdx(i => i - 1); setShowAnswer(false); setShowHint(false) } }} disabled={currentIdx === 0} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => { if (currentIdx < totalCards - 1) { setCurrentIdx(i => i + 1); setShowAnswer(false); setShowHint(false) } }} disabled={currentIdx === totalCards - 1} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
