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
| `src/components/Landing.tsx` | Marketing landing page (the "front door") | Hero, "how it works", features, privacy band, CTA, footer. Responsive via Tailwind breakpoints. |
| `src/components/Navbar.tsx` | Top nav inside the app | Feedback, Personalise (Pro), sign up / sign in or user menu. Labels collapse to icons on small screens. |
| `src/components/UploadZone.tsx` | Drag-and-drop upload + processing UI | Enforces plan file-count/size limits client-side; drives the processing WebSocket. |
| `src/components/ChatWindow.tsx` | The chat experience | Chat WS lifecycle with auto-reconnect, streaming tokens, stop button, suggested questions, summary panel, scroll-to-bottom. |
| `src/components/MessageBubble.tsx` | Renders one message (markdown) | Used for user + assistant + guard-reject + feedback prompts. |
| `src/components/SummaryCard.tsx` | Document summary display | `compact` variant used in the side panel and summary drawer. |
| `src/components/FlashcardsView.tsx` | Flashcards study tool | Has a **Share** action (active-card controls + finished screen) that copies/Web-Shares the full Q&A set with a "Made with TalkToFile" attribution. |
| `src/components/SummaryView.tsx` | Full-page document summary | Header **Share** button → copies/Web-Shares the summary with attribution. |
| `src/components/PodcastView.tsx` | Podcast script tool | **Share** + **Download** both emit the script with the attribution footer. |
| `src/components/TranslateView.tsx` | Translate tool | Per-document **Share** + **Download .txt**, both with the attribution footer. |
| `src/lib/share.ts` | Share/export helpers | `withAttribution()` appends a "Made with TalkToFile — <runtime origin>" footer; `downloadText()` (local .txt) and `shareOrCopy()` (Web Share API → clipboard fallback). Used by the four tool views above. Link target is `window.location.origin` — no hardcoded domain. |
| `src/components/AuthModal.tsx` | Login / signup / password reset | |
| `src/components/PersonaModal.tsx` | Pro persona configuration | |
| `src/components/FeedbackModal.tsx` | User feedback form | |
| `src/components/ConfirmDialog.tsx` | Reusable confirm dialog | Used for "leave this chat?" (in-app navigation away). |
| `src/components/TypingIndicator.tsx` | "Sage is typing" animation | |

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
  `font-brand italic font-bold text-[34px] tracking-[-0.02em] text-[#E2611B]`. Reuse this exact
  treatment anywhere the wordmark appears on a light surface — don't restyle it per-location.
  **On orange/dark surfaces** (e.g. the footer, which is `bg-[#E2611B]`) use the inverted variant
  for contrast — same form and size, but a `bg-slate-50` chip with an `text-[#E2611B]` icon and
  `text-slate-50` wordmark text.
- **Responsiveness:** standard patterns are already in place — `hidden sm:block` / `hidden lg:flex`
  to progressively reveal chrome, responsive grids, `100dvh` (not `100vh`) for full-height panels so
  the chat input isn't hidden behind mobile browser chrome.
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

## Contribution Guidelines

When you complete work in a session:

1. **Update this file (`CLAUDE.md`)** — add anything that helps the next session pick up without
   re-asking. Keep it factual and forward-looking, not a session log.
2. **Update the Component Registry** whenever a component is created or its purpose changes.
3. **Frontend:** run `./node_modules/.bin/tsc --noEmit` (or `npm run build`) — changes must be
   type-error free. For UI work, verify visually in the browser.
4. **Backend:** confirm `./venv/Scripts/python -c "import main"` still succeeds.
5. **Never commit `backend/.env`** or any real API key — both are git-ignored; keep it that way.
6. **Match the design language** (indigo + slate, `rounded-2xl`, existing fonts). Don't introduce
   new colours or fonts without agreement.
7. **Keep paths machine-agnostic** — this runs on two desktops. No hardcoded user paths.
8. **List the files you changed** at the end of the task.
