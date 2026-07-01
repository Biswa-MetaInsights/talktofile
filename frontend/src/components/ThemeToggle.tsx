import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import Tooltip from './Tooltip'

// Light/dark switch for the navbar. Shows a sun in dark mode (click → go light)
// and a moon in light mode (click → go dark). Uses the shared Tooltip with the
// navbar's `side="bottom"` convention.
export default function ThemeToggle({ side = 'bottom' }: { side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} side={side}>
      <button
        onClick={(e) => {
          toggleTheme()
          // Drop focus after a click so the tooltip (which also shows on focus for
          // keyboard users) disappears once the pointer leaves, instead of lingering
          // until the user clicks elsewhere. Keyboard focus still shows the tooltip.
          e.currentTarget.blur()
        }}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-[#303030] hover:text-[#E2611B] hover:bg-black/5 dark:text-slate-300 dark:hover:text-[#E2611B] dark:hover:bg-white/10 transition-colors"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </Tooltip>
  )
}
