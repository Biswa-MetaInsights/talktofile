import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com'

export const analyticsReady = !!KEY

export function initAnalytics() {
  if (!KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    // Privacy-first: Talktofile never stores documents, so we never record their
    // content either. Mask all text + inputs in session replays — we capture
    // layout/interactions, never the document or chat text.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
  })
}

/** Fire a custom funnel event (no-op if analytics isn't configured). */
export function track(event: string, props?: Record<string, unknown>) {
  if (KEY) posthog.capture(event, props)
}

/** Associate events with a known (registered) user. */
export function identifyUser(id: string, props?: Record<string, unknown>) {
  if (KEY) posthog.identify(id, props)
}

/** Clear identity on sign-out. */
export function resetAnalytics() {
  if (KEY) posthog.reset()
}
