import { Tooltip } from 'talktofile'

// The bubble only appears on hover/focus. This style pins it open so the card shows
// the real bubble; it is NOT part of how Tooltip is used.
const pinOpen = <style>{'.pin-open [role=tooltip]{opacity:1 !important}'}</style>

const IconButton = ({ children }: { children: string }) => (
  <button className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-brand-300">
    {children}
  </button>
)

export const Right = () => (
  <div className="pin-open p-6">
    {pinOpen}
    <Tooltip label="See the original document">
      <IconButton>Document</IconButton>
    </Tooltip>
  </div>
)

export const Bottom = () => (
  <div className="pin-open p-6 pb-16">
    {pinOpen}
    <Tooltip label="Personalise your assistant" side="bottom">
      <IconButton>Personalise</IconButton>
    </Tooltip>
  </div>
)
