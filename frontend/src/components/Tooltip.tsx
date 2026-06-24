import type { ReactNode } from 'react'

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
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
}

const ARROW_POS: Record<Side, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[#303030]',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-[#303030]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#303030]',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[#303030]',
}

export default function Tooltip({ label, side = 'right', children, className = '' }: Props) {
  return (
    <span className={`relative inline-flex group/tip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 w-max max-w-[220px] rounded-lg bg-[#303030] px-2.5 py-1.5 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${BUBBLE_POS[side]}`}
      >
        {label}
        <span className={`absolute border-4 border-transparent ${ARROW_POS[side]}`} />
      </span>
    </span>
  )
}
