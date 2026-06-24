// Custom smooth-scroll helper.
//
// The browser's native `scrollIntoView({ behavior: 'smooth' })` scrolls at a
// fixed, fairly fast speed we can't control, which feels abrupt for the longer
// in-page jumps on the landing page. This animates the scroll ourselves over a
// configurable duration with an ease-in-out curve so it glides instead.

type Block = 'start' | 'center' | 'end'

interface Options {
  /** Vertical alignment of the target, mirroring scrollIntoView's `block`. Default 'start'. */
  block?: Block
  /** Animation length in ms. Default 1000 (slower than the native ~300). */
  duration?: number
  /** Pixels to leave above the target (e.g. fixed navbar height). Default 0. */
  offset?: number
  /** Called once the scroll finishes. */
  onDone?: () => void
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export function smoothScrollTo(target: HTMLElement | string | null, options: Options = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target
  if (!el) return

  const { block = 'start', duration = 1000, offset = 0, onDone } = options
  const startY = window.scrollY
  const rect = el.getBoundingClientRect()

  let destY: number
  if (block === 'center') {
    destY = startY + rect.top - (window.innerHeight - rect.height) / 2
  } else if (block === 'end') {
    destY = startY + rect.bottom - window.innerHeight
  } else {
    destY = startY + rect.top - offset
  }

  // Don't scroll past the bottom of the page.
  const maxY = document.documentElement.scrollHeight - window.innerHeight
  destY = Math.max(0, Math.min(destY, maxY))

  const distance = destY - startY
  if (Math.abs(distance) < 1) {
    onDone?.()
    return
  }

  // Honour reduced-motion: jump instantly.
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    window.scrollTo(0, destY)
    onDone?.()
    return
  }

  const startTime = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    window.scrollTo(0, startY + distance * easeInOutCubic(t))
    if (t < 1) requestAnimationFrame(step)
    else onDone?.()
  }
  requestAnimationFrame(step)
}
