import { MicButton, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

// MicButton is transparent until hover; it lives inside an input row, so show it there.
const Field = ({ disabled = false }: { disabled?: boolean }) => (
  <div className="flex items-center gap-2 max-w-md rounded-xl border border-slate-200 bg-white pl-4 pr-1.5 py-1.5 shadow-sm">
    <span className="flex-1 text-sm text-slate-400">{disabled ? 'Connecting…' : 'Ask anything here.'}</span>
    <MicButton onTranscript={() => {}} disabled={disabled} />
  </div>
)

export const InInputRow = () => <Field />

export const Disabled = () => <Field disabled />
