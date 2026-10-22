import { useState } from 'react'
import { ModeSwitcher, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

export const ChatActive = () => {
  const [mode, setMode] = useState<'chat' | 'summary' | 'flashcards' | 'slides' | 'translate' | 'podcast' | 'charts'>('chat')
  return <ModeSwitcher active={mode} onSwitch={setMode} />
}

export const WithEngagedSections = () => {
  const [mode, setMode] = useState<'chat' | 'summary' | 'flashcards' | 'slides' | 'translate' | 'podcast' | 'charts'>('slides')
  return <ModeSwitcher active={mode} onSwitch={setMode} engaged={new Set(['chat', 'flashcards', 'slides'] as const)} />
}
