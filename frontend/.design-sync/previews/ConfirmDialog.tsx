import { ConfirmDialog, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

const noop = () => {}

// The dialog is `fixed inset-0`; the transformed wrapper gives it a full-size
// containing block inside the card.
export const EndSession = () => (
  <div className="relative h-[420px] w-full bg-[#F8FAFC]" style={{ transform: 'translateZ(0)' }}>
    <ConfirmDialog
      open
      title="End this session?"
      message="Your document and chat will be cleared. Files are never stored, so you'll need to upload them again."
      confirmLabel="End session"
      cancelLabel="Keep working"
      onConfirm={noop}
      onCancel={noop}
    />
  </div>
)
