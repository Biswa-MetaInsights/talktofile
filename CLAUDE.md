# Talktofile — Project Handover for Claude

> You are picking up an active project. Read this file fully before making any changes — it is
> deliberately kept short enough that you can.
>
> **It holds instructions, not history.** Where each kind of writing goes:
>
> | Writing | File |
> |---|---|
> | *How to work on this* — conventions, gotchas, rules still true tomorrow | **`CLAUDE.md`** (here) |
> | *What state things are in right now* — shipped / in progress / not started / parked | **`STATUS.md`** (rewritten in place) |
> | *What meaningfully changed* — one short line per feature, decision, or revert | **`CHANGELOG.md`** (appended) |
> | *Specs for what's left to build* | **`TODO.md`** |
>
> Before you add a line here, check it against the code — see *Contribution Guidelines → Keeping this
> file true*.

> **Two-developer project:** This is built and run by **Gautham Krishna** and **Biswajith
> Gopinathan**, on at least two separate Windows desktops. That means:
> - **Never hardcode machine-specific absolute paths** in code or scripts. Use relative paths
>   from the repo root, or paths derived at runtime.
> - **Secrets live in `backend/.env` and are git-ignored.** Each developer keeps their own local
>   copy with their own `OPENAI_API_KEY`. Never commit `.env`. Never paste a real key into this
>   file, a commit, or a screenshot.
> - The local dev database (`backend/talktofile.db`, SQLite) is per-machine and not shared.

---

## Execution Rules (read before every task)

- Before starting any task, identify the exact files needed. Open **only** those files.
- Do **not** explore the full project structure unless explicitly asked.
- Do **not** read `venv/`, `node_modules/`, `__pycache__/`, `dist/`, or any build/cache directories.
- Do **not** re-read files you have already read in this session.
- If a task touches only one component, open only that component file.
- **After any TypeScript change**, run a type-check in `frontend/`: `./node_modules/.bin/tsc --noEmit`
  (or `npm run build`). Do not report a task done if the type-check fails.
- **After any backend change**, confirm the app still imports: from `backend/`, run
  `./venv/Scripts/python -c "import main"`.
- **If you change something this file describes, fix the description in the same task** — not at the
  end, not next session. **A stale instruction is worse than no instruction:** it doesn't just waste
  tokens, it actively produces wrong work. Changing an accent colour, a port, a limit, or a
  component's job means editing the matching line here before you report done.
- After completing a task, list only the files you modified.
- **Before building anything complex, state your interpretation of the task and confirm before
  proceeding** — especially when the request is ambiguous or could go several ways. A brief
  "Here's what I'm planning — does that sound right?" prevents wasted effort.

---

## What Is Talktofile?

Talktofile is a private, agentic **"chat with your document"** web app. A user uploads one or
more files (PDF, Word, Excel, PowerPoint, HTML, JSON, CSV, Markdown, plain text, and many
source-code formats), the backend extracts and indexes the text, and the user asks questions in
natural language. An AI assistant answers **only from the document content**
(no hallucinations) and streams replies in real time over a WebSocket. Documents in any language
are answered in clear English.

⚠️ **The assistant has no product name — don't give it one.** It calls itself "your personal
document assistant within Talktofile" (the identity string in `agents/sage_agent.py`), and no UI
string names it. It *was* called **"Sage"**; that name is gone from everything that reaches a user
(including generated personas — `persona_agent.py` is explicitly instructed not to name it) and
survives only in **code comments, the `sage_agent.py` / `SageAgent` identifiers, and
`APP_OVERVIEW.md` / `PITCH.md`**. Those are leftovers, not the current name — don't reintroduce it
in user-facing copy, prompts, or persona text.

Key product principles: **accurate (sourced answers only), private (files live in memory for the
session, not persisted to disk), and simple.**

There are two plans: **free** (1 file, ≤5 MB) and **pro** (up to 5 files, ≤8 MB each, document
comparison + multi-file analysis). Real billing does not exist yet — Pro is granted to specific
emails via the `PRO_EMAILS` env var.

---

## Repository Layout

The repo was cloned from the fork `github.com/Gautham-gk/talktofile` into a `talktofile/` folder.
This `CLAUDE.md` lives at that repo root.

```
talktofile/                    ← repo root (this file lives here)
├── backend/                   ← FastAPI backend (Python)
│   ├── main.py                ← app factory, middleware, router wiring
│   ├── agents/                ← the AI agent pipeline (see Architecture)
│   ├── core/                  ← config, db, auth, session store, rate limiting, usage caps
│   ├── models/                ← SQLAlchemy models + Pydantic schemas
│   ├── routers/               ← auth / document / chat / feedback HTTP + WS endpoints
│   ├── alembic/               ← DB migrations (auto-run on startup)
│   ├── requirements.txt
│   ├── .env                   ← secrets (git-ignored; each dev keeps their own)
│   ├── .env.example           ← template — copy to .env and fill in
│   └── venv/                  ← local virtual environment (git-ignored, per-machine)
├── frontend/                  ← React + Vite + TypeScript + Tailwind
│   ├── src/                   ← app code (see Component Registry)
│   ├── package.json
│   ├── Caddyfile / Dockerfile ← production serving
│   └── vite.config.ts
├── docker-compose.yml         ← full prod stack (Caddy + backend + frontend)
├── start-dev.ps1              ← Windows dev launcher (starts both servers)
├── CHANGELOG.md               ← dated log of every session's work (append here, newest first)
├── TODO.md                    ← specs for stubbed-but-unbuilt features
├── DEPLOY.md                  ← deployment notes
├── SUPABASE_SETUP.md          ← optional Supabase auth setup
└── PITCH.md                   ← product pitch
```

---

## Related Documents (in the repo root)

Don't duplicate these — read the source file when you need the detail. Quick map of what each covers:

| File | What's in it |
|---|---|
| `STATUS.md` | **The project's current state** — what's shipped, in progress, not started, or parked on purpose. **Rewrite the relevant section in place; never append.** Update it whenever something moves between those states or gets reverted. This is the first file to read when picking the project up, and the one to fix when reality drifts from the docs. |
| `CHANGELOG.md` | **The project's history** — newest first (was `CLAUDE.md`'s "Progress Log" until 2026-08-05). **One short line per meaningful change: a feature landing, a decision, a revert.** Not every file edit. **Skip it entirely** for small tweaks, refactors, and work-in-progress — and **never log churn that was reverted in the same session**. Unsure whether a change qualifies? It doesn't — update `STATUS.md` only. |
| `TODO.md` | Full implementation specs for the features that are **stubbed in the UI but not built** (add a custom translation language; continue an over-length translation). `STATUS.md` lists them as one-liners — read the spec here before picking one up, and delete it from `TODO.md` once it ships. |
| `PITCH.md` | Product pitch: the problem, the multi-agent solution, key features, a competitor comparison table (vs ChatPDF/Humata/ChatGPT upload/NotebookLM), target users, and the tech stack. Read for product *intent* before building features. |
| `DEPLOY.md` | Production deploy: single-VM Docker Compose (FastAPI + Caddy auto-HTTPS, WebSocket-aware reverse proxy), why it runs **one Uvicorn worker** and scales vertically (in-memory sessions), the prod `backend/.env` + compose `.env`, build/run/update commands, and ops notes (OpenAI budget alerts, `/api/health` monitoring). |
| `SUPABASE_SETUP.md` | Optional Supabase **Auth + Postgres** setup: creating the project, enabling email + anonymous (guest) sign-ins, the connection string, the exact backend/frontend env vars, and how Supabase JWTs map to local `users` rows. Unset those vars → app falls back to built-in auth + SQLite. |

---

## Prerequisites

| Tool | Required version | How to check |
|---|---|---|
| Python | **3.10+** (we develop on 3.13) | `py -0p` (Windows) or `python --version` |
| Node.js | 18+ (we use v24) | `node --version` |
| npm | any recent | `npm --version` |

> **⚠️ Python version gotcha (recorded from setup):** `requirements.txt` originally pinned
> `faiss-cpu==1.9.0`, which has **no wheel for Python 3.13** and fails to install. It was bumped to
> **`faiss-cpu==1.9.0.post1`**. If you set up on a different Python version and hit a dependency
> install error, open `backend/requirements.txt` and bump the offending pin to a version that has
> a wheel for your interpreter.

---

## How to Run

Two parts run in separate terminals: the **backend** (FastAPI, port **9099**) and the
**frontend** (Vite dev server, port **5173**). Both must be running for the app to work.

### Backend — First-Time Setup

From the `backend/` folder:

```powershell
# 1. Create the virtual environment (use your installed 3.10+ interpreter).
py -3.13 -m venv venv

# 2. Install dependencies into it.
./venv/Scripts/python -m pip install --upgrade pip
./venv/Scripts/python -m pip install -r requirements.txt

# 3. Create your .env from the template and add your OpenAI key.
#    (Copy .env.example to .env, then set OPENAI_API_KEY=sk-...)
```

Minimum working `backend/.env` for local dev:
```
OPENAI_API_KEY=sk-your-real-key-here
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```
- `SECRET_KEY` is **not** required in development — the app accepts a built-in default when
  `ENVIRONMENT=development`. It is **required** (must be a strong random string) when
  `ENVIRONMENT != development`, or the app refuses to start (`validate_for_runtime()` in
  `core/config.py`). Generate one with: `python -c "import secrets;print(secrets.token_urlsafe(48))"`.
- The database auto-creates: on startup the app runs Alembic migrations against SQLite
  (`backend/talktofile.db`). No manual seed step.

### Backend — Everyday Use

From `backend/`:
```powershell
./venv/Scripts/python -m uvicorn main:app --reload --host 0.0.0.0 --port 9099
```
- API docs (dev only): http://localhost:9099/api/docs
- Health check: http://localhost:9099/api/health

### Frontend — First-Time Setup

From `frontend/`:
```powershell
npm install
```
(Optional: `cp .env.example .env` at the repo root for Supabase/compose vars. The frontend works
without it — it falls back to legacy auth when `VITE_SUPABASE_*` are blank.)

### Frontend — Everyday Use

From `frontend/`:
```powershell
npm run dev
# Opens at http://localhost:5173
```

### Run both at once (Windows convenience)

`start-dev.ps1` at the repo root starts both servers in separate windows. **It expects
`backend/venv` to already exist and `backend/.env` to be present** — do the first-time setup above
once before using it.

---

## Architecture

### Backend (FastAPI microservice-style, single app)
All routes are under `/api`. Routers: `auth`, `document`, `chat`, `feedback` (see
`backend/routers/`). Real-time work happens over **two WebSockets**:
- **Processing WS** — the browser uploads file bytes; the backend streams pipeline progress
  (`extracting` → `analysing` → `ready`).
- **Chat WS** — streams the assistant's answer token-by-token, plus `done` / `guard_reject` /
  `limit` / `error` / `feedback_prompt` control messages.

**The agent pipeline** (`backend/agents/`) — uploads are processed by an orchestrated set of agents:
| Agent | Role |
|---|---|
| `orchestrator.py` | State machine: Extract → Lingua → Analyst → Ready. Also holds all per-format text extraction (PDF via pdfplumber+PyMuPDF, docx/xlsx/pptx, html, json, plain text) with zip-bomb and scanned-PDF guards. A file yielding **zero** text is **skipped** (name collected in `session.skipped_files`) so the rest of the batch still processes; it only raises `NoReadableTextError` when **no** file produced text. `MalformedFileError` (corrupt) still aborts. |
| `chapters.py` | **Not an agent — a pure helper.** `segment_into_chapters(raw_text)` returns ordered `{index, id("ch1"…), title, start, end}` **char offsets** into `raw_text` (no text is duplicated), by heading heuristics with a `[Page N]`/`[Slide N]` fallback — **no model call**. `public_chapters` strips offsets for the API; `chapters_text` concatenates selected chapters (empty/unknown ids → whole doc). |
| `lingua_agent.py` | Detects document language (skipped for code/markup/data files). |
| `analyst_agent.py` | Chunks text, embeds, builds the FAISS index, writes the summary, and generates suggested questions. |
| `sage_agent.py` | The answering assistant — retrieves relevant chunks and answers from document content only. |
| `guard_agent.py` | Rejects out-of-scope / unsafe questions (`guard_reject`). |
| `persona_agent.py` | Optional Pro personalization of the assistant for a user's domain. Its output is prepended verbatim to the answering prompt, so the generator is told **not to name the assistant** — see the naming rule under *What Is Talktofile?* |

**Config & limits** (`core/config.py`): plan tiers, per-day usage caps (cost control against the
OpenAI bill), CORS origins, Supabase toggle. Sessions live in memory (`core/session_store.py`) —
documents are **not** written to disk.

**Auth** (`core/auth.py`, `core/supabase_auth.py`): legacy custom JWT by default. If
`SUPABASE_JWT_SECRET` is set, the backend verifies Supabase-issued JWTs instead. See
`SUPABASE_SETUP.md`.

> **⚠️ `SUPABASE_URL` is required, not optional, on any current Supabase project.** New projects issue
> **asymmetric** access tokens (ES256/RS256), and the backend needs `SUPABASE_URL` to fetch the JWKS that
> verifies them. Leave it unset and **every** Supabase token — including OAuth sign-ins — is rejected as
> "Invalid token", which looks like a login bug rather than a config gap. Only legacy HS256-only projects
> can omit it. Details in `backend/.env.example`.
>
> Note this also means a machine whose `.env` is in **Supabase mode** will reject legacy `/auth/guest`
> tokens outright — worth knowing before you conclude a script or test is broken.

### Frontend (React + Vite + TypeScript + Tailwind v3)
- `src/App.tsx` — top-level shell. Manages `session` state (a non-null `session` = "in a chat"),
  the landing vs. app view, and modals. Layout: optional left document panel (`hidden lg:flex`) +
  chat panel.
- WebSockets and the REST client live in `src/api/client.ts`.
- Auth state via `src/context/AuthContext.tsx`. Analytics via `src/lib/analytics.ts` (PostHog).
- Markdown answers rendered with `react-markdown` + `remark-gfm`. Animations via `framer-motion`.
  Drag-and-drop upload via `react-dropzone`. Icons via `lucide-react`.

---

## Component Registry

One line per file: what it is, plus only the **non-obvious gotcha** — the thing you'd get wrong
without being told. Full history of how each got this way is in `CHANGELOG.md`. Keep entries
short; add a component when you create one, and fix the gotcha when it changes.

### Shell & state

| File | Purpose | Gotcha |
|---|---|---|
| `src/App.tsx` | App shell, view + session state, modals | Owns the `beforeunload` refresh guard (only while a session exists) and the auto-feedback prompt (in-app via `promptFeedback()`, cross-reload via the `PENDING_FEEDBACK_KEY` localStorage flag). Also decides when `IntroOfferBanner` shows. Holds `chapterScope` (scoping also opens the doc panel on that file; resets on new session / reset / end). Heights use `100dvh`, not `100vh`. `FeedbackModal` must stay rendered in **both** the landing early-return and the main return. ⚠️ The **skipped-files amber banner** must stay **outside** the workspace `motion.div` — its inline transform traps a `fixed` child (same gotcha as the Slides portal). |
| `src/context/AuthContext.tsx` | Auth state | |
| `src/context/ThemeContext.tsx` | Light/dark theme (`useTheme`) | Persists to `localStorage.theme`, defaults to OS preference until the user picks explicitly, toggles the `dark` class on `<html>`. Pre-seeded by an inline script in `index.html` to avoid FOUC. Tailwind is `darkMode: 'class'`. |
| `src/api/client.ts` | REST client + both WebSockets | |

### Entry & chrome

| File | Purpose | Gotcha |
|---|---|---|
| `src/components/Landing.tsx` | Marketing landing **+ the primary upload/intent flow** | Its **"Plans" section is currently commented out** — see *Temporarily Hidden UI*; leave it and `PLAN_FEATURES` alone. The hero owns the upload: files process in-place via `useDocumentProcessor` while the user stays on the page, then they pick a mode and type a first prompt → `onEnter(session, mode, prompt)`. The headline uses an explicit responsive `<br>` — don't replace it with auto-wrap (see Design / Brand). Hero mode tabs render `MODE_ICONS` imported from `ModeSwitcher` at 18px; the card is `max-w-4xl` and the Podcast label is shortened to "Podcast" **so all seven tabs fit one row** — widen the label or add a mode and it wraps, so re-check at 1024/1280px. |
| `src/components/Navbar.tsx` | Top nav | `mark-white.svg` in dark mode, `mark-color.svg` in light. Its tooltips use `side="bottom"` — the one exception to the site-wide `right` default. |
| `src/components/ThemeToggle.tsx` | Light/dark switch | |
| `src/components/IntroOfferBanner.tsx` | Post-first-action promo card | **Currently switched OFF** — see *Temporarily Hidden UI*; intentionally kept for later, so don't delete it as dead code. **Controlled component** (`show`/`onClose`/`onSignUp`) — it does not show itself. Gating lives in `App` (`handleFirstAction`, `INTRO_OFFER_*`); `ttf_intro_offer_seen` stores last-shown **epoch ms**, not a date. Auto-closes after `TOTAL_SECONDS`. |
| `src/components/UploadZone.tsx` | Upload + processing UI | **Fallback path only** (e.g. password-recovery entry) — Landing is the primary upload. |
| `src/hooks/useDocumentProcessor.ts` | Shared upload→process pipeline | Drives the processing WS (`extracting`→`analysing`→`ready`) and fires `document_uploaded`. **Does not navigate** — the caller reacts to `session`. |

### Workspace frame

| File | Purpose | Gotcha |
|---|---|---|
| `src/components/WorkspaceHeader.tsx` | Top bar for the **non-chat** sections | A deliberate **copy** of the chat's header row, not an extraction — chat keeps its own inline header as the reference. Share/Export act on the **currently open section**: each tool view registers `registerSectionActions(mode, { share, exportPdf })` with `AppShell`. Both disabled until `canAct`. |
| `src/components/SectionComposer.tsx` | **The single shared bottom composer for every section** | Per-section differences are **props only** — `proceedButton`, `placeholder`, optional `pickerRow`. Owns auto-grow (44–120px), mic-append, Enter behaviour. Pass `value`/`onChange`/`onSubmit` to control it (chat does); omit them and Enter shows a **"Coming soon"** bubble. `onSubmit` may return `false` to mean "not handled" → bubble still shows (Podcast relies on this). ⚠️ When cross-section chat lands, pass a real `onSubmit` from the tool views so that branch is dead — see `TODO(coming-soon)`. |
| `src/components/ModeSwitcher.tsx` | The feature-tab bar | Single source of truth for `SWITCH_MODES`, `MODE_LABELS` **and `MODE_ICONS`** (exported, keyed by `AppMode`) — `Landing` imports the icon map from here, so **add a new mode's icon here, not in both places**. **Renders two things and swaps them with CSS, not JS:** a dropdown below `sm` (7 tabs wrapped to 3 rows on a phone) and the pill tab row at `sm`+ — change a tab and change both. The dropdown opens **upward** (the composer is bottom-anchored) and closes on outside-click/Escape. Engaged-but-inactive sections are marked **brand-orange** (border on a tab, orange row + dot in the dropdown; the closed trigger shows a dot when any *other* section is engaged). Rendered by `SectionComposer`, not by the views. |
| `src/components/SectionExtras.tsx` | "Follow-up suggestions" + "Preferences" placeholder rows | Must be the **last child of the view's `overflow-y-auto` div** so it scrolls with content instead of pinning above the composer. Still blank placeholders. |
| `src/components/WorkspaceComposer.tsx` | **Dead — superseded by `SectionComposer`, imported nowhere.** Safe to delete. | |
| `src/components/DocumentPanel.tsx` | Slide-in panel with a document's original text — **full, or scoped to chapters** | **Sits in-flow** (`fixed lg:relative`, `lg:w-96`) so the main panel *shrinks* rather than being covered; mobile gets a tap-to-dismiss backdrop. Fetches lazily. `openDoc` + `toggleDocPanel` live in `AppShell`; reachable from every section's header icon. Given `chapterIds` it fetches **filtered** content and shows a banner + full/filtered toggle; "Clear filter" calls `onShowFull` to return to the whole document. |
| `src/components/ChapterPicker.tsx` | Reusable chapter checklist, rendered as a composer `pickerRow` | "All chapters" = **empty selection**, not every id. Built to be reused by the other tool views as chapter-scoping rolls out — don't fork it. |
| `src/lib/chapters.ts` | Chapter-selection text parsing | `parseChapterSelection` **requires a chapter keyword** (so an ordinary prompt with a number in it isn't misread as a scope); handles "chapters 1 and 2" and ranges "1-3", matching numbers to titles then position. Also `isWholeDocument`, `selectedTitles`. |

### Chat & citations

| File | Purpose | Gotcha |
|---|---|---|
| `src/components/ChatWindow.tsx` | The chat experience | Chat WS lifecycle with auto-reconnect + streaming. `initialPrompt` (from the landing box) auto-sends once connected — guarded against resend on reconnect. Renders its own populated follow-ups, which is why `SectionComposer` excludes chat from `SectionExtras`. |
| `src/components/MessageBubble.tsx` | Renders one message (markdown) | Runs `buildCitations`, then swaps injected `⟦C{n}⟧` tokens for `<CitationMarker>` via `react-markdown` `components` overrides — must recurse through nested inline nodes. |
| `src/components/CitationMarker.tsx` | Inline ¹²³ marker + hover popover | The popover needs its **invisible `pb-2` bridge** + 120ms close delay, or the cursor can't reach it. Inline `fontSize` beats the 16px CSS floor. |
| `src/lib/citations.ts` | Citation grounding heuristics | Pure text heuristics — **never changes answer wording**, only marker placement. |
| `src/components/TypingIndicator.tsx` | The "assistant is typing" bubble | **Wordless** — the "T" avatar plus three animated dots, no label. Don't add text naming the assistant. |

### Tool views

All six render their own bottom bar via `SectionComposer` and their own `ModeSwitcher`, so
`App.tsx` hides `WorkspaceComposer` for them, and all take `onSwitchMode` + `engagedModes`.

| File | Purpose | Gotcha |
|---|---|---|
| `src/components/SummaryView.tsx` | Full-page summary — **the first tool view wired for chapter scoping** | Two paths, and the difference costs money: **whole document** reveals the summary precomputed by the upload pipeline (`doc.summary`) — free and instant, no call; **chapter-scoped** hits `POST /tools/summary/{id}` and **is charged against the daily question limit**. Shows `ChapterPicker` when >1 chapter; a **typed request wins over the checklist**. Calls `onChapterScope(...)` so the left panel filters, and clears the scope on revert/unmount. `onActivity` fires on generate, not mount. |
| `src/components/FlashcardsView.tsx` | Flashcards study tool | |
| `src/components/PodcastView.tsx` | Podcast scripts | The shared chatbox is wired: **"continue"** (see `isContinueRequest`) calls `extendPodcast`; anything else returns `false` → "Coming soon" bubble. |
| `src/components/SlidesView.tsx` | Slide decks — **editable, AI-refinable, themeable** | Free for all (Pro gate removed). Renders **inline** — never auto-downloads. Backend `POST /tools/slides/{id}` returns **JSON `{slides,title}`**, not a blob; download is opt-in via `POST /tools/slides/{id}/download` and reuses the already-generated slides (**no second model call**). `SlideCanvas` uses container-query `cqw` units so one markup scales preview → fullscreen, and is theme-aware (`{preset, accent}` — Classic/Minimal/Bold + colour picker, mirrored in the .pptx). Edited **in place** via the inner `SlideEditor` (immutable array updates). This is the **one tool view whose `SectionComposer` input is fully wired** — typing an instruction calls `POST /tools/slides/{id}/refine`, **charged like a generation**. Cover author defaults `full_name` → `username` → "Guest" and is session-only (never persisted). |
| `src/components/TranslateView.tsx` | Translate tool | Language picker sits in the composer's `pickerRow`. Two stubs live here — `TODO(add-language)` and the "Continue" button; specs in `TODO.md`. |
| `src/components/ChartsView.tsx` | Data visualisation (Recharts) | Chart-type picker occupies the `pickerRow` slot. |

### Modals & shared primitives

| File | Purpose | Gotcha |
|---|---|---|
| `src/components/AuthModal.tsx` | Login / signup / password reset | Social buttons come from `SOCIAL_PROVIDERS`; **only Google is live** — Microsoft + LinkedIn are commented out (see *Temporarily Hidden UI*), though their icons and the `OAuthProvider` union in `AuthContext` still carry them. `provider` values are **Supabase ids**, not display names: `azure` = Microsoft, `linkedin_oidc` = LinkedIn (the legacy `linkedin` id is deprecated). |
| `src/components/PersonaModal.tsx` | Pro persona configuration | |
| `src/components/FeedbackModal.tsx` | Feedback form | |
| `src/components/ConfirmDialog.tsx` | Reusable confirm dialog | |
| `src/components/SummaryCard.tsx` | Summary display | `compact` variant for the side panel + drawer. |
| `src/components/Tooltip.tsx` | **The** tooltip — never re-style per location | See Design / Brand for the full rule. |
| `src/components/AvatarUpload.tsx` | Avatar picker | Downscales client-side to a 256×256 JPEG data URL before returning it, so the stored value stays tiny. Persisted to `UserProfile.avatar`. |
| `src/components/MicButton.tsx` | Voice-dictation button | **Engine-agnostic** — imports the hook as `useVoiceDictation`; swap the import to change engine. Pushes text to `onTranscript`; the caller appends it and **owns the text**. Renders nothing where voice is unsupported. |
| `src/hooks/useVoiceDictation.ts` | **ACTIVE** engine — record → Whisper | Chosen because it works in **every** browser incl. Brave, but **costs money per use**. Needs a secure context. `hardReset()` per attempt so the button can't stick. |
| `src/hooks/useWebSpeech.ts` | **DORMANT** engine — Web Speech API | Free and browser-native, but **blocked in Brave/Firefox** — that's why it isn't active. Same return shape; swap `MicButton`'s import to re-enable. |
| `src/lib/share.ts` | Share/export helpers | `withAttribution()`, `downloadText()`, `shareOrCopy()`, and `printAsPdf()` (opens a print view → browser "Save as PDF"). `escapeHtml()` is exported so sections can build safe `bodyHtml`. Link target is `window.location.origin` — **never hardcode the domain**. |
| `src/lib/smoothScroll.ts` | `smoothScrollTo` | Use instead of native smooth `scrollIntoView` (see Design / Brand). |
| `src/lib/displayName.ts` | `displayName(user)` — the name to show a signed-in user | **`user.username` is an email address** (always in Supabase mode; legacy sign-up requires one too), so never render it raw as a name. `displayName` returns `profile.full_name` if set, else the part before `@`. Used by the Navbar; reach for it anywhere a username is shown as a person. |
| `src/lib/analytics.ts` | PostHog analytics | |

---

## Design / Brand

Clean, minimal, premium. **Simplicity is the priority — do not add unnecessary complexity.**

- **Primary accent: pumpkin-orange `#E2611B`** — use the `brand` scale from
  `frontend/tailwind.config.js` (`brand-600` = `#E2611B` is the accent; `brand-700` = `#bc4d14` is
  the dark shade used in the landing gradient). It is the **single accent for the whole app**.
  Neutrals are the Tailwind `slate` scale. Surfaces are white / a `glass-card` utility (defined in
  `src/index.css`); corners are `rounded-2xl`.
  **There is no indigo in this app** — never introduce `indigo-*` classes. (This file claimed indigo
  as the accent until 2026-08-05; that was stale text from an early draft and never matched the code.)
  The config also defines unused `obsidian` and `cyan` palettes — **0 uses in `src/`; treat them as
  dead and don't reach for them.**
- **Fonts** (loaded in `frontend/index.html`, mapped in `tailwind.config.js`): **Merriweather** is
  the typeface for **both** body (`font-sans`) and the `font-brand` wordmark/headings —
  `sans`, `brand`, and `merriweather` all resolve to it. **JetBrains Mono** is `font-mono`.
  Don't add fonts without asking. Note `index.html` still *loads* **Inter** and **Plus Jakarta Sans**
  from Google Fonts, but nothing references them — see `STATUS.md` (an easy, untaken perf win).
- **16px minimum font size site-wide** — `tailwind.config.js` floors `text-xs` and `text-sm` to
  `1rem`. So `text-xs` is **not** small; if you need genuinely smaller text you must set an explicit
  inline `fontSize` (this is why `CitationMarker` does).
- **Wordmark — keep it consistent everywhere.** The "Talktofile" wordmark is the **brand mark**
  (a transparent SVG, no tile) next to the text
  `font-brand italic font-bold text-[26px] sm:text-[34px] tracking-[-0.02em] text-[#E2611B]`. The
  mark assets live in `src/assets/` and are **surface-dependent — pick by background contrast:**
  - **Light surfaces** (e.g. the Navbar, `bg-[#F8FAFC]`) → **`mark-color.svg`** (dark file +
    terracotta bubble), sized `w-14 h-14`.
  - **Orange/dark surfaces** (e.g. the footer, `bg-[#E2611B]`) → **`mark-white.svg`** (all-white
    reversed mark), sized `w-14 h-14 sm:w-16 sm:h-16`, with the text as `text-slate-50`.

  Render as `<img src={mark} className="w-14 h-14" />` — these marks are **transparent (no tile
  background), so no `rounded`/`shadow` wrapper** (unlike the old app-icon tiles). **Gotcha:** the
  mark drawing only occupies the middle ~54% of its 100×100 canvas, so ~23% transparent padding is
  baked onto each side. Spacing classes alone can't close the mark↔wordmark gap — the row uses
  `gap-1` on the flex container **plus a `-ml-3` negative margin on the wordmark `<span>`** to cancel
  that built-in padding; keep both when reusing the lockup. The wordmark text
  **scales down on mobile** (`text-[26px]` below `sm`, `text-[34px]` at `sm`+) — keep this responsive
  sizing when reusing it. **Never put `mark-white` on a light surface** (it disappears) or
  `mark-color` on a dark one. `app-icon.svg` / `app-icon-dark.svg` (terracotta/dark tiles) also live
  in `src/assets/` but are currently unused. (Replaced the old `FileText`-in-a-coloured-chip lockup,
  then the app-icon tiles, with the bare marks — 2026-06-30.)
- **Responsiveness (verified to no horizontal scroll across 320–1280px):** standard patterns are in
  place — `hidden sm:block` / `hidden lg:flex` to progressively reveal chrome, responsive grids,
  `100dvh` (not `100vh`) for full-height panels so the chat input isn't hidden behind mobile browser
  chrome. Conventions worth keeping:
  - Any flex row holding an input or long text needs **`min-w-0`** on the shrinking child, or it
    overflows on narrow screens (this caused the 320px "Add"-button overflow on Landing).
  - The Landing **hero headline uses an explicit responsive `<br>`** (mobile break after "website",
    `lg` break after "links.") so it stays a stable 2 lines and the second line never oscillates
    while resizing — do **not** replace it with auto-wrap or container-query font sizing. The italic
    orange payoff at the end ("Make anything.") is `whitespace-nowrap` and **must stay short** — a
    long phrase there overflows and breaks the 2-line shape (tried and reverted, 2026-08-06).
  - The navbar collapses Feedback/Personalise labels to icons below `md`, and hides the primary
    "How it works" nav below `lg`.
  - The tool sections' action buttons (`proceedButton` passed to `SectionComposer` — "Regenerate
    summary", "Translate to …", etc.) **collapse to an icon-only 44px square below `sm`** so they
    don't squeeze the shared chatbox on phones (`h-11 w-11 sm:w-auto px-0 sm:px-5`, label in
    `hidden sm:inline`, plus an `aria-label`). Keep this pattern for any new tool-view button.
  - After any layout change, **re-check for horizontal scroll at 320/375/768px** in a browser.
- **Tooltips — always use `src/components/Tooltip.tsx`; never re-style per location.** It is the single
  source of the tooltip look: a dark **`#303030`** bubble with **white** text, `rounded-lg`, small
  `text-xs`, a matching `#303030` arrow, fading in on hover **and** keyboard focus. Wrap the target
  element and pass `label` + `side`. **Site-wide convention: tooltips open to the `right`** — this is
  now the component default, so don't pass a `side` elsewhere. **Below `md` (768px) the custom dark
  bubble is hidden (`hidden md:block`) and the component falls back to the browser's native `title`
  tooltip instead** (a `matchMedia('(max-width:767px)')` state sets `title={label}` on the wrapper
  only below `md`, dropped at `md`+ so there's no double tooltip) — matching the lightweight native
  tooltips the header action buttons (End session / Share / See the original document) use. (A
  `side="right"` tooltip also flips to open LEFT below `sm` in the `right` position map — mostly moot
  now, kept as a fallback.) **The one
  exception is the Navbar**,
  whose tooltips use `side="bottom"` (they sit on the top bar, so right would clip). Prefer this
  component over the native `title` attribute for any UI tooltip. If a new variant is ever needed, extend this component rather
  than hand-rolling a one-off, so the shades stay consistent everywhere.
- **In-page smooth scrolling — use `src/lib/smoothScroll.ts` (`smoothScrollTo`), not native
  `scrollIntoView({ behavior: 'smooth' })`.** The native version is fast and uncontrollable; this one
  glides over a configurable `duration` (default 1000ms) with ease-in-out, supports `block`/`offset`
  (pass `offset: 80` to clear the fixed navbar), and honours `prefers-reduced-motion`.
- For UI changes, **run the dev server and verify visually** — type-checking does not catch visual bugs.

---

## Behaviour Notes (status lives in `STATUS.md`)

➡️ **What is / isn't built moved to `STATUS.md`.** What's shipped, in progress, not started, and parked on purpose now
lives there and is rewritten in place — keeping a second copy here is exactly how the indigo/Inter
drift happened (see *Keeping this file true*). **Do not restate feature state in this file.** What
stays below is the durable *behaviour* a status list can't carry.

**Password reset.** In **Supabase mode** it's handled by Supabase. In **legacy mode** it's
native: `POST /api/auth/forgot-password {email}` mints a single-use, 30-min, hashed-at-rest token
(`password_reset_tokens` table) and emails a link `${FRONTEND_URL}/reset-password?token=…`;
`POST /api/auth/reset-password {token, new_password}` consumes it and signs the user in. Both are
rate-limited and the forgot endpoint is enumeration-safe (always the same generic response). Email
goes through `core/email.py` (Resend HTTP API). **In development with no `RESEND_API_KEY`, no mail
is sent — the link is logged to the console and also returned as `dev_reset_link` in the response**
(strictly gated to `ENVIRONMENT=development`, so it can never leak in prod). To enable real emails
set `RESEND_API_KEY` / `EMAIL_FROM` / `FRONTEND_URL` (see `.env.example`). Note: legacy registration
now **requires a unique email** so reset can resolve an account unambiguously.

**Chapter scoping — reuse, don't rebuild.** Scoping is wired for Summary today, but the mechanism is
shared by design: `ChapterPicker`, `parseChapterSelection`, and the `onChapterScope` → left-panel
wiring. Extending it to another tool means accepting `chapter_ids` in that tool's endpoint and scoping
the source text — **don't fork the picker.** Which tools are done is in `STATUS.md`.

**OCR — absent, but image-bearing files still work.** The app extracts whatever text layer exists and
ignores images. A file with **zero** extractable text is **skipped** in a multi-file upload (readable
files still process; skipped names come back in `SessionInfo.skipped` → the amber banner in
`App.tsx`). A **single** image-only file fails with "no readable text — run OCR first", because
there'd be nothing to chat about.

---

## Temporarily Hidden UI (do not delete — these are coming back)

Three pieces of the UI are **switched off on purpose**. They are intentionally kept in the codebase to
be re-enabled later, so **don't "clean them up" as dead code** and don't rebuild them from scratch.
Each is a one- or two-line restore. This table holds the **restore instructions**; `STATUS.md` →
*Parked on purpose* holds the fact that they're off. Park or un-park something and you update **both**
— add/delete the row here, and edit the list there.

| What | Where it lives | How it's off | How to bring it back |
|---|---|---|---|
| **Intro-offer promo splash** ("Pro is *free*. Really.") | `src/components/IntroOfferBanner.tsx` (component untouched); gating + render in `src/App.tsx` | `INTRO_OFFER_ENABLED = false` short-circuits `scheduleIntroOffer`, **and** the `<IntroOfferBanner>` render at the bottom of `App.tsx` is commented out | Flip the flag to `true` **and** un-comment the render. Its import, the `INTRO_OFFER_*` constants and the `signupNonce` → subscribe-modal wiring are all still in place. ⚠️ Its mobile header fix ("closes in" is `hidden sm:inline`) was never verified in a browser — check 320/375px when it returns. |
| **Landing "Plans" section** ("Start free, upgrade anytime." + the Basic vs Pro table) | `src/components/Landing.tsx` — search `DISABLED FOR NOW` | The whole `<section id="plans">` is commented out; its `PLAN_FEATURES` data still sits at the top of the file | Un-comment the block, then re-add the `{`/`}` braces around the two inner `Header row` / `Feature rows` comments — they were un-braced because a nested `*/` would close the outer JSX comment early. Nothing links to `#plans`, so there's no nav anchor to restore. |
| **Microsoft + LinkedIn social sign-in** (Google is unaffected and stays live) | `src/components/AuthModal.tsx` — the `SOCIAL_PROVIDERS` array | Both entries are commented out of the array. Their `MicrosoftIcon` / `LinkedInIcon` components and the `OAuthProvider` union in `AuthContext.tsx` are untouched | Un-comment the two array entries. ⚠️ **Code alone isn't enough** — the `azure` and `linkedin_oidc` providers must also be **configured in the Supabase dashboard**, which is why they were parked; turning them on without that gives a broken button. |

Note the flag-vs-comment split isn't cosmetic: the banner needs the **flag** as well, because its
timer would otherwise still fire and write the `ttf_intro_offer_seen` cooldown key — silently
spending the once-a-day slot on a banner that never rendered.

---

## Contribution Guidelines

When you complete work in a session:

1. **(MANDATORY) Update `STATUS.md`** whenever a feature moves between not-started / in-progress /
   done, or something is reverted. **Rewrite the relevant section in place — never append.** It
   describes the present only, so a stale entry there is a bug.
2. **Add to `CHANGELOG.md` only for a meaningful change** — a feature landing, a decision, a revert —
   and keep it to **one short line**, newest first. **Not** every file edit. **Skip it entirely** for
   small tweaks, refactors, and work-in-progress that might still move; **never log churn reverted in
   the same session**. Unsure? Then it isn't meaningful — update `STATUS.md` and skip the changelog.
   History goes there and **never in this file** — that's what bloated `CLAUDE.md` to 2,600 lines once.
3. **Update this file (`CLAUDE.md`) only for things that are still true tomorrow** — conventions and
   gotchas. It is instructions, not a record and not a status board. "What I did" → `CHANGELOG.md`;
   "what state it's in" → `STATUS.md`; "what's left to build" → `TODO.md`.
4. **Update the Component Registry** whenever a component is created or its purpose changes — one
   line, and only the gotcha someone would get wrong without it. Not a description of the work.
5. **Frontend:** run `./node_modules/.bin/tsc --noEmit` (or `npm run build`) — changes must be
   type-error free. For UI work, verify visually in the browser.
6. **Backend:** confirm `./venv/Scripts/python -c "import main"` still succeeds.
7. **Never commit `backend/.env`** or any real API key — both are git-ignored; keep it that way.
8. **Match the design language** (brand orange `#E2611B` + slate, `rounded-2xl`, Merriweather).
   Don't introduce new colours or fonts without agreement — and never `indigo-*`.
9. **Keep paths machine-agnostic** — this runs on two desktops. No hardcoded user paths.
10. **List the files you changed** at the end of the task.
11. **Never attribute commits to Claude.** Claude (or any AI assistant) must never appear as a
    GitHub contributor. Do **not** add `Co-Authored-By: Claude …` trailers, a "Generated with
    Claude Code" line, or any similar attribution to commit messages or PR descriptions. Commits
    are authored solely by the human contributors.

### Keeping this file true

This file is only worth its tokens if every line is still correct. Three rules, in priority order:

- **Point at the source of truth; don't copy it.** Colours, fonts, ports, limits, model names and
  env vars are *defined* in `tailwind.config.js`, `core/config.py`, `.env.example`, `index.html`.
  Name the file instead of restating the value — a pointer can't rot, a copy silently does.
  **This is the strongest rule here**: it makes a whole class of drift structurally impossible.
- **Verify before you write.** Check any factual claim against the code, not against memory and not
  against what another section of this file says — a wrong line will happily propagate itself. If a
  claim is worth writing, it's worth citing where it lives so the next session can re-check in seconds.
- **Correct in place; never append.** When a rule changes, **edit the original sentence**. Do not
  add "actually, now…" underneath it. Accreted amendments are how one tooltip rule grew four clauses
  that contradict each other and end with "mostly moot now." `CHANGELOG.md` is where the before/after
  belongs — this file states only what is true *right now*.

> **Worked example of the failure this prevents:** for weeks this file opened its Design section with
> *"Primary accent: indigo (`indigo-600`)"* and named **Inter** and **Plus Jakarta Sans** as the
> fonts. The code said `#E2611B` and Merriweather — `grep -r indigo frontend/src` returns **zero**
> hits, and always did. Both claims were copies of config values that nobody re-checked when the
> config changed. Any session that had followed them would have built wrong-coloured, wrong-typeface
> UI while doing exactly as it was told. (Corrected 2026-08-05.)
