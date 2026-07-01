# Talktofile — Project Handover for Claude

> You are picking up an active project. Read this file fully before making any changes.
> When you make a meaningful contribution, update this file so the next session (and the
> other developer) can pick up without re-asking.

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
- After completing a task, list only the files you modified.
- **Before building anything complex, state your interpretation of the task and confirm before
  proceeding** — especially when the request is ambiguous or could go several ways. A brief
  "Here's what I'm planning — does that sound right?" prevents wasted effort.

---

## What Is Talktofile?

Talktofile is a private, agentic **"chat with your document"** web app. A user uploads one or
more files (PDF, Word, Excel, PowerPoint, HTML, JSON, CSV, Markdown, plain text, and many
source-code formats), the backend extracts and indexes the text, and the user asks questions in
natural language. An AI assistant named **"Sage"** answers **only from the document content**
(no hallucinations) and streams replies in real time over a WebSocket. Documents in any language
are answered in clear English.

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
├── DEPLOY.md                  ← deployment notes
├── SUPABASE_SETUP.md          ← optional Supabase auth setup
└── PITCH.md                   ← product pitch
```

---

## Related Documents (in the repo root)

Don't duplicate these — read the source file when you need the detail. Quick map of what each covers:

| File | What's in it |
|---|---|
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
| `orchestrator.py` | State machine: Extract → Lingua → Analyst → Ready. Also holds all per-format text extraction (PDF via pdfplumber+PyMuPDF, docx/xlsx/pptx, html, json, plain text) with zip-bomb and scanned-PDF guards. |
| `lingua_agent.py` | Detects document language (skipped for code/markup/data files). |
| `analyst_agent.py` | Chunks text, embeds, builds the FAISS index, writes the summary, and generates suggested questions. |
| `sage_agent.py` | The answering assistant — retrieves relevant chunks and answers from document content only. |
| `guard_agent.py` | Rejects out-of-scope / unsafe questions (`guard_reject`). |
| `persona_agent.py` | Optional Pro personalization of Sage for a user's domain. |

**Config & limits** (`core/config.py`): plan tiers, per-day usage caps (cost control against the
OpenAI bill), CORS origins, Supabase toggle. Sessions live in memory (`core/session_store.py`) —
documents are **not** written to disk.

**Auth** (`core/auth.py`, `core/supabase_auth.py`): legacy custom JWT by default. If
`SUPABASE_JWT_SECRET` is set, the backend verifies Supabase-issued JWTs instead. See
`SUPABASE_SETUP.md`.

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

Keep this updated as components are created or significantly changed.

| File | Purpose | Notes |
|---|---|---|
| `src/App.tsx` | App shell, view + session state, modals | Holds the `beforeunload` refresh guard (active only while a chat session exists). Chat/sidebar heights use `100dvh` for mobile correctness. |
| `src/components/Landing.tsx` | Marketing landing page (the "front door") **+ the upload/intent flow** | Hero, "how it works", features, privacy band, CTA, footer. **The hero now owns the upload:** dropping a file / adding a URL starts processing in-place (via `useDocumentProcessor`) while the user stays on the page; a chat box then "appears" where they pick a mode (chat/summary/flashcards/…) and type their first request. The orange circular **Proceed** button (`ArrowUp`) enables once the doc is ready (chat mode also needs typed text; other modes don't). On proceed it calls `onEnter(session, mode, prompt)`. Responsive via Tailwind breakpoints. |
| `src/components/Navbar.tsx` | Top nav inside the app | Feedback, Personalise (Pro), sign up / sign in or user menu, and the **light/dark `ThemeToggle`**. Labels collapse to icons on small screens. The account button shows the user's **saved profile photo** (`user.profile.avatar`) next to the name, falling back to a `User` icon. Uses **`mark-white.svg`** in dark mode, **`mark-color.svg`** in light. |
| `src/context/ThemeContext.tsx` | Light/dark theme state (`useTheme`) | Holds `theme` + `toggleTheme`, persists to `localStorage` (`theme`), defaults to OS `prefers-color-scheme` (and follows it until the user chooses explicitly), toggles the `dark` class on `<html>`. Provided in `main.tsx` above `AuthProvider`. Pre-seeded by an inline script in `index.html` (no FOUC). Tailwind is `darkMode: 'class'`. |
| `src/components/ThemeToggle.tsx` | The navbar light/dark switch | Sun icon in dark mode (→ light), moon in light mode (→ dark). Uses the shared `Tooltip`. |
| `src/components/UploadZone.tsx` | Drag-and-drop upload + processing UI (in-app fallback, e.g. password-recovery entry) | Enforces plan file-count/size limits client-side; runs the pipeline via `useDocumentProcessor`. No longer the primary upload path — the Landing hero is (see above). |
| `src/hooks/useDocumentProcessor.ts` | Shared upload→process pipeline hook | Uploads file bytes / a URL, drives the processing WebSocket (`extracting`→`analysing`→`ready`), exposes `{ stage, stageMsg, progress, error, session, processing, processFiles, processUrl, reset }`, and fires the `document_uploaded` analytics event. Used by both `Landing` and `UploadZone`. Does **not** navigate — the caller reacts to `session`. |
| `src/components/ChatWindow.tsx` | The chat experience | Chat WS lifecycle with auto-reconnect, streaming tokens, stop button, suggested questions, summary panel, scroll-to-bottom. Accepts an optional `initialPrompt` — the first message typed on the landing chat box, auto-sent once connected (guarded against resend on reconnect). |
| `src/components/MessageBubble.tsx` | Renders one message (markdown) | Used for user + assistant + guard-reject + feedback prompts. **Inline citations:** for a finished Sage answer with sources, it runs `buildCitations` over the answer + passages, renders the marked markdown with `react-markdown` `components` overrides (`p`/`li`/`h*`/`td`/`blockquote`) that swap the injected `⟦C{n}⟧` tokens for `<CitationMarker>` (recursing through nested inline nodes). The old collapsible "View sources" list is replaced by a subtle **"Cited from your document · N passages · hover ¹²³ to view"** footer (clicking it opens the full excerpt in `CitationPanel` via `onCiteSource`). Also shows a brief **"Finding sources…"** hint (`awaitingSources`) between the answer finishing and its passages arriving. |
| `src/components/CitationMarker.tsx` | One inline citation marker (¹²³) + hover popover | Renders a small **bold brand-orange rounded chip** (`bg-brand-50`, `align-super`, inline `fontSize` to beat the 16px CSS floor) so it reads as a tappable citation. On hover/focus a card pops **above** the marker showing the passage with the matched phrase highlighted (`<mark>`), the `¶` location + `% match`. The card has an **invisible bridge** (`pb-2` transparent padding on the popover wrapper) so the cursor can cross up into it without dismissing (plus a 120ms close delay). **Jump to source** calls `onJump(source)` → opens the full `CitationPanel` excerpt. |
| `src/lib/citations.ts` | Citation grounding heuristics | `buildCitations(answer, sources)` splits the answer into sentence spans, matches each passage to its best-fit sentence by significant-word overlap (greedy, prefers distinct sentences), injects `⟦C{n}⟧` tokens numbered top→bottom, and returns the matched phrase + `¶` location per citation. Pure text heuristics — never changes answer wording, only marker placement. |
| `src/components/SummaryCard.tsx` | Document summary display | `compact` variant used in the side panel and summary drawer. |
| `src/components/FlashcardsView.tsx` | Flashcards study tool | Has a **Share** action (active-card controls + finished screen) that copies/Web-Shares the full Q&A set with a "Made with Talktofile" attribution. |
| `src/components/SummaryView.tsx` | Full-page document summary | Header **Share** button → copies/Web-Shares the summary with attribution. |
| `src/components/PodcastView.tsx` | Podcast script tool | **Share** + **Download** both emit the script with the attribution footer. |
| `src/components/TranslateView.tsx` | Translate tool | Per-document **Share** + **Download .txt**, both with the attribution footer. |
| `src/lib/share.ts` | Share/export helpers | `withAttribution()` appends a "Made with Talktofile — <runtime origin>" footer; `downloadText()` (local .txt) and `shareOrCopy()` (Web Share API → clipboard fallback). Used by the four tool views above. Link target is `window.location.origin` — no hardcoded domain. |
| `src/components/AuthModal.tsx` | Login / signup / password reset | |
| `src/components/PersonaModal.tsx` | Pro persona configuration | |
| `src/components/FeedbackModal.tsx` | User feedback form | |
| `src/components/ConfirmDialog.tsx` | Reusable confirm dialog | Used for "leave this chat?" (in-app navigation away). |
| `src/components/TypingIndicator.tsx` | "Sage is typing" animation | |
| `src/components/Tooltip.tsx` | Reusable hover/focus tooltip | **Single source of the tooltip look** (dark `#303030` bubble, white text, arrow). Wrap a target, pass `label` + `side`. Use everywhere instead of native `title`. See Design / Brand. |
| `src/components/AvatarUpload.tsx` | Avatar picker laid out as a premium "settings row" | Reads the picked image, **downscales it client-side to a 256×256 JPEG data URL** (center-cropped, white-flattened) so the stored value is tiny, and returns it via `onChange`. **Now persisted** end-to-end (see the avatar `UserProfile.avatar` field). Falls back to initials (from `name`) then a `User` icon. **Layout:** circular avatar (default 72px) on the left with a **hover/focus-only** dark overlay + camera icon (no persistent floating badge), beside a labelled **Upload/Change photo** button, a **Remove** text button (only when set), and a `JPG, PNG or GIF. Max 5 MB.` caption. Used by `AuthModal` (signup) and `ProfileModal`; the saved avatar shows in the `Navbar` account button. |
| `src/lib/smoothScroll.ts` | `smoothScrollTo` slow in-page scroll helper | Configurable-duration ease-in-out scroll with `block`/`offset` + reduced-motion support. Use instead of native smooth `scrollIntoView`. |
| `src/components/MicButton.tsx` | Voice-dictation mic button for chat inputs | Standard slate `Mic` (lucide) with the shared `Tooltip` ("Click to dictate your instructions"); turns **brand orange** (`bg-brand-600/10 text-brand-600` + a soft pulse ring) while recording, then a `Loader2` spinner ("Transcribing…") while Whisper runs. On failure it tints **red** and shows a **red error bubble above the mic** (auto-dismiss 6s / click to dismiss). Pushes transcribed text to `onTranscript`; the caller appends it (never owns the text). **Renders nothing where voice is unsupported.** **Engine-agnostic:** imports the hook as `useVoiceDictation`, currently wired to the Whisper hook (see import comment to swap engines). Used in `ChatWindow` and the `Landing` chat box. |
| `src/hooks/useVoiceDictation.ts` | **ACTIVE** voice engine — record → Whisper | Records mic audio with `MediaRecorder` (`getUserMedia`), then on stop uploads the clip to `POST /api/tools/transcribe` (OpenAI Whisper) and returns text via `onResult`. **Works in every browser incl. Brave** (the reason it's the chosen engine), but **costs money per use** (Whisper). `hardReset()` per attempt so the button can't stick; surfaces failures via `error`. Needs a secure context (localhost/https) + a mic. Returns `{ supported, listening, transcribing, error, toggle, clearError }`. |
| `src/hooks/useWebSpeech.ts` | **DORMANT** fallback engine — Web Speech API | Not imported. Browser-native, **free/no-backend/no-cost**, but **dead in Brave/Firefox** (they block it) — which is why it's not the active engine. Accumulates the full transcript across continuous-mode auto-restarts (`launch()` preserves text, `start()` clears it), delivers on stop, surfaces a clear "not available — use Chrome/Edge" error. Same return shape as `useVoiceDictation`; swap MicButton's import to re-enable. |

---

## Design / Brand

Clean, minimal, premium. **Simplicity is the priority — do not add unnecessary complexity.**

- **Primary accent:** indigo (`indigo-600`, with `indigo-500/700` gradients). Neutrals are the
  Tailwind `slate` scale. Surfaces are white / a `glass-card` utility; corners are `rounded-2xl`.
- **Fonts** (loaded in `frontend/index.html`): **Inter** (body), **Plus Jakarta Sans** (the
  `font-brand` wordmark/headings), **JetBrains Mono** (mono accents). Don't add fonts without asking.
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
  - The Landing **hero headline uses an explicit responsive `<br>`** (mobile break after "Website",
    `lg` break after "links.") so it stays a stable 2 lines and the second line never oscillates
    while resizing — do **not** replace it with auto-wrap or container-query font sizing.
  - The navbar collapses Feedback/Personalise labels to icons below `md`, and hides the primary
    "How it works" nav below `lg`.
  - After any layout change, **re-check for horizontal scroll at 320/375/768px** in a browser.
- **Tooltips — always use `src/components/Tooltip.tsx`; never re-style per location.** It is the single
  source of the tooltip look: a dark **`#303030`** bubble with **white** text, `rounded-lg`, small
  `text-xs`, a matching `#303030` arrow, fading in on hover **and** keyboard focus. Wrap the target
  element and pass `label` + `side`. **Site-wide convention: tooltips open to the `right`** — this is
  now the component default, so don't pass a `side` elsewhere. **The one exception is the Navbar**,
  whose tooltips use `side="bottom"` (they sit on the top bar, so right would clip). Prefer this
  component over the native `title` attribute for any UI tooltip. If a new variant is ever needed, extend this component rather
  than hand-rolling a one-off, so the shades stay consistent everywhere.
- **In-page smooth scrolling — use `src/lib/smoothScroll.ts` (`smoothScrollTo`), not native
  `scrollIntoView({ behavior: 'smooth' })`.** The native version is fast and uncontrollable; this one
  glides over a configurable `duration` (default 1000ms) with ease-in-out, supports `block`/`offset`
  (pass `offset: 80` to clear the fixed navbar), and honours `prefers-reduced-motion`.
- For UI changes, **run the dev server and verify visually** — type-checking does not catch visual bugs.

---

## What Is / Isn't Built Yet

Built and working: guest + registered auth (legacy JWT or Supabase), **password reset / "forgot
password"** (both modes — see below), single/multi/compare upload modes, the full
extract→index→summarize pipeline, streaming Q&A with reconnect, suggested questions, per-document
summaries, plan limits + daily usage caps, feedback capture, persona (Pro), rate limiting, and
Dockerized production serving (Caddy).

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

Not built / known gaps:
- **Real billing** — Pro is granted only via the `PRO_EMAILS` env var; there is no payment flow.
- **Persistence of chats/documents** — by design, sessions are in-memory and lost on refresh
  (an in-app confirm dialog and a browser `beforeunload` guard mitigate accidental loss, but there
  is no save/restore).
- **OCR** — scanned / image-only PDFs are rejected with a clear message; no OCR fallback.

---

## Progress Log

> **MANDATORY — do this every session.** At the end of each session, add a short dated entry below
> (newest first) recording **what you finished** and **what's still pending**. This is required even
> for small sessions. Keep entries terse (a few bullets), not a blow-by-blow transcript. The
> detailed "how" belongs in the relevant section above; this log is just the running status so the
> next session/developer can see at a glance where things stand.

### 2026-07-01 (latest) — Chat header pinned; fixed workspace page-scroll bug
**Done:**
- The chat header row (filename + connection status + BookOpen/Download/Restart/**End session**
  buttons) now **stays fixed under the navbar** while the conversation scrolls.
- **Root cause was a layout bug, not just missing `sticky`:** the chat card
  (`App.tsx`, workspace view) carried `flex-1` **and** an inline `height: calc(100dvh - 5.5rem)`.
  `flex-1` (flex-basis `0%`) won, and no ancestor supplied a definite height (`main` is
  `min-h-screen`), so on a long conversation the card grew to its content and the **whole page
  scrolled** — carrying the header away and pushing the chat input off-screen.
- **Fix (two files):**
  - `App.tsx` — the workspace `motion.div` is now a definite height
    `h-[calc(100dvh-4rem)]` (viewport minus the `h-16` navbar) + `overflow-hidden`; removed the
    conflicting inline `height` on the chat card so `flex-1` fills that bounded parent. Now only the
    message list scrolls; the input bar stays visible at the bottom. (Landing view is a separate
    early-return layout and is untouched.)
  - `ChatWindow.tsx` — moved the header (and the summary panel) **inside** the scrollable region as
    its first child and made the header `sticky top-0 z-20` (opaque bg already present). The scroll
    ref/`onScroll` + scroll-to-bottom logic moved onto the new scroll wrapper; behaviour preserved.
- Type-check (`tsc --noEmit`) passes. Verified working live by the user (desktop Brave).

**Pending / next:**
- `main` still uses `min-h-screen` (vh, not dvh); on mobile a `100vh`≠`100dvh` gap could reintroduce
  a small page scroll. Not observed on desktop — re-check the workspace at 320–768px if it bites.

### 2026-07-01 — Dark mode: full-app theme + light/dark navbar toggle
**Done:**
- Added a site-wide **dark mode** with a **light/dark switch in the navbar** (sun/moon).
- **Theme system (new):** `tailwind.config.js` now sets `darkMode: 'class'`. New
  `src/context/ThemeContext.tsx` (`useTheme`) holds the theme, persists it to `localStorage`
  (`theme`), defaults to the OS `prefers-color-scheme`, follows OS changes until the user makes an
  explicit choice, and toggles the `dark` class on `<html>`. `main.tsx` wraps the app in
  `ThemeProvider` (outside `AuthProvider`). An **inline script in `index.html`** sets the class
  before React mounts, so there's no light flash on a dark load. New `src/components/ThemeToggle.tsx`
  is the button (uses the shared `Tooltip`, `side="bottom"` in the navbar).
- **`index.css`:** dark base body (`#0b1120` bg / slate-200 text via `html.dark body`) + dark
  scrollbars, and `dark:` variants added to the shared utilities: `.glass-card`, `.input-field`, and
  every `.prose-custom` rule. Because `glass-card`/`input-field`/`prose-custom` are dark-aware,
  components using them adapt for free.
- **Every component dark-styled with Tailwind `dark:` variants** (surfaces → `slate-900/950/800`,
  borders → `slate-800/700`, body text → `slate-300/400`, headings → `slate-100`; the brand orange
  `#E2611B` is kept in both themes). Covered: `App` shell, `Navbar` (also swaps to **`mark-white.svg`**
  in dark — the color mark would vanish on the dark bar), `Landing` (hero, upload/chat box,
  features/how-it-works/audiences/plans, footer stays orange), `ChatWindow`, `MessageBubble`,
  `TypingIndicator` (via `glass-card`), `MicButton`, `CitationMarker`, `CitationPanel`, all tool
  views (`SummaryCard`, `SummaryView`, `FlashcardsView`, `SlidesView`, `PodcastView`, `TranslateView`,
  `ChartsView`), and all modals/misc (`AuthModal`, `ProfileModal`, `PersonaModal`, `FeedbackModal`,
  `ConfirmDialog`, `AvatarUpload`, `UploadZone`).
- **Deliberate exception:** the **Recharts chart panel in `ChartsView` stays on a light surface** in
  dark mode (its axis/legend/grid colours are light-theme defaults and would be illegible on a dark
  card). Noted inline.
- **Convention for the next session:** when adding UI, pair light classes with a `dark:` variant
  (e.g. `bg-white dark:bg-slate-900`, `text-slate-900 dark:text-slate-100`); prefer the dark-aware
  `glass-card`/`input-field` utilities so you get dark styling for free.
- Type-check (`tsc --noEmit`) **and** `npm run build` both pass.

**Pending / next:**
- **Visual verification not done this session** (needs the app running in a browser). Toggle dark
  mode and sweep every screen — landing, upload, chat + citations popover, each tool view, and all
  modals — checking contrast and that nothing is white-on-white / dark-on-dark. Re-check 320–1280px.
- A few small tinted status boxes (red/amber/green error/success notices) were left with their
  light-tint backgrounds where they already read fine; revisit if any look too bright in dark mode.

### 2026-07-01 — Chat UI polish toward the mockup (additive; preserves the in-progress dark-mode pass)
**Done:**
- Tasteful restyle of the chat toward the requested mockup, **kept to chat-only files** (`MessageBubble`,
  `ChatWindow`) so it wouldn't collide with the parallel dark-mode edits on `App`/`Landing`/`UploadZone`.
  **All existing `dark:` variants preserved**; new styles got matching `dark:` variants.
  - **Rounded-square avatars** (`w-8 h-8 rounded-lg`, was `w-7 h-7 rounded-full`) — the mockup's tile look,
    for both the Sage and feedback avatars.
  - More vertical rhythm in the message list (`py-4 space-y-4` → `py-5 space-y-5`); softer bubble tails
    (`rounded-b*-sm` → `rounded-b*-md`); a touch more padding on the answer card; subtle `shadow-slate-200/50`.
  - Citation footer now sits under a **faint hairline** (`border-t`) as a quiet "cited from" caption.
- Type-check + `npm run build` pass. Changes HMR into the running dev server.

**Pending / next:**
- Visual check at 320–1280px + in dark mode (dark-mode pass is being done in parallel by the other dev).

### 2026-07-01 (later) — Citations: fixed "stuck streaming" bug, marker restyle, Jump-to-source opens passage panel
**Done:**
- **Root-caused why citations never appeared live:** finished answers were stuck with
  `isStreaming=true`, which (by design) hides the Copy button *and* the citation markers. The
  cause was `finalizeStreaming` clearing the flag inside a `setMessages` updater that matched
  `streamingIdRef.current` — but the ref is nulled on the same tick, so the async updater matched
  nothing. Fixed by **clearing the flag on whatever message is currently streaming** (there's only
  ever one) instead of id-matching, and **belt-and-suspenders**: the `sources` handler now also sets
  `isStreaming:false` on the message it attaches passages to (sources only arrive post-answer, so
  it's always safe). Confirmed live via a temporary on-screen DEBUG line (since removed):
  `streaming=false · showActions=true · sources=2 · citations=2`.
- **Also this session:** removed the auto-opening `CitationPanel` (it covered the summary on every
  answer); added a **"Finding sources…"** hint for the ~1–3s gap between the answer finishing and the
  post-answer passage retrieval arriving (see `pendingSourcesId` in `ChatWindow`); warmed the chat
  input placeholder copy.
- **Marker restyle:** the ¹²³ superscripts were nearly invisible → now a small **bold brand-orange
  rounded chip** (`bg-brand-50`, `align-super`, inline `fontSize` to beat the 16px CSS floor) so
  they read as tappable citations.
- **"Jump to source" now opens the full passage** (`CitationPanel` via `onCiteSource`) instead of
  flashing a summary row — per the user's choice (the summary is a paraphrase; the panel shows the
  real excerpt with context before/after). **Removed the now-dead amber-flash machinery**:
  `SummaryCard` reverted to no `flash` prop, `App` lost its `flash` state + `handleJumpToSource`, and
  `citations.ts` lost `bestKeyPointMatch`/`KeyPointFlash`.
- Type-check + `npm run build` pass.

**Pending / next:**
- Verify the restyled markers + "Jump to source → panel" visually at 320–1280px (works on the dev box).
- Popover-clipping caveat still stands (chat is inside an `overflow-hidden` card).
- Optional broader "prettier like the mockup" restyle (bubbles/header/spacing) is still not done —
  this session was citations only.

### 2026-07-01 — Inline citations: hover-popover ¹²³ markers + "Jump to source" amber flash (frontend only)
**Done:**
- Reworked how sourced answers show their citations, to match a requested design (kept the brand
  orange palette). Replaced the collapsible **"View sources"** list under each Sage answer with
  **inline superscript markers (¹²³)** on the grounded sentences, plus a subtle footer
  **"Cited from your document · N passages · hover ¹²³ to view"** (clicking it still opens the full
  excerpt in the existing `CitationPanel`).
- **Grounding is a frontend heuristic** — the backend returns passages *per answer* (top chunks per
  doc), not per-sentence. New **`src/lib/citations.ts`** `buildCitations(answer, sources)` splits the
  answer into sentence spans, matches each passage to its best-fit sentence by significant-word
  overlap (greedy, prefers distinct sentences), injects `⟦C{n}⟧` tokens numbered top→bottom, and
  computes the longest shared phrase (to highlight) + a `¶` location from `chunk_index`. Verified the
  matcher end-to-end with a standalone esbuild+node run on a sample answer (markers landed on the
  right 3 sentences, correct locations/scores/phrases).
- **`src/components/CitationMarker.tsx`** (new): the superscript marker + hover/focus popover **above**
  it showing the passage with the matched phrase highlighted, `¶ location`, and `% match`. Has an
  **invisible bridge** (`pb-2` transparent padding on the popover wrapper + 120ms close delay) so the
  cursor can move up into the card without dismissing it. **Jump to source** closes the card and calls
  `onJumpToSource`.
- **`MessageBubble`** renders the marked markdown via `react-markdown` `components` overrides
  (`p`/`li`/`h*`/`td`/`blockquote`) that replace the tokens with `<CitationMarker>`, recursing through
  nested inline nodes. Threads `onJumpToSource` from `ChatWindow` ← `App`.
- **"Jump to source" flash:** `App.handleJumpToSource` finds the passage's document, picks the
  best-matching **Summary/Key-point** row via `bestKeyPointMatch`, and bumps a `flash` nonce.
  **`SummaryCard`** gained a `flash` prop that pulses that row **amber** (`bg-amber-100 ring-amber-300`)
  for ~1.5s and scrolls it into view. (Left panel is `lg+` only, so the flash is a no-op on mobile.)
- Small polish: warmed the chat canvas from `bg-slate-50/80` → `bg-brand-50/25`.
- Type-check (`tsc --noEmit`) **and** `npm run build` both pass.

**Pending / next:**
- **Visual verification not done** — needs the backend (OpenAI key) to produce a sourced answer. In a
  browser, confirm: markers appear on grounded sentences; hovering shows the card above with the
  highlight/¶/%, and moving up into it doesn't dismiss it; **Jump to source** flashes the right
  left-panel row amber. Re-check 320–1280px.
- **Popover clipping:** the chat lives inside an `overflow-hidden` `.glass-card`, so a card above a
  marker in the very first line could clip at the card's top edge. Acceptable for now; if it bites,
  render the popover through a portal or flip it below when there's no room above.
- The sentence→passage and passage→key-point matches are best-effort (word overlap); occasional
  mismatches are expected. Tune `overlap()`/stopwords in `citations.ts`, or add real per-sentence
  grounding in `sage_agent` if precision matters.

### 2026-07-01 — Fix: YouTube URL uploads were failing (broken transcript dep)
**Done:**
- **Root cause of "can't upload YouTube videos":** the backend was up (health 200) — only the
  YouTube path was broken. `youtube-transcript-api` was **(a) not installed in this machine's
  `venv`** (declared in `requirements.txt` but the venv was out of sync), so every YouTube URL hit
  the generic `except Exception` in `_fetch_youtube_transcript` and returned a 422; and **(b) the
  pinned `0.6.3` is broken against current YouTube** anyway — a direct fetch returned an empty body
  (`ParseError: no element found`). Plain web-page URLs were unaffected.
- **Fix:** upgraded to **`youtube-transcript-api==1.2.4`** (installed into the venv + bumped the
  `requirements.txt` pin). The 1.x API is **instance-based** — the old static
  `YouTubeTranscriptApi.get_transcript(id)` was removed — so `routers/document.py`
  `_fetch_youtube_transcript` now uses `YouTubeTranscriptApi().fetch(video_id).to_raw_data()`. The
  `NoTranscriptFound` / `TranscriptsDisabled` exception imports are unchanged and still valid in 1.x.
- **Verified end-to-end:** `import main` OK; calling the real `_fetch_youtube_transcript` on a live
  video returned a 2089-char transcript.

**Pending / next:**
- **⚠️ Restart the backend** so the running process loads the fix (new venv package + code change).
  If it was started with `--reload` it likely already reloaded on the edit; if not, restart it. The
  other developer must also `pip install -r requirements.txt` in their venv to get 1.2.4.
- Videos **without captions** still (correctly) return the friendly 422 ("no available transcript").
  YouTube can also rate-limit / IP-block server-side fetches in production — watch for that on the VM.

### 2026-07-01 — Hero trust row + copy tweaks (frontend only)
**Done:**
- **Hero headline:** "Paste **W**ebsite links." → "Paste **w**ebsite links." (visible text +
  the matching code comment in `Landing.tsx`).
- **Subline hidden:** the "Upload anything in any language..." `<p>` is **commented out** (kept
  in place with a note to re-enable if the hero needs it later).
- **New trust row** between the headline and the (hidden) subline. Went through several
  iterations with the user and landed on: **three inline items** — 🔒 Nothing stored / ⚡ No
  sign-up needed / ✓ Answers only from your file — as **orange lucide icons** (`Lock` / `Zap` /
  `CheckCircle`, `w-6 h-6`, `#E2611B`) + labels, **separated by whitespace only (no dividers)**.
  Labels use the **headline's font treatment at a smaller size**: `font-merriweather
  tracking-[-0.03em] text-[#303030] text-2xl`, **normal weight** (tried extrabold, user preferred
  not-bold but kept the near-black colour). `flex-wrap` so it wraps on narrow screens.
- **Discarded alternatives (kept commented in `Landing.tsx`):** an earlier **icon-medallion**
  version (circular `bg-[#E2611B]/10` disc, icon-over-label) and a **hairline-divider** row are
  both preserved as JSX comments in case we want to switch back. A 4th "15+ languages" point
  (`Globe`) was added then **removed** at the user's request (Globe import still used by the
  features section).
- Type-check passes (`tsc --noEmit`) after each step.

**Pending / next:**
- **Visual verification not done this session** — run the dev server and confirm the trust row at
  320/375/768px: three items at 24px normal weight need room, so check the wrap looks intentional
  (tune `gap-x`/size if it feels tight). Decide later whether to bring the subline back.

### 2026-06-30 — Profile photo: now persisted + shown in the navbar
**Done:**
- Made the avatar **real** (it was frontend-only state, discarded on close) and surfaced it in the
  **navbar account button** next to the username, per request.
- **Persistence end-to-end:** new `avatar` column on `users` (Alembic migration
  `9e2a7c4b1d83_add_user_avatar.py`, Text, `server_default=''`; applied — `alembic current` at that
  head). `models/db_models.py` adds the field + includes it in `to_auth_dict().profile`.
  `models/schemas.py` `UserProfile.avatar` with its own validator (must be a `data:image/` URL,
  capped ~700k chars; **not** in the 200-char `trim` group). `core/auth.py` `update_profile` +
  `create_user` persist it. `UserInfo.profile` is a passthrough `dict`, so `/auth/me`,
  `/auth/profile`, register/login all round-trip the avatar with no further schema change.
- **Frontend:** `types` `UserProfile.avatar`. `ProfileModal` now seeds the avatar from the saved
  profile **and sends it on save** (was omitted before — the root of the "photo didn't stick").
  `AuthModal` signup includes it in the register payload. `Navbar` shows
  `user.profile.avatar` as a 28px round image (ring), falling back to the `User` icon.
- **Image kept tiny:** `AvatarUpload` now **downscales the picked file to a 256×256 JPEG data URL**
  (canvas, center-cropped, white-flattened, q0.85) before `onChange`, so the value stored in the DB
  and sent in every `me`/profile payload is ~tens of KB, not the raw multi-MB file. Falls back to
  the raw data URL if canvas processing fails.
- **Verified end-to-end live:** registered a throwaway user with an avatar → `/auth/me` returned
  `profile.avatar` (then deleted the test user). Frontend type-check + backend `import main` pass.

**Pending / next:**
- **Visual check not done:** upload a photo in Profile/signup, Save, confirm it shows in the navbar
  button (and persists across reload/sign-in). Check the round image crop + ring at 320–1280px.
- Avatars are stored inline as data URLs (simple, no object storage). Fine at this scale; if the
  user base grows, move to a blob/CDN and store a URL instead.

### 2026-06-30 — Don't silently sign users out on an expired session (graceful 401 + token refresh)
**Done:**
- **Root cause of the "saving my profile signed me out" report:** the avatar is *not* sent to
  the server (frontend-only, known gap), so the photo was incidental. The real trigger was the
  `PUT /auth/profile` request returning **401** because the legacy JWT had expired (it lasted only
  **60 min**), and the axios response interceptor reacted to *any* 401 by wiping the token and
  **hard-reloading the page**, which re-bootstrapped an anonymous guest — i.e. looked like a
  silent sign-out, and discarded the unsaved edits.
- **Graceful 401 handling (both auth modes).** `api/client.ts` no longer hard-reloads on a 401:
  it calls a registered `setUnauthorizedHandler` (falls back to the old reload only if none is
  set). `AuthContext` registers one in each provider:
  - **Legacy:** transparently issues a fresh **guest** token (app stays usable) and, **only if the
    user had actually been signed in**, flips a new `sessionExpired` flag. A plain guest whose 3h
    record expired is re-guested silently (no nag).
  - **Supabase:** safety net (supabase-js auto-refreshes normally) — re-syncs to an anonymous
    session and sets `sessionExpired` if the user was signed in.
  - `App.tsx` watches `sessionExpired` and opens the **AuthModal in login mode with an amber
    notice** ("Your session expired. Please sign in again to continue."), via a new `notice` prop
    on `AuthModal`. `closeAuth` clears the flag + notice together. **No page reload**, so the
    user's on-screen context (e.g. a chat) survives. `ProfileModal` now auto-closes if the session
    drops to a guest, so it can't stack under the sign-in prompt.
- **Token longevity / refresh (legacy).** `config.py` `access_token_expire_minutes` 60 → **7 days**,
  so routine intermittent use never expires mid-session. New backend **`POST /auth/refresh`**
  (`routers/auth.py`, requires a valid token, mints a fresh one). Legacy `AuthContext` proactively
  refreshes **every 6h while signed in** (`authApi.refresh`), so an active tab slides its expiry
  forward and effectively never expires. (Supabase mode already auto-refreshes.) The interceptor
  excludes `/auth/refresh` from the 401 handler. Updated the now-stale guest-TTL comment in
  `core/auth.py` (the 3h record eviction, not the JWT expiry, is the effective guest lifetime).
- Frontend type-check + backend `import main` both pass.

**Pending / next:**
- **⚠️ Restart the backend** so the new `/auth/refresh` route registers (the `--reload` gotcha;
  a stale uvicorn returns 404). Quick check:
  `curl -s -X POST http://localhost:9099/api/auth/refresh -o /dev/null -w "%{http_code}"` →
  401/403 = live, 404 = restart.
- **Live verify:** sign in, let the token expire (or temporarily lower `access_token_expire_minutes`),
  hit Save in the profile modal → expect the amber "session expired, sign in again" prompt (not a
  reload-to-guest), with the page/chat intact. Confirm the 6h refresh keeps a long-open tab signed in.

### 2026-06-30 — Reject duplicate uploads (same filename / URL) in a session
**Done:**
- Stopped the same file/URL being uploaded more than once in a session. Matching is by
  **name only** (case-insensitive, trimmed) — file contents are never inspected. The first
  copy is kept, later copies are rejected with a warning. Works for a **multiple-selection**
  (the same file twice in one pick) and for sources added **one after another**.
- **`components/Landing.tsx`** (primary path):
  - New module-level `duplicateRejectionMessage(names)` builds the notice ("'X' was rejected
    since a copy already exists.").
  - `onDrop` (initial drop/browse) now de-dupes the dropped batch by filename before the
    plan/size checks; the warning surfaces via `multiHint` once the chat box appears (combined
    with the existing free-plan "only first file" notice if both apply).
  - New `existingSourceKeys()` returns the case-folded set of every source already in the
    session (initial files, the URL `sourceLabel`, and any added `extraSources`).
  - `handleExtraFilesSelected` (Add more files) and `saveExtraUrl` (Add more URLs) reject any
    pick already present (and de-dupe within a single multi-file pick), warning via `multiHint`.
- **`components/UploadZone.tsx`** (in-app fallback): `onDrop` de-dupes the batch by filename;
  new `dupWarning` state renders an amber notice. Only reachable on Pro (multi-select).
- Type-check passes (`tsc --noEmit`).

**Pending / next:**
- **Visual verification not done** — run the dev server and confirm: dropping/selecting the same
  file twice keeps one + shows the warning; re-adding an existing file/URL via the "Add more"
  controls is rejected with the warning; the warning auto-dismisses (5s, via `multiHint`).
- Matching is name-only by design (no content hashing), so two genuinely different files sharing
  a name are treated as duplicates — acceptable per the request.

### 2026-06-30 — Avatar upload section restyled for a premium look (frontend only)
**Done:**
- Reworked `components/AvatarUpload.tsx` from a circle with two floating badges (a
  persistent camera button + an X) into a standard, premium **settings row**: avatar on
  the left, action button + helper caption on the right.
- The persistent camera badge is gone — the camera icon now lives in a **dark overlay that
  only fades in on hover/focus**, so the resting state is clean. Clicking the avatar (or the
  button) opens the picker; focus shows a brand-orange focus ring.
- Right side: an **Upload photo** / **Change photo** pill (brand orange), a **Remove** text
  button (only when an image is set), and a `JPG, PNG or GIF. Max 5 MB.` caption.
- Default size 80px→72px to sit better in the row. Both call sites (`AuthModal` signup,
  `ProfileModal`) render it unchanged. Type-check passes (`tsc --noEmit`).

**Pending / next:**
- **Visual verification not done** — run the dev server and check the new row in both the
  signup form and Profile modal, incl. hover overlay + 320–1280px. Avatar is still not
  persisted to the backend (unchanged — see the 2026-06-24 avatar entry).

### 2026-06-30 — Remove-one-file: real backend endpoint (no re-processing)
**Done:**
- Replaced the earlier "removing a file re-runs the pipeline on the survivors" stopgap
  (which made the *remaining* file visibly re-process) with a real per-document removal.
- **Backend** (`routers/document.py`): new **`POST /document/{session_id}/remove-file`**
  (body `{ filename }`, returns `SessionInfo`). Pops just that `DocumentData` from the
  in-memory session — **survivors keep their already-built FAISS indexes, nothing is
  re-extracted/re-embedded**. Refreshes suggested questions for the new set
  (`generate_suggested_questions` for 1 doc / `generate_multi_doc_questions` for >1),
  best-effort so a failure there can't undo the removal. `session.mode` is a derived
  property, so compare→single happens automatically. Guards: 404 if the file isn't in
  the session; 400 if it's the only document (clear via `DELETE /document/{id}` instead).
- **Frontend:** `documentApi.removeFile(sessionId, filename)` (`api/client.ts`); the hook
  `useDocumentProcessor` gains `removeFile(filename)` — calls the endpoint and swaps in
  the returned session **with no re-processing** when a session exists, falls back to
  re-running on the remaining files only if removal happens *before* the session is ready
  (nothing server-side to trim yet), and routes "remove the last file" through `reset`.
  `Landing.removeFileAt` now delegates to it (last-file case → `startOver` for full local
  cleanup). The surviving row stays "ready" — no flicker.
- **Optimistic removal (follow-up fix):** the first cut still showed a brief "processing"
  on the surviving file, because `setFiles`/`setSession` only ran *after* the backend
  `await` (which includes a ~1–2s suggested-questions regen), leaving a gap. `removeFile`
  now updates the UI **immediately** — drops the file and trims the session locally
  (keeping it `ready`, mode recomputed) with no await — then calls the server in the
  background and swaps in its authoritative response; on failure it rolls back and shows
  an error. Surviving rows never leave "ready".
- **Proceed-gating (follow-up):** to cover the ~1–2s window where the UI shows a file
  removed but the backend hasn't finished, the hook now exposes `removing`. If the user
  hits **Proceed** while `removing` is true, `Landing` sets `proceedPending` instead of
  entering — the orange button shows a `Loader2` spinner and its tooltip flips to
  "Finishing up, one moment…", and a `useEffect` enters the chat automatically the instant
  `removing` flips false (skipped if the removal errored & rolled back). So the session
  entered is always consistent with what's shown.
- Frontend type-check + backend `import main` both pass.

**Pending / next:**
- **⚠️ Restart the backend** so the new route registers (the `--reload` gotcha — a stale
  uvicorn returns 404 for `/document/{id}/remove-file`). Quick check:
  `curl -s -X POST http://localhost:9099/api/document/x/remove-file -o /dev/null -w "%{http_code}"`
  → 401/403/422 = live, 404 = restart.
- **Live verify:** 2-file Pro upload → remove one → the other stays "ready" (no
  re-process), mode/suggested-questions update, chat answers only from the kept file.
- Removing a file *mid-processing* (before ready) still re-runs on the survivors — edge
  case, acceptable. Duplicate filenames in one batch would remove the first match only.

### 2026-06-30 — Multi-file upload: show each filename on its own row
**Done:**
- Fixed the hero chat box collapsing a simultaneous multi-file upload into a single
  `"2 files"` row. The primary upload now renders **one `SourceRow` per file** (its
  `f.name`), so a batch upload reads the same as uploading the files one by one.
- **Frontend only** (`components/Landing.tsx`): destructured the already-exposed
  `files: File[]` from `useDocumentProcessor` and replaced the single primary
  `SourceRow` with `files.map(...)`. URL sources (no `File`) keep the single
  `sourceLabel` row.
- **Per-file progress (fix — was: all rows shared the one overall number):** the
  backend processes the batch as one unit but extracts files in order, emitting a
  `(i/total)` marker as each starts. New `activeFileIdx` parses that marker
  (`session`/`analysing` stage ⇒ all done) and `fileRowProps(idx)` derives each
  row's state: files before the active index show a **tick (ready)**, the active one
  shows the spinner + bar, later ones show **"Queued"**. Rows now advance file-by-file.
- **Per-file removal (fix — was: X removed the whole batch):** there's no server
  "drop one document" endpoint (a session is one batch), so `removeFileAt(idx)`
  **re-runs the pipeline on the remaining files** (`processFiles(remaining)`);
  removing the last file calls `startOver`. This re-uploads/re-indexes the survivors —
  acceptable for ≤5 files; a real add/remove-from-session backend endpoint would avoid
  the re-process. `sourceLabel` is kept as the URL-row label + `removeFileAt` fallback.
- Type-check passes (`tsc --noEmit`).

**Pending / next:**
- **Visual verification not done** — run the dev server (backend needs an OpenAI key)
  and confirm a 2-file Pro upload: both names show, rows tick over one-by-one as the
  pipeline advances, and removing one re-processes only the other. Re-check 320–1280px.
- The active file's bar reuses the global `progress` (no true sub-file %, since the
  backend emits one marker per file, not continuous progress). If smoother per-file
  fill is wanted later, it needs backend sub-progress events.

### 2026-06-30 — Brand logo: app-icon SVGs in navbar + footer
**Done:**
- Replaced the old `FileText`-in-a-coloured-chip mark with the new brand **app-icon tiles**.
  Copied `talktofile_logo/svg/app-icon.svg` and `app-icon-dark.svg` into **`frontend/src/assets/`**.
- **Navbar** (`components/Navbar.tsx`): the orange `bg-[#E2611B]` chip + `FileText` is now
  `<img src={appIcon} className="w-7 h-7 rounded-lg …">` (terracotta tile). Removed the now-unused
  `FileText` import. Wordmark text unchanged.
- **Footer** (`components/Landing.tsx`): the `bg-slate-50` chip + `FileText` is now
  `<img src={appIcon} className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl …">` (terracotta tile — it
  reads better on the orange footer than the dark variant). `FileText` import kept — still used
  elsewhere in Landing.
- **Sizing follow-up (same session):** logos were too small/invisible, so bumped them — navbar to
  `w-10 h-10`, footer to `w-11 h-11 sm:w-14 sm:h-14`.
- **Switched to bare marks (same session):** per request, both swapped from the app-icon
  **tiles** to the transparent **marks**. Navbar → **`mark-color.svg`** (dark+terracotta, reads on
  the light navbar — `mark-white` would've been invisible there, so we used the light-bg variant),
  footer → **`mark-white.svg`** (white, on the orange footer). Marks are transparent, so dropped the
  `rounded`/`shadow` chrome. `app-icon*.svg` now unused (kept in `src/assets/`).
- **Final sizing + spacing (same session, latest — user-approved):** navbar logo `w-14 h-14`; to
  fit it the **navbar bar grew `h-14`→`h-16`**, so `App.tsx` `main` offset `pt-14`→`pt-16` and the
  two `calc(100dvh - …)` panel heights were rebased (`3.5rem`→`4rem`, `5rem`→`5.5rem`). Footer logo
  `w-14 h-14 sm:w-16 sm:h-16`. **Closed the mark↔wordmark gap:** the mark SVG has ~23% transparent
  padding baked on each side, so `gap-2.5`→`gap-1` alone wasn't enough — added a **`-ml-3` on the
  wordmark `<span>`** in both navbar + footer to pull it in (user confirmed it looks right).
- The app-icon SVGs are self-contained (own rounded background), so no chip wrapper is needed.
  SVG imports type-check via the existing `vite/client` reference in `vite-env.d.ts`.
- Updated the Design / Brand wordmark rule to document the new app-icon assets. Type-check passes
  (`tsc --noEmit`).

**Pending / next:**
- **Visual verification not done this session** — run the dev server and confirm the new tiles
  render crisply in the navbar (light bg) and footer (orange bg), and re-check 320–1280px.
- Other logo assets (favicon, lockups, app-store icons) in `talktofile_logo/` are not wired up yet —
  e.g. `favicon.svg`/`favicon-32.png` for the browser tab if desired.

### 2026-06-30 — Generated persona no longer auto-saves
**Done:**
- A generated persona is now a **draft the user must explicitly save**, not an auto-applied one.
- **Backend** (`routers/auth.py`): `POST /auth/persona/generate` no longer calls
  `set_persona_for` — it only generates and returns the draft (removed the now-unused `db`
  dependency). The persona is persisted only by `PUT /auth/persona` (the Save button).
- **Frontend** (`components/PersonaModal.tsx`): `handleGenerate` no longer calls `setPersona`
  (which flipped the local "Active persona" display) or flashes "Saved". It now fills the draft,
  switches to the **Edit prompt** tab, and shows a brand-orange `hint` banner: "Persona drafted.
  Review and tweak it below, then click Save persona to apply it." The hint clears on save, reset,
  and tab switch. The "Active persona" panel stays unchanged until the user actually saves.
- Type-check passes (`tsc --noEmit`); backend imports cleanly.

### 2026-06-30 (latest) — Reverted active voice engine to Whisper (Web Speech failed in both browsers)
**Done:**
- Tested the free Web Speech engine: **red "not available" message in Brave** (expected — Brave blocks
  it) and, even after the restart-wipe fix, **it still didn't transcribe in Chrome** on the dev box.
  Web Speech is therefore a dead end here (Brave is the everyday browser). **Reverted to Whisper**,
  which had already worked end-to-end in Brave.
- Changes: MicButton import back to `useVoiceDictation` (Whisper); **uncommented** the backend
  `POST /tools/transcribe` route in `routers/tools.py`; swapped the ACTIVE/DORMANT banners
  (`useVoiceDictation` active, `useWebSpeech` dormant fallback). Backend `--reload` picked up the
  route (now 403 = live). Type-check passes; backend imports OK.
- **Net state:** Whisper is the active engine. `useWebSpeech.ts` stays in the tree as a free fallback
  for anyone who only uses Chrome/Edge and wants to avoid the (tiny) Whisper cost — one-line import swap.

**Pending / next:**
- **Re-verify Whisper live in Brave** (hard-refresh the frontend): mic permission → orange recording →
  "Transcribing…" spinner → text in the box. Backend must be running (it is) with an OpenAI key.
- Optional: cap transcribe calls against a daily limit (currently logged via `log_usage`, not capped).

### 2026-06-30 (later) — Switched active voice engine to free Web Speech; shelved Whisper
**Done:**
- After confirming the Whisper path worked end-to-end (the earlier failure was a **stale backend**
  + a stuck-state bug, both fixed), switched the **active** voice engine to the **free browser Web
  Speech API** to avoid the per-use Whisper cost. Clarified for the record: the Web Speech failures
  were **never** related to our backend — Web Speech talks to Google directly and never hits our
  API; it fails in **Brave** because Brave strips Google's speech backend (and Firefox has none).
- New `src/hooks/useWebSpeech.ts` (active): robust Web Speech wrapper reusing the Whisper-era
  hardening — `hardReset()` per attempt (no stuck button), full-transcript accumulation (no reliance
  on `isFinal`), auto-restart across silences, deliver-on-stop, and **visible `error`** including a
  clear "not available in Brave/Firefox — use Chrome/Edge" message. Same return shape as the Whisper
  hook, so `MicButton` swaps engines with a **one-line aliased import**.
- **Shelved Whisper (kept, not deleted):** `useVoiceDictation.ts` carries a SHELVED banner and is no
  longer imported; the backend `POST /tools/transcribe` route in `routers/tools.py` is **commented
  out** (imports left in place for a one-uncomment revert). Backend reloaded clean (health 200), and
  the route now 404s as expected.
- Type-check passes; backend imports OK.
- **Bug fixed same session:** the first `useWebSpeech` had `hardReset()` (which clears the
  accumulated transcript) at the top of `start()`, and the **auto-restart on every Chrome pause also
  called `start()`** — so each restart wiped the text. Result in Chrome: speech recognised, **no
  error**, but nothing written. Split into `launch()` (internal restart, **preserves** transcript)
  vs `start()` (user-initiated, clears it). This is the canonical Web-Speech continuous-restart gotcha.

**Pending / next:**
- **Live test of Web Speech (re-test after the restart-wipe fix):** should now work in Chrome/Edge;
  in **Brave** expect the red "not available…" bubble (by design). If we later want it to work in Brave too, revert to the shelved Whisper engine
  (or build a Web-Speech-with-Whisper-fallback hybrid).

### 2026-06-30 — Voice dictation (mic button) on chat inputs — via Whisper
**Done:**
- Added voice-to-text dictation to both chat inputs: a mic button that records and transcribes
  the user's spoken instruction into the text box (it fills the box; it does **not** auto-send —
  the user reviews and presses send/proceed).
- **First tried the browser Web Speech API (no key/cost), but abandoned it** — it relies on the
  browser streaming audio to Google's servers, which **Brave strips out** (and Firefox doesn't
  support at all), so it produced no transcription on the dev machine. Switched to a reliable,
  browser-independent path.
- **Backend:** new `POST /api/tools/transcribe` in `routers/tools.py` — accepts an audio upload,
  transcribes with **OpenAI Whisper** (`whisper-1`, reusing `settings.openai_api_key`), returns
  `{ text }`. Auth-required; 25 MB cap; maps the browser MIME type → a Whisper-recognised extension;
  logs usage as type `transcribe`. **This costs money per use** (Whisper, against the OpenAI budget).
- **Frontend:** new `src/hooks/useVoiceDictation.ts` records mic audio with `MediaRecorder`
  (`getUserMedia`, picks a supported container via `MediaRecorder.isTypeSupported`), and on stop
  uploads the clip via new `toolsApi.transcribe(blob)` → delivers text through `onResult`. Replaces
  the deleted `useSpeechRecognition.ts`.
- `src/components/MicButton.tsx` updated: slate `Mic` → **brand orange** + pulse while recording →
  `Loader2` spinner ("Transcribing…") while Whisper runs. Renders nothing where mic recording is
  unsupported. Wired into `ChatWindow` (between textarea and send/stop) and the `Landing` chat box
  (between textarea and the orange Proceed button).
- Type-check passes (`tsc --noEmit`); backend imports OK (`python -c "import main"`); OpenAI SDK
  1.57.0 confirmed to support `audio.transcriptions.create`.
- **Hardening (same session):** `useVoiceDictation` now has a `hardReset()` run at the start of every
  attempt, so a stuck prior attempt (error mid-recording, etc.) can never lock the button — it
  self-heals in one click. Every failure path sets a human-readable `error`; `MicButton` shows it as
  a **red bubble above the mic** (auto-dismisses after 6s, click to dismiss) and tints the mic red.
  The `transcribing` spinner always clears in a `finally`. Added a `MediaRecorder.onerror` handler.
- **⚠️ Gotcha that cost us time:** new backend routes need a **backend restart** to take effect. The
  running uvicorn was stale (started without `--reload`, or the watcher missed the edit), so
  `POST /api/tools/transcribe` returned **404** while the frontend kept failing silently. Quick check
  that a route is live: `curl -s -X POST http://localhost:9099/api/tools/transcribe -o /dev/null -w "%{http_code}"`
  → **403/401 = registered**, **404 = stale server, restart it**. Always run the backend with
  `--reload` in dev. Backend was restarted this session; route now returns 403 (live).

**Pending / next:**
- **Live end-to-end verification still pending** — with the restarted backend, confirm in **Brave**:
  mic permission prompt → orange recording → transcribing spinner → text lands in the box (Landing +
  ChatWindow). Requires a secure context (localhost/https) and a working mic. Hard-refresh the
  frontend so the new `MicButton`/hook load.
- Optional: count transcribe calls against a daily cap (currently logged via `log_usage` but not
  capped).

### 2026-06-27 — Unified source-row look in the Landing chat box (frontend only)
**Done:**
- Made every source in the hero chat box render identically. New module-level `SourceRow`
  component in `Landing.tsx` is the single source of the row look: grey card body
  (`bg-slate-50`), a rounded brand icon-chip (`w-9 h-9 rounded-xl bg-[#E2611B]/10`) showing a
  `FileText` while uploading and a `CheckCircle` **tick** once ready, the right-side `Loader2`
  spinner + the `from-[#E2611B]/70 to-[#E2611B]` progress bar while uploading, and a Remove (X)
  button. The first upload and every added file/URL now both render through it.
- Replaced the old bespoke status-header (white, no card) and the old plain grey extra-source rows
  (FileText/Link2 icon, no tick/spinner/progress) with a single stacked list. **Newest sits on
  top**, so the first upload is the last row.
- Added sources now play the **same upload animation** as the first file via a front-end-only
  `simulateExtraUpload` (ramps progress, then flips to ready/tick). Timers are tracked in
  `extraTimersRef` and cancelled on remove / startOver / unmount. **Still display-only — added
  sources are NOT uploaded or merged into the session** (backend untouched, as before).
- Per-row ready text shortened to "Ready" (was "Ready. Choose what to do below" on the header) so
  all rows read identically.
- Type-check passes (`tsc --noEmit`). Visual verification in the dev server not done this session.

### 2026-06-26 — Fix: upload stuck / "nothing happens" after picking a non-chat mode
**Done:**
- Fixed a Landing bug where selecting any mode tab other than the default (e.g. **Flashcards**)
  before uploading left the page stuck — the "Ready" chat box never appeared and the tool view
  was never reached. Root cause: the uploader→chat-box swap used `<AnimatePresence mode="wait">`,
  and the mode-tab active-pill (`layoutId="mode-spotlight"`) layout animation prevented framer's
  exit from completing, so the exiting uploader never unmounted and the chat box never mounted.
  This *also* explained "Back to home not working" — the page was wedged in that half-state.
- Replaced the `AnimatePresence` morph with a plain conditional render (each side keeps its own
  entrance animation; the outgoing one unmounts immediately), and namespaced the spotlight
  `layoutId` per tab instance (`mode-spotlight-hero` / `mode-spotlight-chat`). Verified end-to-end
  (Flashcards upload → Proceed → generate cards → Back-to-home) in the browser.

### 2026-06-25 — Merged upstream PR #3 + native "forgot password" (legacy auth)
**Done:**
- Integrated Gautham's upstream PR #3 (responsive home page, `useDocumentProcessor`, Tooltip,
  smoothScroll, plan table) on top of local WIP (charts/share tooling). Resolved 5 conflicts; kept
  both sides' tool buttons and normalized the old red `#E60026` → brand orange `#E2611B`. Landing
  taken wholesale from upstream (new `onEnter`/`useDocumentProcessor` contract).
- Built **native password reset** for legacy auth (was a stub that threw): `password_reset_tokens`
  table + Alembic migration `a3c1d7e9f2b4`; `core/email.py` (Resend, dev-console fallback);
  `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` (rate-limited, single-use,
  30-min, hashed-at-rest, enumeration-safe). Frontend: `authApi.forgotPassword/resetPassword`,
  legacy `AuthContext` reads `?token=` → recovery mode, "Forgot password?" now shown in legacy mode.
- Legacy registration now **requires a unique email** (fixes the screenshot bug where an email was
  typed into the username field and rejected). Verified the full flow end-to-end (API + browser).
**Pending:**
- Set real `RESEND_API_KEY` / `EMAIL_FROM` / `FRONTEND_URL` in prod `.env` to send actual emails.
- Existing legacy accounts with a blank email can't reset until they set one (via profile). Not yet handled.

### 2026-06-24 — Avatar upload + Basic/Pro plan comparison table (frontend only)
**Done:**
- New reusable `src/components/AvatarUpload.tsx` — circular avatar with a camera button (opens an
  `image/*` file picker), a remove (X) button, and a "Change/Upload a photo" link. Reads the chosen
  image into a data URL via `FileReader`; falls back to initials (from a `name` prop) then a `User`
  icon. **Frontend only — the avatar is held in local component state and is NOT uploaded/persisted
  to the backend yet** (no `avatar` field on `UserProfile`, nothing sent on save).
- Wired `AvatarUpload` into the **signup** form of `AuthModal.tsx` (top of "Your details") and into
  `ProfileModal.tsx` (new "Profile photo" section above the details).
- Added a **Plans** section to `Landing.tsx` (anchor `#plans`, before the footer): a 3-column
  comparison table (Feature / Basic plan / Pro plan) driven by a new `PLAN_FEATURES` array, with a
  tick (`Check`, brand orange) or cross (`X`, slate-300) per cell. Pro column header carries a `Crown`.
  Shared-source-of-truth rows kept in sync with the plan tiers (free=1 file/5MB, pro=multi-file/8MB/
  compare/persona).
- Type-check passes (`tsc --noEmit`).

**Pending / next:**
- **Avatar is not persisted** — to make it real, add an `avatar_url` (or storage) path on the backend
  + `UserProfile`, upload the data URL / file on save, and seed `ProfileModal`/navbar from it.
- Visual verification in the dev server not yet done (avatar picker preview, plan table at 320–1280px).

### 2026-06-24 — Upload-first flow: chat box appears during upload, mode chosen after
**Done:**
- Reworked the entry flow so the user no longer pre-selects a mode before uploading. The
  **Landing hero now runs the upload itself** (file or URL) while the user stays on the home page.
- Extracted the upload→process pipeline into a reusable hook `src/hooks/useDocumentProcessor.ts`;
  both `Landing` (new primary path) and `UploadZone` (in-app/recovery fallback) use it (no more
  duplicated WebSocket logic).
- The moment an upload starts, the hero card morphs into a **chat box**: processing status + progress,
  the mode tabs (chat/summary/flashcards/slides/translate/podcast/charts), a text input, and an
  **orange circular Proceed button** (`ArrowUp`, brand `#E2611B`). Proceed enables once the document
  is ready; **chat** mode also requires typed text, the other modes don't (they generate from the doc).
- On proceed, `Landing` hands `App` a ready session via `onEnter(session, mode, prompt)`; `App` drops
  straight into the workspace (skips the old separate UploadZone step). The typed text is threaded to
  `ChatWindow` as `initialPrompt` and **auto-sent as the first message** in chat mode (carried along
  and seeded into chat for other modes). Refresh-guard busy state now also reported from `Landing`.
- **Follow-up (same day):** added an **X "remove" button** in the chat box header (`startOver` →
  aborts/clears and returns to the idle drop-zone; tooltip on the right). The mode selection persists
  across remove.
- **Layout (same day, latest):** mode tabs + blurb are extracted into a `renderModeTabs(pillBg)` helper
  and rendered in **two places, identical except the pill background**: below the drop zone before
  upload (`bg-[#F8FAFC]`), and **inside the white chat box** once it appears (`bg-white`, so it blends).
  Inside the box the order is: uploaded-file status → progress → **helper message** ("Tell us what
  you'd like to do…", sits below the file and above the input) → chat input + Proceed → mode tabs.
  All copy uses full stops, **no em dashes** (swept the whole site; only code comments still contain
  them). Ready-state status text/icon are brand orange, not green.
- Type-check + `npm run build` both pass.
- **Multi-source add (same day) — front-end scaffold only.** Inside the chat box, below the uploaded
  file: two orange **"+ Add more files" / "+ Add more URLs"** buttons, **visible to all users**. Only
  **Pro** can actually add — non-Pro clicking either button gets an inline upgrade hint (`multiHint`)
  and nothing is added. For Pro: "files" opens a native file picker, "URLs" turns the row into a URL
  input; added items render as rows (with remove X) and the +row drops below them. **Important: even
  for Pro these added sources are display-only right now — they are NOT uploaded or merged into the
  session.** The backend builds a session from a single batch (`/document/upload` = files only,
  `/document/url` = one URL; no add-to-session, no mixed/multi-URL), and free plan = 1 source. Wiring
  multi-source for real (deferred batch upload on Proceed + a backend endpoint accepting mixed
  files+URLs, or an add-to-session re-index) is the follow-up.

**Pending / next:**
- **Wire up multi-source for real** (currently front-end only): backend support for a session built
  from multiple files + URLs, and decide the deferred-upload-on-Proceed vs add-to-session approach.
- **Visual/live verification not yet done** — the full upload→chatbox→proceed flow needs the backend
  running (OpenAI key) to exercise. Check: chat box entrance animation, progress/ready states, Proceed
  enable logic, the auto-sent first message landing after Sage's welcome, and URL ingestion. Also
  re-check 320–1280px (the chat box is a new layout).
- Non-chat modes ignore the typed text in their views today (those views take no prompt); the text only
  takes effect if the user later opens chat. Revisit if product wants the text to steer summary/slides.

### 2026-06-24 — "How it works" rewrite + tooltip/scroll primitives
**Done:**
- Rewrote the Landing "How it works" steps (Upload documents and URLs / Ask the assistant / Get the
  response). Step 1's "upload box" and "URL box" are in-page links that scroll to and highlight the
  hero drop zone / focus the URL input.
- New `src/lib/smoothScroll.ts` (`smoothScrollTo`) — slower ease-in-out in-page scroll; now used by the
  step links, the Landing footer + navbar "How it works" links (replacing native smooth scroll).
- New `src/components/Tooltip.tsx` — single source of the tooltip look (dark `#303030` bubble, white
  text, arrow; hover + focus). Used by the step links (`side="right"`) and the Navbar (replacing the
  native `title` attributes, `side="bottom"`). Convention documented in Design / Brand.

**Pending / next:**
- Verify visually in the dev server (tooltip placement, scroll pacing, drop-zone highlight) — not yet
  done this session.

### 2026-06-24 — Mobile responsiveness pass (pre-deploy)
**Done:**
- Full responsive audit + fixes; verified **no horizontal scroll 320–1280px** in a real browser.
  Fixes: chat input `↵ send` overlap, citation panel → sliding overlay on mobile, Landing mode-tabs
  wrap instead of scroll, 320px "Add"-button overflow (`min-w-0`), AuthModal/ProfileModal form grids
  stack on mobile, footer compacted on mobile.
- Wordmark scales down on mobile (`text-[26px] sm:text-[34px]`); CLAUDE.md wordmark rule updated.
- Navbar: "How it works" now hidden below `lg`; Personalise label collapses with Feedback (below `md`).
- Landing hero headline: stepped sizes, always exactly 2 lines, explicit responsive `<br>` so the
  second line is stable (no oscillation) while resizing.

**Pending / next:**
- Optional: collapse the navbar **"Sign in"** label to its icon at the same breakpoint as
  Feedback/Personalise (currently `sm`) for full symmetry.
- Still unbuilt (see "What Is / Isn't Built Yet"): real billing, chat/document persistence, OCR.

---

## Contribution Guidelines

When you complete work in a session:

1. **(MANDATORY) Update the Progress Log** — add a dated entry of what you finished and what's still
   pending (newest first). Required every session, even small ones.
2. **Update this file (`CLAUDE.md`) elsewhere as needed** — add any conventions, gotchas, or status
   that help the next session pick up without re-asking. Keep it factual and forward-looking.
3. **Update the Component Registry** whenever a component is created or its purpose changes.
4. **Frontend:** run `./node_modules/.bin/tsc --noEmit` (or `npm run build`) — changes must be
   type-error free. For UI work, verify visually in the browser.
5. **Backend:** confirm `./venv/Scripts/python -c "import main"` still succeeds.
6. **Never commit `backend/.env`** or any real API key — both are git-ignored; keep it that way.
7. **Match the design language** (indigo + slate, `rounded-2xl`, existing fonts). Don't introduce
   new colours or fonts without agreement.
8. **Keep paths machine-agnostic** — this runs on two desktops. No hardcoded user paths.
9. **List the files you changed** at the end of the task.
10. **Never attribute commits to Claude.** Claude (or any AI assistant) must never appear as a
    GitHub contributor. Do **not** add `Co-Authored-By: Claude …` trailers, a "Generated with
    Claude Code" line, or any similar attribution to commit messages or PR descriptions. Commits
    are authored solely by the human contributors.
