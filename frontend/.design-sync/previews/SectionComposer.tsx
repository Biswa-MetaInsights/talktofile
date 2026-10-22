import { useState } from 'react'
import { SectionComposer, ChapterPicker, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

const engaged = new Set(['chat', 'summary'] as const)
const noop = () => {}

const SendButton = () => (
  <button
    aria-label="Send"
    className="flex items-center justify-center h-11 w-11 rounded-xl bg-[#E2611B] text-white hover:bg-[#E2611B]/90 transition-all flex-shrink-0"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
  </button>
)

export const Chat = () => {
  const [value, setValue] = useState('What were the main findings?')
  return (
    <div className="max-w-3xl">
      <SectionComposer
        active="chat"
        onSwitch={noop}
        engaged={engaged}
        placeholder="Ask anything here."
        value={value}
        onChange={setValue}
        onSubmit={noop}
        proceedButton={<SendButton />}
      />
    </div>
  )
}

const chapters = [
  { id: 'ch1', index: 0, title: 'Introduction' },
  { id: 'ch2', index: 1, title: 'Methodology' },
  { id: 'ch3', index: 2, title: 'Results' },
]

export const SummaryWithChapters = () => {
  const [selected, setSelected] = useState<string[]>(['ch2'])
  return (
    <div className="max-w-3xl">
      <SectionComposer
        active="summary"
        onSwitch={noop}
        engaged={engaged}
        placeholder="Describe the summary you want…"
        pickerRow={<ChapterPicker chapters={chapters} selected={selected} onChange={setSelected} />}
        proceedButton={
          <button className="flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 transition-all flex-shrink-0">
            Summarise chapters
          </button>
        }
      />
    </div>
  )
}
