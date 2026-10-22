import { CitationPanel, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

// At lg+ the panel sits in-flow beside the main content (below lg it overlays
// with a backdrop), so this card renders at a desktop viewport.
export const Excerpt = () => (
  <div className="relative flex h-[560px] w-full bg-[#F8FAFC]" style={{ transform: 'translateZ(0)' }}>
    <CitationPanel
      onClose={() => {}}
      source={{
        filename: 'Q3-board-report.pdf',
        score: 0.91,
        chunk_index: 3,
        context_before: 'The third quarter closed ahead of plan across every region.',
        text: 'Revenue for the quarter rose 18% year over year to $4.2M, driven mainly by enterprise renewals.',
        context_after: 'Gross margin held steady at 71%, in line with the prior two quarters.',
      }}
    />
    <div className="flex-1 p-8 text-sm text-slate-400">Chat continues here…</div>
  </div>
)
