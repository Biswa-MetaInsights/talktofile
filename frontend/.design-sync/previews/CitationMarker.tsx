import { CitationMarker, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

const source = {
  filename: 'Q3-board-report.pdf',
  text: 'Revenue for the quarter rose 18% year over year to $4.2M, driven mainly by enterprise renewals.',
  score: 0.91,
  chunk_index: 3,
}

const cite = (marker: number, score: number) => ({
  marker,
  source: { ...source, score },
  matchedPhrase: 'rose 18% year over year',
  score,
  location: '¶ 3',
})

export const InlineInAnswer = () => (
  <p className="prose-custom max-w-xl text-sm leading-relaxed text-slate-700 pt-40">
    Revenue for the quarter rose 18% year over year to $4.2M<CitationMarker cite={cite(1, 0.91)} />, while churn
    fell to 2.1%, the lowest since reporting began<CitationMarker cite={cite(2, 0.84)} />.
  </p>
)
