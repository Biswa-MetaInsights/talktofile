// Shared helpers for exporting / sharing generated content (flashcards, summary,
// podcast scripts, translations). Every export carries a small "Made with
// TalkToFile" attribution so shared content quietly spreads the word.
//
// Privacy note: nothing is uploaded to share. We only act on text the user
// already has in their browser — copy to clipboard, the Web Share sheet, or a
// local .txt download. No new network calls, consistent with the app's
// nothing-stored design.

/** The public-facing name used in the attribution line. */
const BRAND = 'TalkToFile'

/**
 * The URL the attribution points at. We use the runtime origin so a shared
 * export links back to wherever this instance is actually hosted (localhost in
 * dev, the real domain in production) without hardcoding a machine-specific URL.
 */
export function appUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** The attribution block appended to every exported / shared text. */
export function attribution(): string {
  const url = appUrl()
  return url ? `\n\n— Made with ${BRAND}\n${url}` : `\n\n— Made with ${BRAND}`
}

/** Append the attribution to a body of text (with the separating blank lines). */
export function withAttribution(body: string): string {
  return `${body.trimEnd()}${attribution()}`
}

/** Trigger a local download of `content` as a UTF-8 .txt file. */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Share `text` via the native Web Share sheet when available (mobile / some
 * desktops), otherwise copy it to the clipboard. Returns how it was handled so
 * the caller can show the right confirmation ("Shared" vs "Copied").
 */
export async function shareOrCopy(text: string, title = 'TalkToFile'): Promise<'shared' | 'copied'> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (nav?.share) {
    try {
      await nav.share({ title, text })
      return 'shared'
    } catch (err) {
      // User dismissed the share sheet, or share failed — fall through to copy.
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Treat an explicit cancel as a no-op "shared" so we don't also copy.
        return 'shared'
      }
    }
  }

  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text)
    return 'copied'
  }

  // Last-resort fallback for older browsers without the Clipboard API.
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return 'copied'
}
