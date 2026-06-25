# TalkToFile — Project Handover for Claude

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

## What Is TalkToFile?

TalkToFile is a private, agentic **"chat with your document"** web app. A user uploads one or
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
| `src/components/Navbar.tsx` | Top nav inside the app | Feedback, Personalise (Pro), sign up / sign in or user menu. Labels collapse to icons on small screens. |
| `src/components/UploadZone.tsx` | Drag-and-drop upload + processing UI (in-app fallback, e.g. password-recovery entry) | Enforces plan file-count/size limits client-side; runs the pipeline via `useDocumentProcessor`. No longer the primary upload path — the Landing hero is (see above). |
| `src/hooks/useDocumentProcessor.ts` | Shared upload→process pipeline hook | Uploads file bytes / a URL, drives the processing WebSocket (`extracting`→`analysing`→`ready`), exposes `{ stage, stageMsg, progress, error, session, processing, processFiles, processUrl, reset }`, and fires the `document_uploaded` analytics event. Used by both `Landing` and `UploadZone`. Does **not** navigate — the caller reacts to `session`. |
| `src/components/ChatWindow.tsx` | The chat experience | Chat WS lifecycle with auto-reconnect, streaming tokens, stop button, suggested questions, summary panel, scroll-to-bottom. Accepts an optional `initialPrompt` — the first message typed on the landing chat box, auto-sent once connected (guarded against resend on reconnect). |
| `src/components/MessageBubble.tsx` | Renders one message (markdown) | Used for user + assistant + guard-reject + feedback prompts. |
| `src/components/SummaryCard.tsx` | Document summary display | `compact` variant used in the side panel and summary drawer. |
| `src/components/AuthModal.tsx` | Login / signup / password reset | |
| `src/components/PersonaModal.tsx` | Pro persona configuration | |
| `src/components/FeedbackModal.tsx` | User feedback form | |
| `src/components/ConfirmDialog.tsx` | Reusable confirm dialog | Used for "leave this chat?" (in-app navigation away). |
| `src/components/TypingIndicator.tsx` | "Sage is typing" animation | |
| `src/components/Tooltip.tsx` | Reusable hover/focus tooltip | **Single source of the tooltip look** (dark `#303030` bubble, white text, arrow). Wrap a target, pass `label` + `side`. Use everywhere instead of native `title`. See Design / Brand. |
| `src/components/AvatarUpload.tsx` | Circular avatar picker with camera/remove controls | **Frontend only** — reads the picked image into a data URL via `FileReader` and returns it through `onChange`; not uploaded/persisted to the backend yet. Falls back to initials (from `name`) then a `User` icon. Used by `AuthModal` (signup) and `ProfileModal`. |
| `src/lib/smoothScroll.ts` | `smoothScrollTo` slow in-page scroll helper | Configurable-duration ease-in-out scroll with `block`/`offset` + reduced-motion support. Use instead of native smooth `scrollIntoView`. |

---

## Design / Brand

Clean, minimal, premium. **Simplicity is the priority — do not add unnecessary complexity.**

- **Primary accent:** indigo (`indigo-600`, with `indigo-500/700` gradients). Neutrals are the
  Tailwind `slate` scale. Surfaces are white / a `glass-card` utility; corners are `rounded-2xl`.
- **Fonts** (loaded in `frontend/index.html`): **Inter** (body), **Plus Jakarta Sans** (the
  `font-brand` wordmark/headings), **JetBrains Mono** (mono accents). Don't add fonts without asking.
- **Wordmark — keep it consistent everywhere.** The "Talktofile" wordmark must always render the
  same way it does in the Navbar (`src/components/Navbar.tsx`): the `FileText` icon in a
  `w-7 h-7 rounded-lg bg-[#E2611B]` chip, next to the text
  `font-brand italic font-bold text-[26px] sm:text-[34px] tracking-[-0.02em] text-[#E2611B]`. The
  wordmark **scales down on mobile** (`text-[26px]` below the `sm` breakpoint, `text-[34px]` at
  `sm` and up) so it doesn't crowd the nav icons on small phones — keep this responsive sizing when
  reusing it. Apart from the size step, reuse this exact treatment anywhere the wordmark appears on
  a light surface — don't restyle it per-location. **On orange/dark surfaces** (e.g. the footer,
  which is `bg-[#E2611B]`) use the inverted variant for contrast — same form and responsive sizing,
  but a `bg-slate-50` chip with an `text-[#E2611B]` icon and `text-slate-50` wordmark text.
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

Built and working: guest + registered auth (legacy JWT or Supabase), single/multi/compare upload
modes, the full extract→index→summarize pipeline, streaming Q&A with reconnect, suggested
questions, per-document summaries, plan limits + daily usage caps, feedback capture, persona
(Pro), rate limiting, and Dockerized production serving (Caddy).

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
