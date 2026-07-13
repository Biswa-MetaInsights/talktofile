import { useState, useEffect, type ReactNode } from 'react'

// Shared tooltip. Wrap any element; the label shows on hover or keyboard focus.
//
// Brand shades (keep consistent — see CLAUDE.md "Design / Brand"): a dark
// #303030 bubble with white text and a matching arrow. Use this component for
// every tooltip in the app rather than re-styling per location.

type Side = 'top' | 'right' | 'bottom' | 'left'

interface Props {
  label: string
  /** Which side of the wrapped element the bubble appears on. Default 'right'.
   *  Site-wide convention: tooltips open to the right (see CLAUDE.md). */
  side?: Side
  children: ReactNode
  /** Extra classes for the wrapper (e.g. layout tweaks). */
  className?: string
}

const BUBBLE_POS: Record<Side, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  // `right` is the site-wide default. On small screens a right-opening bubble clips off
  // the right edge (invisible), so below `sm` it opens to the LEFT and flips back to the
  // right at `sm`+.
  right: 'right-full mr-2 sm:right-auto sm:left-full sm:mr-0 sm:ml-2 top-1/2 -translate-y-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
}

const ARROW_POS: Record<Side, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[#303030]',
  // Mirror the responsive flip of the `right` bubble above: arrow on the left edge below
  // `sm` (bubble opens left), on the right edge at `sm`+ (bubble opens right).
  right: 'left-full sm:left-auto sm:right-full top-1/2 -translate-y-1/2 border-l-[#303030] sm:border-l-transparent sm:border-r-[#303030]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#303030]',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[#303030]',
}

export default function Tooltip({ label, side = 'right', children, className = '' }: Props) {
  // Below `md` (tablet) the custom dark bubble is hidden; instead we fall back to the
  // browser's native `title` tooltip — the same lightweight style the header action buttons
  // (End session / Share / See the original document …) already use. From `md` up, the
  // custom bubble shows and `title` is dropped so there's no double tooltip.
  const [isSmall, setIsSmall] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsSmall(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <span className={`relative inline-flex group/tip ${className}`} title={isSmall ? label : undefined}>
      {children}
      <span
        role="tooltip"
        // Tooltips only show from `md` (tablet) up — hidden on smaller (phone) screens,
        // where hover isn't reliable and the bubble crowds the UI.
        className={`hidden md:block pointer-events-none absolute z-30 w-max max-w-[220px] rounded-lg bg-[#303030] px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${BUBBLE_POS[side]}`}
      >
        {label}
        <span className={`absolute border-4 border-transparent ${ARROW_POS[side]}`} />
      </span>
    </span>
  )
}
