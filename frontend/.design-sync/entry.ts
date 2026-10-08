// Curated entry for the Claude Design sync (window.Talktofile).
// The frontend is an app, not a library: re-export only the reusable primitives
// that render without auth, API or WebSocket wiring. Add a component here AND in
// config.json `componentSrcMap` + `dtsPropsFor` to sync it.
export { default as AvatarUpload } from '../src/components/AvatarUpload'
export { default as ChapterPicker } from '../src/components/ChapterPicker'
export { default as CitationMarker } from '../src/components/CitationMarker'
export { default as CitationPanel } from '../src/components/CitationPanel'
export { default as ConfirmDialog } from '../src/components/ConfirmDialog'
export { default as FaqSection } from '../src/components/FaqSection'
export { default as MessageBubble } from '../src/components/MessageBubble'
export { default as MicButton } from '../src/components/MicButton'
export { default as ModeSwitcher, MODE_ICONS, MODE_LABELS, SWITCH_MODES } from '../src/components/ModeSwitcher'
export { default as SectionComposer } from '../src/components/SectionComposer'
export { default as SectionExtras } from '../src/components/SectionExtras'
export { default as SummaryCard } from '../src/components/SummaryCard'
export { default as ThemeToggle } from '../src/components/ThemeToggle'
export { default as Tooltip } from '../src/components/Tooltip'
export { default as TypingIndicator } from '../src/components/TypingIndicator'
export { ThemeProvider, useTheme } from '../src/context/ThemeContext'
// Previews set `MotionGlobalConfig.skipAnimations = true` so framer-motion entrance
// animations render in their final state (static cards; see NOTES.md).
export { MotionGlobalConfig } from 'framer-motion'
