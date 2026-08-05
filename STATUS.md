# Talktofile — Current Status

**What is true right now.** Every section is **rewritten in place**, never appended to — if a feature
moves between not-started / in-progress / done, or gets reverted, edit its entry so this file always
describes the present. There are no dates and no history here; that's `CHANGELOG.md`'s job.

*Last reviewed: 2026-08-06.*

---

## Shipped — working today

| Area | State |
|---|---|
| **Auth** | Guest + registered (legacy JWT *or* Supabase). **Google** social sign-in live. Password reset works in both modes (Supabase-handled, or native single-use 30-min token via Resend). |
| **Upload & pipeline** | Single / multi / compare modes. Extract → index → summarize across PDF, Word, Excel, PowerPoint, HTML, JSON, CSV, Markdown, text, and many source formats. Zero-text files are skipped (not fatal) in a multi-file batch. |
| **Chat** | Streaming Q&A over WebSocket with auto-reconnect, suggested questions, citation grounding. |
| **Tool sections** | Summary, Flashcards, Podcast, Slides, Translate, Charts — all six render and generate. |
| **Slides** | Editable, AI-refinable, themeable decks; free for all (Pro gate removed). Inline render + opt-in .pptx download that reuses already-generated slides. |
| **Chapters** | Segmentation + chapter-scoped summaries. Left doc panel filters to the selected chapters. |
| **Ops** | Plan limits, per-day usage caps, rate limiting, feedback capture, persona (Pro), Dockerized production serving behind Caddy. |
| **SEO `<head>`** | Title, description, and OG image are in the raw HTML — social previews and search titles work. |

---

## In progress

Nothing is mid-flight. The last change was hero headline copy (now *"Make anything."*); the layout
constraint that governs it is documented in `CLAUDE.md` → Design / Brand.

---

## Not started — known gaps

**Stubbed in the UI, backend missing** — full specs in `TODO.md`, don't re-derive them:
- **Add a custom translation language.** The "+ Add new language" box exists but only flashes
  "Coming soon". Needs a validation endpoint plus a small frontend wire-up.
- **Continue an over-length translation.** Source is truncated at 14,000 chars; the "Continue"
  button is a no-op. Needs an **offset-driven** endpoint — explicitly *not* a conversational
  "continue".

**Not stubbed, simply absent:**
- **Real billing.** Pro is granted only via the `PRO_EMAILS` env var; there is no payment flow.
- **Persistence of chats/documents.** By design — sessions are in-memory and lost on refresh. A
  confirm dialog and a `beforeunload` guard mitigate accidental loss; there is no save/restore.
- **OCR.** Files with images are no longer rejected (the text layer is extracted, images ignored),
  but a fully scanned file has nothing to read. In a batch it's skipped; as a lone file it fails
  with a "run OCR first" message.
- **Chapter scoping beyond Summary.** The shared mechanism is built and meant to be reused. Extending
  it to Translate / Flashcards / Podcast / Slides means accepting `chapter_ids` in that tool's
  endpoint. **Charts is tabular** (different shape). **Chat is the biggest** — retrieval needs
  chunk-level chapter tagging, and chunks aren't tagged yet. Multi-document scoping currently targets
  the first document only.
- **Pre-rendered landing HTML.** Low priority — **do this well after the blog has posts**, which is
  the bigger SEO lever. Decided approach: a **Vite prerender plugin** emitting static HTML for the
  landing route, with React hydrating it, so the in-place upload UX needs no refactor. (Rejected:
  an Astro rewrite — real refactor, since `Landing.tsx` couples marketing to the upload flow; and
  Next.js — a full rewrite for one page.) Guard SSR-unsafe code at snapshot time: `window`,
  `localStorage`, WebSockets, the theme script, PostHog.

**Easy wins, not yet taken:**
- Two unused webfonts (**Inter**, **Plus Jakarta Sans**) are still downloaded in
  `frontend/index.html` despite 0 uses in `src/`. Deleting the `<link>` is a free perf win with zero
  visual change. Same for the unused `obsidian` / `cyan` palettes in `tailwind.config.js`.

---

## Parked on purpose — off, but not dead code

Do not delete these as cleanup; each is a one- or two-line restore. Restore instructions live in
`CLAUDE.md` → *Temporarily Hidden UI*.

- **Intro-offer promo splash** — off via `INTRO_OFFER_ENABLED = false` **and** a commented-out render.
  Both are required: the flag alone stops the timer from burning the once-a-day cooldown key.
- **Landing "Plans" section** — the whole `<section id="plans">` is commented out; `PLAN_FEATURES`
  still sits at the top of `Landing.tsx`.
- **Microsoft + LinkedIn sign-in** — commented out of `SOCIAL_PROVIDERS`. ⚠️ Code alone won't revive
  them; the `azure` / `linkedin_oidc` providers must also be configured in the Supabase dashboard.
  Google is unaffected and stays live.

---

## Dead code

- `src/components/WorkspaceComposer.tsx` — superseded by `SectionComposer`, imported nowhere. Safe
  to delete (unlike everything in *Parked* above).
