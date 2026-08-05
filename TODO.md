# Talktofile — Pending Work

Implementation specs for features that are **stubbed in the UI but not built**. Moved out of
`CLAUDE.md` on 2026-08-05 so the handover file stays small; the specs below are unchanged.

`STATUS.md` lists these as one-liners and points here. When you pick one up, read the spec here —
and delete it from this file once it ships (updating `STATUS.md` in the same task).

---

## Stubbed features (frontend exists, backend missing)

- **Add a custom translation language (PENDING — backend + a small frontend wire-up).** The Translate
  section's "Translate to" dropdown now has an **"+ Add new language"** option (sentinel `ADD_NEW_LANG`
  in `TranslateView.tsx`) that reveals an inline text box ("Enter the language name here."). **Today
  the whole thing is a stub:** submitting the box only flashes a "Coming soon" bubble — no language is
  validated or added. What still needs to happen:
  - **Backend (not built):** add an endpoint (e.g. `POST /api/tools/translate/languages {name}`) that
    **verifies the entered name is a real, translatable language** (normalise/canonicalise it — e.g.
    map "brazilian" → "Portuguese", reject gibberish/unsupported input) and returns the canonical
    language name (plus an error message when it's not valid). Keep it rate-limited like the other
    tool endpoints. (The translate model call itself already takes an arbitrary target language string,
    so no change to `translate_agent.py` is required — this endpoint is purely the validation gate.)
  - **Frontend wire-up (when the backend exists):** in `TranslateView.tsx`, replace the `TODO(add-language)`
    stub in `submitNewLang`:
    1. On submit, call the new endpoint with `newLang` (show a small inline spinner/disabled state).
    2. **On success:** append the returned canonical name to the dropdown list — `LANGUAGES` is a
       module const today, so lift it into component state (e.g. `const [languages, setLanguages] =
       useState(LANGUAGES)`) and `setLanguages((l) => [...l, canonical])`; then `setTargetLang(canonical)`,
       `setShowAddLang(false)`, and clear `newLang`. (Optionally persist the user's custom languages to
       `localStorage` so they survive a reload.)
    3. **On failure:** show the returned validation error inline near the box (reuse the `notice`/amber
       pattern or a small red line) instead of the "Coming soon" bubble.
    4. **Remove the "Coming soon" bubble** (`showComingSoon`/`submitNewLang`'s timer) once real handling
       is in place.
- **Continue an over-length translation (PENDING — backend + a small frontend wire-up).** Long
  documents are **truncated** when translated: `agents/translate_agent.py` caps the source at
  `source_text = (doc.raw_text or …)[:14000]` chars and the model output at `max_tokens=4000`, so the
  tail of a long doc is silently dropped / the translation stops mid-way. The Translate section now
  shows a **"Continue"** button at the end of the results (styled like the Flashcards "Finish" button),
  but **it's a stub** — no `onClick`, just a `Tooltip label="Coming soon"`. To make it work:
  - **Backend (not built):** the current translate call is single-shot and stateless. Add a way to
    translate the **next** slice of the source rather than re-translating from the top. Two options:
    - *Simplest:* extend `translate_document` / the `POST /api/tools/translate` route to accept an
      **offset** (char index into `doc.raw_text`) and return the next `[offset : offset+14000]` window
      plus the **new offset** (and a `done` flag when the end of `raw_text` is reached). The frontend
      calls it repeatedly, appending each window's translation. Raising `max_tokens` (gpt-4o supports up
      to 16,384 output tokens) reduces how often "Continue" is needed but doesn't remove the input cap.
    - *Cleaner long-term:* a **chunked/paged translation** endpoint that walks the whole `raw_text` in
      windows server-side and streams/returns the full translation, retiring the manual "Continue"
      entirely. Keep it rate-limited + usage-logged like the other tool endpoints.
    - **⚠️ Not conversational:** unlike Podcast's `extendPodcast` (which passes the prior script back as
      context), translation "continue" must be **offset-driven** — the model has no memory of where it
      stopped, so "continue" prompting alone would re-translate or drift. Track the offset explicitly.
  - **Frontend wire-up (when the backend exists):** in `TranslateView.tsx`, give the "Continue" button
    a real `onClick` that calls the new endpoint with the current offset, **appends** the returned text
    to that document's `translated_text` (per-doc offset state), shows a spinner while in flight, hides
    the button once the backend reports `done`, and **removes the `Tooltip`/"Coming soon"** wrapper.
    Note `raw_text` may not be available client-side today — the offset/`done` bookkeeping should live
    on the backend response so the frontend just loops until `done`.

---

## Other known gaps

These have no spec yet — they are design decisions, not half-built features.
See `STATUS.md` → *Not started* for the current one-line status of each:
real billing, chat/document persistence, OCR for scanned PDFs, and pre-rendered landing HTML (SEO).
