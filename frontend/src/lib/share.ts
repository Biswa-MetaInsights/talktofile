// Shared helpers for exporting / sharing generated content (flashcards, summary,
// podcast scripts, translations). Every export carries a small "Made with
// Talktofile" attribution so shared content quietly spreads the word.
//
// Privacy note: nothing is uploaded to share. We only act on text the user
// already has in their browser — copy to clipboard, the Web Share sheet, or a
// local .txt download. No new network calls, consistent with the app's
// nothing-stored design.

/** The public-facing name used in the attribution line. */
const BRAND = 'Talktofile'

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

/** Escape a string for safe interpolation into printable HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The two header actions a tool section registers with the shared WorkspaceHeader.
 * `share` opens the native share sheet (or copies) the section's TEXT; `exportPdf`
 * opens a print / Save-as-PDF view of the section's content. Both act on whichever
 * section is currently open.
 */
export interface SectionShareActions {
  /** Native share sheet / clipboard of the section's text (already attributed). */
  share: () => Promise<'shared' | 'copied'>
  /** Print the section's content to a PDF (browser Save-as-PDF dialog). */
  exportPdf: () => void
}

/**
 * Open a print-friendly window rendering `bodyHtml` under a shared Talktofile shell
 * (heading + meta line + footer), then trigger the browser's print dialog — which
 * offers "Save as PDF" on every platform. This is how the app "shares as a PDF"
 * without a client-side PDF library. Each section builds its own `bodyHtml` (podcast
 * dialogue, translation, flashcards, summary, slides, chart) using the semantic
 * classes styled below, so every section prints with a consistent look.
 *
 * IMPORTANT: the `window.print()` call is embedded in the NEW tab's own document (the
 * inline script below), NOT called from the opener. `print()` is synchronous and blocks
 * whichever thread invokes it until the dialog is dismissed — calling it from the
 * Talktofile tab would freeze the whole app until Save/Cancel. Running it inside the new
 * tab keeps Talktofile fully interactive while the print/Save-as-PDF dialog is open.
 */
export function printAsPdf(opts: { title: string; subtitle?: string; bodyHtml: string }): void {
  const { title, subtitle, bodyHtml } = opts
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Talktofile: ${escapeHtml(title)}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:40px;background:#f8fafc;color:#0f172a}
  h1{font-size:22px;font-weight:700;color:#1e293b;margin:0 0 4px}
  .meta{font-size:12px;color:#94a3b8;margin-bottom:28px}
  h2{font-size:16px;color:#0f172a;margin:24px 0 8px}
  h3{font-size:14px;color:#0f172a;margin:18px 0 6px}
  p{font-size:14px;line-height:1.65;margin:0 0 8px}
  ul{font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 12px}
  pre{white-space:pre-wrap;font-family:'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.65;margin:0 0 12px}
  .content{max-width:820px}
  .line{margin:0 0 14px}
  .speaker{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#E2611B;margin-bottom:2px}
  .card{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:0 0 12px;page-break-inside:avoid}
  .card .q{font-weight:600;color:#0f172a;font-size:14px}
  .card .hint{color:#64748b;font-style:italic;font-size:13px;margin-top:4px}
  .card .a{color:#E2611B;font-weight:500;font-size:14px;margin-top:6px}
  .slide{border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin:0 0 14px;page-break-inside:avoid}
  .slide .note{color:#64748b;font-size:12px;margin-top:8px;border-top:1px solid #f1f5f9;padding-top:6px}
  table{border-collapse:collapse;font-size:13px;margin:0 0 12px;width:100%;max-width:820px}
  th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
  th{background:#f1f5f9;font-weight:600}
  svg{max-width:100%;height:auto}
  .msg{margin:0 0 20px;page-break-inside:avoid}
  .msg .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
  .msg.user .label{color:#E2611B}
  .msg.assistant .label{color:#0f172a}
  .msg .body{font-size:14px;line-height:1.65;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px}
  .msg.user .body{background:#fdf4ee;border-color:#f6cbab}
  .type{display:inline-block;font-size:11px;font-weight:600;color:#E2611B;background:#fdf4ee;border:1px solid #f6cbab;border-radius:999px;padding:2px 10px;margin:0 0 10px}
  .footer{margin-top:40px;font-size:11px;color:#cbd5e1;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{background:#fff;padding:24px}}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${subtitle ? `${escapeHtml(subtitle)} &nbsp;·&nbsp; ` : ''}Exported ${new Date().toLocaleString()}</div>
<div class="content">${bodyHtml}</div>
<div class="footer">Generated by Talktofile · talktofile.ai</div>
<script>
  // Runs in THIS tab's thread (not the opener's), so the modal print dialog blocks only
  // this tab — Talktofile stays interactive. A plain timeout (rather than the load event,
  // which may already have fired after document.write) reliably fires; the delay lets
  // content (incl. any chart SVG) lay out before the print preview snapshots it.
  setTimeout(function () { window.print() }, 300)
</script>
</body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
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
export async function shareOrCopy(text: string, title = 'Talktofile'): Promise<'shared' | 'copied'> {
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
