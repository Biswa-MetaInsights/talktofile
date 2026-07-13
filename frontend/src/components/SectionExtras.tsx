import { Sparkles, SlidersHorizontal } from 'lucide-react'
import Tooltip from './Tooltip'

// The (currently placeholder) "Follow-up suggestions" + "Preferences" rows for the tool
// sections. These used to be pinned above the shared composer (SectionComposer); they now
// render at the END of a section's scrollable content instead, so they scroll with the
// section (you scroll down to reach them) rather than being stuck to the chatbox.
// Still blank placeholders for now — each has a "Coming soon" tooltip.
export default function SectionExtras({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
      {/* Each row in its own block so they stack (Tooltip is inline-flex). */}
      <div>
        <Tooltip label="Coming soon" side="right">
          <span className="flex items-center gap-1.5 cursor-default">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span className="text-xs text-slate-400 dark:text-slate-500">Follow-up suggestions</span>
          </span>
        </Tooltip>
      </div>
      <div>
        <Tooltip label="Coming soon" side="right">
          <span className="flex items-center gap-1.5 cursor-default">
            <SlidersHorizontal className="w-3 h-3 text-brand-500" />
            <span className="text-xs text-slate-400 dark:text-slate-500">Preferences</span>
          </span>
        </Tooltip>
      </div>
    </div>
  )
}
