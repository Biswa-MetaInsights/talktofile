// Tailwind build for the Claude Design sync stylesheet. Extends the app's own
// config (single source of truth for the brand scale, fonts and 16px floor) and
// safelists the brand vocabulary so designs can use classes the app hasn't yet.
import app from '../tailwind.config.js'

const colors = '(brand|slate|white|black|red|emerald|amber)'
const shades = '(-(50|100|200|300|400|500|600|700|800|900|950))?'

export default {
  ...app,
  content: ['./src/**/*.{ts,tsx}', './.design-sync/previews/**/*.tsx'],
  safelist: [
    { pattern: new RegExp(`^(bg|text|border)-${colors}${shades}$`), variants: ['hover', 'dark'] },
    { pattern: new RegExp(`^(ring|from|via|to|divide|placeholder|fill|stroke)-${colors}${shades}$`) },
    { pattern: /^(rounded)(-(sm|md|lg|xl|2xl|3xl|full))?$/ },
    { pattern: /^(text)-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)$/, variants: ['sm', 'md', 'lg'] },
    { pattern: /^font-(sans|mono|brand|normal|medium|semibold|bold|extrabold)$/ },
    { pattern: /^shadow(-(sm|md|lg|xl|2xl|none))?$/ },
    { pattern: /^animate-(fade-in|slide-up|slide-in-right|slide-in-left|pulse-slow|float|shimmer|wave|glow)$/ },
    'glass-card', 'input-field', 'btn-primary', 'prose-custom', 'scrollbar-thin', 'bg-grid',
  ],
}
