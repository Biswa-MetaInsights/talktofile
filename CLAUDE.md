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
| `src/App.tsx` | App shell, view + session state, modals | Holds the `beforeunload` refresh guard (active only while a chat session exists). Chat/sidebar heights use `100dvh` for mobile correctness. **Auto-feedback prompt:** opens `FeedbackModal` automatically whenever a session closes — in-app via `promptFeedback()` (chat/tool "End session" → `endToHome`, and the "Leave this chat?" confirm), and on a reload/tab-close via the `PENDING_FEEDBACK_KEY` localStorage flag (the `beforeunload` guard sets it, clears it on cancel with a `setTimeout(0)`; the next load reads+clears it and prompts). Rendered in **both** the landing early-return and the main return. |
| `src/components/IntroOfferBanner.tsx` | Post-first-action promo "offer card" | A centered **offer card** over a dim+blurred backdrop (`fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm`), matching a supplied reference. **Theme-aware — the card adopts the site body colour per theme** (light `#F8FAFC` / dark `#0b1120`) via Tailwind `dark:` variants (driven by the `dark` class on `<html>`), i.e. effectively two posters. Header has the **brand-orange Merriweather-italic "Talktofile" wordmark** + a **gold countdown ring** (`CountdownRing`, depleting SVG stroke) reading "closes in N", a rotated gold **"Limited-period offer"** pill, the serif headline **"Pro is ~~$4.99~~ *free*. Really."** (`font-brand`/Merriweather, italic orange "free"), a "Valid through · 31 July 2026" strip, and **Sign up free** (orange) / **Maybe later** (ghost) buttons + a mono footer. **Counts down `TOTAL_SECONDS` (15) then auto-closes**; also dismissable via the X, "Maybe later", or backdrop click. **"Sign up free"** calls `onSignUp` → `App` bumps `signupNonce` → `AppShell` opens the **subscribe** `AuthModal`. **Now a controlled component** (`show`/`onClose`/`onSignUp` props) — it no longer shows itself on load. **`App` decides when to show it: 5s after the user's first action** (their first chat answer / generated summary / flashcards / podcast script, whichever mode they chose on the home page), **once per browser session and no more often than once every 3 days, only if the user hasn't signed up.** All that gating lives in `App` (`handleFirstAction`, `INTRO_OFFER_*` consts, localStorage `ttf_intro_offer_seen` now stores the last-shown **epoch ms** for the 3-day cooldown, not a date); `AppShell.markEngaged` fires `onFirstAction` on the first engagement. Rendered at the top of `App`. |
| `src/components/Landing.tsx` | Marketing landing page (the "front door") **+ the upload/intent flow** | Hero, "how it works", features, privacy band, CTA, footer. **The hero now owns the upload:** dropping a file / adding a URL starts processing in-place (via `useDocumentProcessor`) while the user stays on the page; a chat box then "appears" where they pick a mode (chat/summary/flashcards/…) and type their first request. The orange circular **Proceed** button (`ArrowUp`) enables once the doc is ready (chat mode also needs typed text; other modes don't). On proceed it calls `onEnter(session, mode, prompt)`. Responsive via Tailwind breakpoints. |
| `src/components/Navbar.tsx` | Top nav inside the app | Feedback, Personalise (Pro), sign up / sign in or user menu, and the **light/dark `ThemeToggle`**. Labels collapse to icons on small screens. The account button shows the user's **saved profile photo** (`user.profile.avatar`) next to the name, falling back to a `User` icon. Uses **`mark-white.svg`** in dark mode, **`mark-color.svg`** in light. |
| `src/context/ThemeContext.tsx` | Light/dark theme state (`useTheme`) | Holds `theme` + `toggleTheme`, persists to `localStorage` (`theme`), defaults to OS `prefers-color-scheme` (and follows it until the user chooses explicitly), toggles the `dark` class on `<html>`. Provided in `main.tsx` above `AuthProvider`. Pre-seeded by an inline script in `index.html` (no FOUC). Tailwind is `darkMode: 'class'`. |
| `src/components/ThemeToggle.tsx` | The navbar light/dark switch | Sun icon in dark mode (→ light), moon in light mode (→ dark). Uses the shared `Tooltip`. |
| `src/components/UploadZone.tsx` | Drag-and-drop upload + processing UI (in-app fallback, e.g. password-recovery entry) | Enforces plan file-count/size limits client-side; runs the pipeline via `useDocumentProcessor`. No longer the primary upload path — the Landing hero is (see above). |
| `src/hooks/useDocumentProcessor.ts` | Shared upload→process pipeline hook | Uploads file bytes / a URL, drives the processing WebSocket (`extracting`→`analysing`→`ready`), exposes `{ stage, stageMsg, progress, error, session, processing, processFiles, processUrl, reset }`, and fires the `document_uploaded` analytics event. Used by both `Landing` and `UploadZone`. Does **not** navigate — the caller reacts to `session`. |
| `src/components/WorkspaceHeader.tsx` | Shared top bar for the **non-chat** sections (summary/flashcards/slides/translate/podcast/charts) | A self-contained **copy** of the chat header row (file icon + title, status line, View-summaries drawer, Share, Export, Add files/URLs menu, End session) so those sections match the chat. Chat keeps its own inline header (the reference) — this is not extracted from it. **Both Share and Export now act on the CURRENTLY OPEN section** (via `onShare`/`onExport`/`canAct` props): each tool view registers **two** handlers with `AppShell` (`registerSectionActions(mode, { share, exportPdf } | null)`, typed `SectionShareActions`). **Share** opens the native share sheet / clipboard with that section's **text** (podcast script, translation, flashcards, summary, chart data, slide outline) — the old summary-share behaviour, but scoped to the open section, with a brief ✓ tick. **Export** opens a print / **Save-as-PDF** view of the same section (see `printAsPdf` in `lib/share.ts`). Both buttons are disabled (`canAct=false`) until the section has content. (The header's old summary-only `exportReport` was removed — Summary now registers its own share/export like the rest.) Status is a static "Ready". Rendered by `App.tsx` above each tool view; End session runs `endWorkspaceSession`. |
| `src/components/ModeSwitcher.tsx` | The feature-tab bar (Chat / Summary / … / Charts) | Single source of truth for the tab set (`SWITCH_MODES`), the header labels (`MODE_LABELS`), and the `<ModeSwitcher active onSwitch engaged>` pill row. Rendered by `SectionComposer` at the bottom of every section (chat + the six tool views). An **engaged-but-not-active** tab shows a **filled amber `Star` badge** (top-right) + a `Tooltip` ("Click to pick up where you left off") — the reminder that you have content waiting in that section. |
| `src/components/SectionComposer.tsx` | **The single shared bottom composer used by EVERY section** (chat + the six tool views) | The one source of the input row (textarea + `MicButton` + proceed button + `ModeSwitcher` tabs), so every section is **pixel-identical**. **The only intended per-section differences are props:** `proceedButton` (the send/stop button for chat, the `Generate …` / `Translate …` button for tools — this is what "differs" between sections and also drives the chatbox width), `placeholder`, and an optional `pickerRow` rendered above the input (the Charts chart-type picker, the Translate language picker). Owns the shared boilerplate: auto-grow (min 44 / **max 120px** everywhere), mic-append, and the Enter behaviour. **Input modes:** pass `value`/`onChange`/`onSubmit`/`disabled`/`showEnterHint`/`inputRef` to control it (chat does this — send-on-Enter, the `↵ send` hint, the connection-gated disable); omit them and the composer owns its own input state and pressing Enter shows a **"Coming soon"** bubble (the tool sections — chatting from a tool view isn't wired yet, `TODO(coming-soon)`). **`onSubmit` may return `false`** to mean "I didn't handle this" — the composer then still shows the "Coming soon" bubble. Podcast uses this: it handles "continue" and returns `false` for everything else. **⚠️ When cross-section chatting is implemented, pass `onSubmit` from the tool views (wired to the real pipeline) so the "Coming soon" branch is never hit** (see `TODO(coming-soon)` in the file). **Follow-up suggestions + Preferences boxes:** renders two **blank** (label-only) headers above the input — **Follow-up suggestions** (`Sparkles`) then **Preferences** (`SlidersHorizontal`) directly below it — **only for the tool sections and only once that section is in `engaged`** (i.e. used at least once — e.g. after the summary is generated). Chat is excluded (`active !== 'chat'`) because it renders its own **populated** follow-ups in `ChatWindow`. Both are placeholders (each wrapped in a `Tooltip label="Coming soon" side="right"`) — no suggestion/preference buttons yet (TODO: populate each with per-item boxes). Replaced the old per-section copies (2026-07-03). |
| `src/components/SectionExtras.tsx` | The "Follow-up suggestions" + "Preferences" placeholder rows for the tool sections | Rendered at the **end of each tool view's scrollable content** (last child of the `overflow-y-auto` div, before `SectionComposer`) so they scroll with the section instead of being pinned above the composer. Two rows (Sparkles/Follow-up + SlidersHorizontal/Preferences), each a "Coming soon" `Tooltip`, separated from content by a hairline. `show` prop gates it (typically the view's "has content"/engaged flag). Each row is wrapped in its own `<div>` so they stack (Tooltip is `inline-flex`). Still blank placeholders. Moved here from `SectionComposer` on 2026-07-11. |
| `src/components/WorkspaceComposer.tsx` | Old shared bottom composer — **fully superseded by `SectionComposer` and unused** (not imported anywhere). Safe to delete; kept only as historical reference. | Was a self-contained copy of the chat's bottom area. Its role is now `SectionComposer`'s. |
| `src/components/ChatWindow.tsx` | The chat experience | Chat WS lifecycle with auto-reconnect, streaming tokens, stop button, suggested questions, summary panel, scroll-to-bottom. Accepts an optional `initialPrompt` — the first message typed on the landing chat box, auto-sent once connected (guarded against resend on reconnect). |
| `src/components/MessageBubble.tsx` | Renders one message (markdown) | Used for user + assistant + guard-reject + feedback prompts. **Inline citations:** for a finished Sage answer with sources, it runs `buildCitations` over the answer + passages, renders the marked markdown with `react-markdown` `components` overrides (`p`/`li`/`h*`/`td`/`blockquote`) that swap the injected `⟦C{n}⟧` tokens for `<CitationMarker>` (recursing through nested inline nodes). The old collapsible "View sources" list is replaced by a subtle **"Cited from your document · N passages · hover ¹²³ to view"** footer (clicking it opens the full excerpt in `CitationPanel` via `onCiteSource`). Also shows a brief **"Finding sources…"** hint (`awaitingSources`) between the answer finishing and its passages arriving. |
| `src/components/CitationMarker.tsx` | One inline citation marker (¹²³) + hover popover | Renders a small **bold brand-orange rounded chip** (`bg-brand-50`, `align-super`, inline `fontSize` to beat the 16px CSS floor) so it reads as a tappable citation. On hover/focus a card pops **above** the marker showing the passage with the matched phrase highlighted (`<mark>`), the `¶` location + `% match`. The card has an **invisible bridge** (`pb-2` transparent padding on the popover wrapper) so the cursor can cross up into it without dismissing (plus a 120ms close delay). **Jump to source** calls `onJump(source)` → opens the full `CitationPanel` excerpt. |
| `src/lib/citations.ts` | Citation grounding heuristics | `buildCitations(answer, sources)` splits the answer into sentence spans, matches each passage to its best-fit sentence by significant-word overlap (greedy, prefers distinct sentences), injects `⟦C{n}⟧` tokens numbered top→bottom, and returns the matched phrase + `¶` location per citation. Pure text heuristics — never changes answer wording, only marker placement. |
| `src/components/DocumentPanel.tsx` | Slide-in panel showing a document's **full original text** | The sidebar analogue of the citation `CitationPanel` "Jump to source", but for the whole document. **Sits in-flow** (styled like `CitationPanel`: `fixed lg:relative`, `lg:w-96`) between the left sidebar and the main panel, so the chat/tool view **shrinks** to make room rather than being covered; mobile gets a tap-to-dismiss backdrop. Fetches lazily on open via `documentApi.getContent(sessionId, filename)` → backend `GET /document/{id}/content` (`DocumentData.raw_text`). **Toggled** (open/close) either by clicking a filename in `App.tsx`'s left panel (with a `Tooltip`) or via a `ScrollText` icon in the header row of `ChatWindow` + `WorkspaceHeader` (`docPanelOpen`/`onToggleDocPanel` props) — so it's reachable from every section. `openDoc` state + `toggleDocPanel` live in `AppShell`. |
| `src/components/SummaryCard.tsx` | Document summary display | `compact` variant used in the side panel and summary drawer. |
| `src/components/FlashcardsView.tsx` | Flashcards study tool | Has a **Share** action (active-card controls + finished screen) that copies/Web-Shares the full Q&A set with a "Made with Talktofile" attribution. **Renders its own bottom bar** (like Translate): the **"Generate flashcards"** button sits in the send-button spot and runs the real generation; the cards/progress/results live in the scroll region above. Chat textbox/mic kept for parity. Takes `onSwitchMode` + `engagedModes`; `App.tsx` hides `WorkspaceComposer` for it. |
| `src/components/SummaryView.tsx` | Full-page document summary | **No longer auto-shown** — starts on an empty hero and reveals the summary only when the user clicks **"Generate summary"** in its **own bottom bar** (like Translate; chat textbox/mic for parity, tabs below). The summary is precomputed by the upload pipeline (`doc.summary`); there's no backend regenerate endpoint, so `generate` reveals it after a brief "Summarising…" beat. `onActivity` fires on generate (not mount). Takes `onSwitchMode` + `engagedModes`. |
| `src/components/PodcastView.tsx` | Podcast scripts tool | **Share** + **Download** both emit the script with the attribution footer. **Renders its own bottom bar** (like Translate): the **"Generate podcast script"** button sits in the send-button spot and runs the real generation. **The shared chatbox is now wired (2026-07-06):** it passes `value`/`onChange`/`onSubmit` to `SectionComposer`; typing **"continue"** (or similar — see `isContinueRequest`) extends the conversation via `extendPodcast`, and **any other message returns `false`** so the composer shows its **"Coming soon"** bubble (free-form podcast chat isn't wired yet). The old separate "Want to go deeper?" extend input was removed; a subtle "Continuing the conversation…" indicator shows while extending. Takes `onSwitchMode` + `engagedModes` and renders its own `ModeSwitcher`, so `App.tsx` hides `WorkspaceComposer` for it. |
| `src/components/SlidesView.tsx` | Slide-deck tool | **Free for all** (Pro gate removed 2026-07-06; daily question limit still applies). **No longer auto-downloads** (2026-07-06): **Generate renders the deck inline like a chat that produced a slide** — it uses the chat's **gradient "T" avatar** + a **left-aligned** white chat bubble (framer-motion entrance) showing **only the first slide** as a large preview (stacked-card hint behind it, `Layers` count badge, hover "View all N slides"). `SlideCanvas` (inner component) renders each slide's title/bullets via **container-query `cqw` units** so one markup scales from preview → fullscreen, mirroring the .pptx styling in brand orange. **Clicking the slide / "View fullscreen"** opens a `fixed inset-0` viewer (prev/next + ← → keys, Esc to close, slide counter, speaker-note caption, thumbnail strip). **Download is opt-in** — a "Download .pptx" button posts the *already-generated* slides to `POST /tools/slides/{id}/download` (no second model call). Backend `POST /tools/slides/{id}` now returns **JSON `{slides,title}`** (not a blob). `autoGenerate` now just renders (no forced download). **Renders its own bottom bar** (like Translate); chat textbox/mic kept for parity. Takes `onSwitchMode` + `engagedModes` + `autoGenerate`; `App.tsx` hides `WorkspaceComposer` for it. |
| `src/components/ChartsView.tsx` | Data-visualisation tool (Recharts) | **Renders its own bottom bar** (like Translate): the **chart-type picker** occupies Translate's language-picker slot and the **"Generate `<Type>` Chart"** button sits in the send-button spot. Old in-content type switcher + "Change chart" removed. Chat textbox/mic kept for parity. Takes `onSwitchMode` + `engagedModes`; `App.tsx` hides `WorkspaceComposer` for it. |
| `src/components/TranslateView.tsx` | Translate tool | Per-document **Share** + **Download .txt**, both with the attribution footer. **Renders its own bottom bar** (results scroll above; a pinned composer below) instead of using the shared `WorkspaceComposer` — so `App.tsx` **hides `WorkspaceComposer` when `viewMode === 'translate'`**. That bar replaces the composer's "Follow-up suggestions" row with a **"Translate to"** picker (label + language pills with the custom-language input inline to their right, 2 lines) and replaces the send button with a wide **"Translate to `<language>`"** button that runs the translation. **The language dropdown ends with an "+ Add new language" option** (`ADD_NEW_LANG`, native `title` tooltip "Click here to add a new language to translate"): selecting it reveals an inline "Enter the language name here." box to its right and, for now, submitting just flashes a "Coming soon" bubble — validating + actually adding the language is a pending backend task (see *What Is / Isn't Built Yet* → "Add a custom translation language" and the `TODO(add-language)` marker). The chat textbox + mic are kept (smaller) for parity — sending still shows "Coming soon" (`TODO(coming-soon)`). Renders its own `ModeSwitcher` tabs (takes `onSwitchMode` + `engagedModes`). No inner "Translate" heading (the `WorkspaceHeader` title already says it). |
| `src/lib/share.ts` | Share/export helpers | `withAttribution()` appends a "Made with Talktofile — <runtime origin>" footer; `downloadText()` (local .txt) and `shareOrCopy()` (Web Share API → clipboard fallback), used by both the tool views' own in-section buttons and the header's per-section **Share** (text). **`printAsPdf({title, subtitle, bodyHtml})`** opens a print-friendly window under a shared Talktofile shell (styled with semantic classes: `.line`/`.speaker` for podcast, `.card` for flashcards, `.slide`, `<pre>`, `<table>`, etc.) and triggers `window.print()` (the browser's "Save as PDF") — this is how the header's per-section **Export** works. **`escapeHtml()`** is exported for the sections to build safe `bodyHtml`. **`SectionShareActions`** (`{ share, exportPdf }`) is the type each tool view registers with `AppShell` for the header's Share/Export buttons. Link target is `window.location.origin` — no hardcoded domain. |
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
- **Real billing** — Pro is granted only via the `PRO_EMAILS` env var; there is no payment flow.
- **Persistence of chats/documents** — by design, sessions are in-memory and lost on refresh
  (an in-app confirm dialog and a browser `beforeunload` guard mitigate accidental loss, but there
  is no save/restore).
- **OCR** — scanned / image-only PDFs are rejected with a clear message; no OCR fallback.
- **Pre-rendered landing HTML (SEO)** — the React app is a client-side SPA, so the landing's *body*
  content (hero/features/pricing copy) isn't in the raw HTML; only the `<head>` meta tags are (title,
  description, OG image — added 2026-07-10, so social previews + search titles already work). Google
  renders JS so it still indexes, but a pre-render would make the body crawler-visible too.
  **Future step (low priority — do this well AFTER the blog is populated with posts; blog content is
  the bigger SEO lever).** Chosen approach: **a Vite prerender plugin** (e.g. `vite-react-ssg` or a
  Puppeteer snapshot) that emits static HTML for the landing route at build time — React then hydrates
  it, so the in-place upload UX is unchanged and there's **no refactor**. (Rejected alternatives:
  rewriting the landing in Astro — cleaner output but a real refactor because `Landing.tsx` couples
  marketing + the upload flow; and Next.js — a full rewrite, not worth it for one page.) Watch out for
  SSR-unsafe code at snapshot time (`window`/`localStorage`/WebSockets, the theme script, PostHog) —
  guard it so the static build doesn't crash.

---

## Progress Log

### 2026-07-14 — Fix: Translate language dropdown wouldn't open ("nothing happens" on click)
**Done (frontend):**
- **Symptom (user, on Windows 10 / Chromium):** clicking the "Translate to" `<select>` in the Translate
  section did nothing — the dropdown never opened.
- **Cause:** the only CSS specific to that control (`.translate-lang-select` in `index.css`) styled the
  native `<option>` background — `option:checked { background: #E2611B !important }` + `accent-color`.
  Styling native `<option>` backgrounds forces Chromium off the OS-native popup and, on Windows, can
  make the popup fail to appear at all (looks like "nothing happens" on click). Nothing in the JSX
  blocked it (no overlay/`pointer-events`/`disabled`; `SectionComposer` renders `pickerRow` inline).
- **Fix:** removed the `.translate-lang-select { accent-color }` + `option:checked` block from
  `index.css`, and dropped the now-dead `translate-lang-select` class from the `<select>` in
  `TranslateView.tsx`. The select is back to plain native behaviour (loses only the cosmetic orange
  highlight on the selected row). Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — open Translate, click the "Translate to" dropdown → it should now
  open and list the languages. If it still doesn't open, the cause is an overlay/stacking issue instead
  (would need the app running with a session to inspect via devtools). If the orange selected-row
  highlight is wanted back, the reliable path is a **custom dropdown** (button + panel), not native
  `<option>` styling.

### 2026-07-14 — Translate: "Add new language" dropdown option + inline new-language box (frontend-only)
**Done (frontend, `TranslateView.tsx`):**
- Added an **"+ Add new language"** entry as the last option in the "Translate to" `<select>`
  (sentinel value `ADD_NEW_LANG`). It carries a native `title="Click here to add a new language to
  translate"` tooltip (native `<option>` tooltip — the shared `Tooltip` component can't wrap a
  `<select>` option).
- **Selecting it does not change the target language** — it reveals an **inline text box to the right
  of the dropdown** (`showAddLang` state) with placeholder **"Enter the language name here."**.
- **Submitting the box (Enter) flashes a "Coming soon" bubble** (`submitNewLang` → `showComingSoon`,
  same dark `#303030` pill used by `SectionComposer`, auto-hides after 2s). No language is actually
  added yet — the validation/registration backend isn't built.
- Type-check (`tsc --noEmit`) passes.

**Pending / next — this is a UI stub; the real work is BACKEND + a small frontend wire-up:**
- See **"Add a custom translation language (PENDING)"** under *What Is / Isn't Built Yet* for the full
  plan: backend must **validate** the entered name is a real, translatable language, then the frontend
  must **append it to the dropdown list and select it** instead of showing "Coming soon".
- Look for the `TODO(add-language)` marker in `submitNewLang` (`TranslateView.tsx`).
- **Visual verification not done** — open Translate, pick "+ Add new language", type a name, press
  Enter → confirm the box appears to the right of the dropdown and the "Coming soon" bubble shows.

### 2026-07-14 — Intro-offer banner: daily (was every 3 days) + new "1 min idle on home" trigger
**Done (frontend, all in `App.tsx`):**
- **Cooldown 3 days → 1 day.** `INTRO_OFFER_COOLDOWN_MS` is now `24*60*60*1000`. So a guest who
  hasn't signed up can see the banner **once a day** (was once every 3 days). localStorage key /
  epoch-ms mechanism unchanged (`ttf_intro_offer_seen`).
- **New second trigger — 1 minute of inactivity on the home page.** Besides the existing "5s after
  first action" trigger, the banner now also fires after **60s of no activity** (`mousemove` /
  `mousedown` / `keydown` / `scroll` / `touchstart`) while on the **home page** (`view === 'landing'
  && !session`). It **counts as the once-a-day appearance** — both triggers share the same gate.
- **Refactor:** extracted the gating (once-per-session `introFiredRef` + not-signed-up + once-a-day
  cooldown + re-check-signup-at-fire-time) into `scheduleIntroOffer(delayMs)`. `handleFirstAction`
  calls it with `INTRO_OFFER_DELAY_MS` (5s); new `handleHomeInactivity` calls it with `0` (show now).
  Because both go through the same `introFiredRef` guard, whichever comes first wins and the other
  no-ops — the banner still shows at most once per session.
- **Inactivity effect** lives in `AppShell` (where `view`/`session` are), gated on `atHome`, reads the
  callback via `onHomeInactivityRef` so unrelated re-renders don't reset the idle timer. New
  `INTRO_OFFER_INACTIVITY_MS = 60_000` const + `onHomeInactivity` prop threaded App → AppShell.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — as a guest on the home page: (1) sit idle ~60s → banner appears;
  (2) do a first action → banner ~5s later; confirm it shows **at most once per session** and not
  again the same day (clear `ttf_intro_offer_seen` in localStorage to re-test), and never for a
  signed-up user.

### 2026-07-14 — Split the header actions: Share = section text (native sheet), Export = section PDF
**Done (frontend):** follow-up to the 2026-07-13 work below, per the user. The two header buttons now
have distinct jobs, both scoped to the **currently open section**:
- **Share** → the **native share sheet / clipboard** of the section's **text** (via `shareOrCopy` +
  `withAttribution`) — i.e. the button's original pre-2026-07-13 behaviour, but sharing the open section's
  content instead of always the summary. Shows a brief ✓ tick reflecting "shared" vs "copied".
- **Export** → the **print / Save-as-PDF** view of the section (the `printAsPdf` behaviour that Share
  briefly had on 2026-07-13).
- **Mechanism change:** the per-section registry now carries **two** handlers, not one. `lib/share.ts`
  exports a `SectionShareActions` type (`{ share: () => Promise<'shared'|'copied'>; exportPdf: () => void }`).
  `AppShell` renamed `registerShare`→**`registerSectionActions(mode, actions|null)`**, holds `sectionActions`
  (ref) + `actionableModes` (Set), and exposes `shareActiveSection()` / `exportActiveSection()`.
  `WorkspaceHeader` props are now `onShare` (returns the share promise, drives the tick) + `onExport` +
  `canAct` (single enabled flag — a section has both or neither). Its old summary-only `exportReport` +
  `escapeHtml` import were removed (Summary registers its own share/export now).
- Each tool view (`SummaryView`/`FlashcardsView`/`TranslateView`/`PodcastView`/`SlidesView`/`ChartsView`)
  registers `{ share, exportPdf }`: `share` reuses each section's existing text builder (podcast
  `scriptText`, flashcards `FLASHCARDS…`, summary `DOCUMENT SUMMARY…`, translation joined docs, slides
  outline, chart data as tab-separated rows); `exportPdf` is the existing `printAsPdf` handler.
- **Export tooltip** reads **"Download <Section> as a pdf"** (was "Export … as a PDF").
- **Fixed the app freezing while the print/Save-as-PDF dialog is open.** `window.print()` is synchronous
  and blocks whichever thread calls it; `printAsPdf` used to call `win.print()` from the **opener** (the
  Talktofile tab), so the whole app was unclickable until Save/Cancel. Now the print trigger is an **inline
  `<script>` embedded in the new tab's own document** (`setTimeout(window.print, 300)`), so the modal
  blocks only the print tab — Talktofile stays fully interactive. `printAsPdf` no longer calls
  `win.print()`/`win.focus()` from the opener.
- **Chat section made consistent too** (it keeps its own inline header, not `WorkspaceHeader`). Its
  `exportReport` now **reuses `printAsPdf`** (so it gets the same shell + non-blocking print) instead of its
  own `window.open`/`win.print()`; the chat-message classes (`.msg`/`.label`/`.body`) were added to the
  shared `printAsPdf` stylesheet. Tooltips aligned: Export → **"Download Chat as a pdf"** (was "Export
  report"), Share → **"Share Chat"** (was "Share chat"). Share still text-shares the transcript.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- Uncommitted, same working branch. **Visual verification not done** — in each section: Share opens the
  OS share sheet (mobile) / copies (desktop, ✓ tick) with that section's text; Export opens a print
  window (Save-as-PDF); both are **disabled** until the section has content. The native share sheet's
  look follows the OS (can't be themed).

### 2026-07-13 — Header "Share" now shares the CURRENTLY OPEN section as a PDF (not always the summary)
> **Superseded by the 2026-07-14 entry above** — Share was split back to native text-share and the PDF
> moved to Export. The registry/`printAsPdf` groundwork below still stands.

**Done (frontend):**
- **Problem:** the Share button in the shared `WorkspaceHeader` row (the one with See-original-document
  / Share / Export / Add / End-session) always shared the **document summary**, regardless of which tool
  section was open. The user wanted it to share whatever section is selected — e.g. in Podcast it should
  share the **podcast script as a PDF**. (User picked the **Print / Save-as-PDF** delivery via the browser's
  print dialog — no new PDF library.)
- **Architecture — a per-section "share registry":** the generated content (podcast script, translation,
  flashcards, chart, slides) lives in each tool view's own state, which the shared header can't see. So each
  view now **registers a "Share as PDF" handler** with `AppShell`:
  - `App.tsx` (`AppShell`) holds `shareHandlers` (a `useRef<Partial<Record<AppMode, () => void>>>`) + a reactive
    `shareableModes: Set<AppMode>` state. `registerShare(mode, fn)` (stable `useCallback`) sets/clears the
    handler and updates the Set. `shareActiveSection()` calls `shareHandlers.current[viewMode]?.()`.
  - `WorkspaceHeader` gained **`onShare` + `canShare`** props. The Share button calls `onShare` and is
    **disabled until `canShare`** (`shareableModes.has(viewMode)`); tooltip reads "Share <Section> as a PDF"
    / "Generate <Section> first to share it". Its old `shareSummary` (native/clipboard text) was removed;
    **Export is unchanged** (still the summary report). Dropped the now-unused `shared` state + `Check`/
    `shareOrCopy`/`withAttribution` imports; `escapeHtml` now imported from `lib/share`.
  - Each of `SummaryView` / `FlashcardsView` / `TranslateView` / `PodcastView` / `SlidesView` / `ChartsView`
    takes `registerShare?` and, in a `useEffect`, registers a handler when it has content (null otherwise, so
    `canShare` flips off). Each handler builds section-specific `bodyHtml` and calls the new **`printAsPdf`**.
- **New `printAsPdf({title, subtitle, bodyHtml})` + `escapeHtml` in `src/lib/share.ts`** — opens a
  print-friendly window under a shared Talktofile shell (one stylesheet with semantic classes:
  `.line`/`.speaker` podcast dialogue, `.card` flashcards, `.slide` deck outline, `<pre>` translation,
  `<table>` chart data, summary `h3`/`ul`) and fires `window.print()` (→ "Save as PDF"). Charts additionally
  **serialize the rendered Recharts `<svg>`** (via a `chartRef`) into the PDF, plus a data table (scatter skips
  the table). Slides share a readable **outline** (title + bullets + speaker notes); the `.pptx` download stays
  the primary export.
- `window.open` runs synchronously inside the Share click handler, so it isn't popup-blocked.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-13 work.
- **Visual verification not done** — in each section: generate content, click header Share → a print window
  opens with that section's content; confirm Save-as-PDF looks right (podcast dialogue, translation, flashcards,
  summary, slide outline, and the **chart SVG + table**), and that Share is **disabled** before content exists.
  Charts SVG capture relies on the section being visible at click time (it is — Share only acts on the active
  section); check the serialized chart renders in the print window (Recharts inlines most styles).

### 2026-07-13 — "Continue" buttons on Translate (placeholder) + Podcast (live)
**Done (frontend):**
- **Context:** the backend truncates translations — `translate_agent.py` caps input at
  `[:14000]` chars and output at `max_tokens=4000` — so long docs get cut off mid-way. The frontend
  renders the full string it receives (`TranslateView.tsx` result body is `whitespace-pre-wrap`, no
  clamp), so the cutoff is purely backend. Added "Continue" affordances toward fixing that.
- **`TranslateView.tsx`:** added a **"Continue"** button at the end of the results (styled like the
  Flashcards "Finish" button — `px-8 py-2.5 rounded-xl bg-[#E2611B]`), shown when any doc has
  `translated_text`. It's a **non-functional placeholder** (no backend to translate the truncated
  remainder yet) wrapped in a `Tooltip label="Coming soon"`. Imported `Tooltip`.
- **`PodcastView.tsx`:** added a matching **"Continue"** button after the dialogue that **is wired** —
  its `onClick` calls the existing `extend(...)` (same backend `extendPodcast` path as typing
  "continue" in the chatbox). Hidden while `extending` (the "Continuing the conversation…" indicator
  shows instead).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- Uncommitted. The Translate "Continue" needs a backend endpoint to translate the rest of a truncated
  document (chunked/paged translation) before it can be wired up — until then it's "Coming soon".
- The real backend fix for the cutoff is raising/removing the `[:14000]` input slice + the
  `max_tokens=4000` cap in `translate_agent.py` (and/or chunked translation); not done here.

> **MANDATORY — do this every session.** At the end of each session, add a short dated entry below
> (newest first) recording **what you finished** and **what's still pending**. This is required even
> for small sessions. Keep entries terse (a few bullets), not a blow-by-blow transcript. The
> detailed "how" belongs in the relevant section above; this log is just the running status so the
> next session/developer can see at a glance where things stand.

### 2026-07-11 — Blur the Charts/Translate proceed button for unsupported file types (+ warning line)
**Done (frontend, the deferred task — user chose the file-type rule):**
- **New `src/lib/fileSupport.ts`** — a frontend, extension-based heuristic (approximate by design;
  a PDF/DOCX with tables can't be detected here): `TABULAR_EXTS = ['xlsx','xls','csv']`.
  `chartsSupported(session)` = the session has a spreadsheet/CSV file; `translateSupported(session)`
  = the session has a **non**-spreadsheet file. So a spreadsheet supports Charts (not Translate); a
  prose doc / web page / JSON / code supports Translate (not Charts).
- **New `notice?: string` prop on `SectionComposer`** — renders an amber warning line (AlertCircle +
  text) **just above the input row**, in the pinned bottom bar so it's always visible.
- **`ChartsView` / `TranslateView`:** compute `supported`; when false the proceed button gets
  `blur-[1.2px] opacity-60 cursor-not-allowed`, and hovering **or** pressing it sets a
  `showUnsupported` state that feeds the composer's `notice` (hidden again on mouse-leave). The
  button's `onClick` no-ops (shows the warning) instead of calling generate/translate when
  unsupported. Charts' auto-generate-on-entry is also gated on `supported` (shows the warning instead
  of firing a doomed request).
- Warning copy (user-specified): Charts → "Charts cover spreadsheets only (.xlsx and .csv files).";
  Translate → "Translation covers text only. Images, charts, and scanned pages cannot be translated."
  (same wording as the near-title `MODE_WARNINGS.translate`).
- **Verified live:** `report.txt` (non-tabular) in Charts → button `blur(1.2px)`/opacity 0.6, notice
  on hover; `data.csv` in Translate → button blurred, notice on hover. Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- The rule is **approximate** (extension only). If you want it accurate (e.g. a PDF that *does* have
  tables should allow Charts), that needs a backend `supports_charts`/`supports_translate` flag per
  document — swap `fileSupport.ts` for that when/if it exists. Also easy to tweak the `TABULAR_EXTS`
  list or make Translate "always supported".

### 2026-07-11 — Translate: drop body note + full-height result; Podcast: remove redundant inner header
**Done (frontend):**
1. **Translate — removed the in-body scope note** (`{result.note}` `<p>`, the "Translation covers only
   the text content…" line). The scope caveat now lives only next to the section title
   (`WorkspaceHeader` `MODE_WARNINGS.translate`, `xl`-only). `TranslateView.tsx`.
2. **Translate — the translated text shows in full** (no inner scroll). Removed `max-h-80
   overflow-y-auto` from the result body so it expands; the section's own scroll area handles
   overflow. **Follow-up fix:** the result **card** has `overflow-hidden` and, as a flex child of the
   `flex flex-col` scroll area, was *shrinking* — clipping the text while the section didn't grow
   enough to scroll. Added **`shrink-0`** to the card so it keeps its full content height; the section
   then scrolls to reveal the whole translation. Verified with a long doc: body full height
   (3334px, no internal clip), `sectionScrolls:true`, last section visible when scrolled.
3. **Podcast — removed the redundant inner header** (its own "Podcast Scripts" heading + Share /
   Download / Chat buttons), which duplicated the shared `WorkspaceHeader` row ("the first line across
   all sections"). `PodcastView.tsx` — kept the legend + dialogue; `shareScript`/`downloadScript` are
   now unused but left in place (noUnusedLocals is off). Verified the inner heading no longer renders.
- Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- **DONE** (see the entry above, "Blur the Charts/Translate proceed button…") — the user chose the
  frontend file-type rule; implemented via `src/lib/fileSupport.ts` + the composer `notice` prop.

### 2026-07-11 — Warnings xl-only, tooltips → native title on mobile, "Type here.", chat placeholder all-sizes, flashcard tooltips
**Done (frontend, four items):**
1. **Header mode warnings ("Translation covers text only…" / Charts equivalent) now show only at
   `xl`+** — `WorkspaceHeader.tsx` warning div `hidden md:flex` → **`hidden xl:flex`**. Below 1280px
   it's hidden (it was crowding the header actions); at 1280px+ it shows. Verified hidden @1000,
   `display:flex` @1360.
2. **Tooltips no longer *hidden* on small screens — they fall back to the native `title` tooltip**
   (the same style the header buttons use). `Tooltip.tsx` adds a `matchMedia('(max-width:767px)')`
   state and sets `title={isSmall ? label : undefined}` on the wrapper; the custom bubble stays
   `hidden md:block`. So < `md` → native `title`, ≥ `md` → custom dark bubble (no double). Verified
   @375 (bubble `display:none` + `title` set) and @800 (bubble `block`, no `title`).
3. **`SHORT_PLACEHOLDER` "Type here…" → "Type here."** (dropped the ellipsis), `SectionComposer.tsx`.
4. **Chat placeholder "Ask anything here." at ALL sizes** — the narrow-screen short-placeholder
   override now excludes chat: `isNarrow && active !== 'chat' ? SHORT_PLACEHOLDER : placeholder`. Only
   the tool sections get "Type here." on mobile; chat keeps "Ask anything here." (verified @375 in the
   live chat view). (Chat's composer gets `active={activeMode}`, which is `'chat'` exactly when the
   chat view is the visible one, so the check is correct.)
5. **Flashcards: `✗`/`✓` buttons get `title="Got it wrong"`/`"Got it right"`** (`FlashcardsView.tsx`)
   so the icon-only mobile buttons show the label as a native tooltip (task-2 style); full text still
   shows from `sm` up.
- Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- "Largest screen" for the warnings = `xl` (1280). If a different threshold is wanted (`lg` 1024 or
  `2xl` 1536), it's a one-word change.

### 2026-07-11 — Shorter chat placeholder + hide tooltips below tablet
**Done (frontend):**
1. **Chat input placeholder shortened** — `ChatWindow.tsx` now passes
   `placeholder="Ask anything here."` to its `SectionComposer` (was the long default
   "Ask anything about the document or add your preferences here. Shift+Enter for a new line."). On
   phones the composer's narrow-screen override still swaps in "Type here…" (< `sm`); desktop shows
   "Ask anything here.".
2. **Tooltips hidden below `md` (tablet)** — `Tooltip.tsx` bubble is now `hidden md:block`, so on
   phone-width screens (< 768px) no tooltip renders (hover is unreliable there and the bubble crowded
   the UI). At `md`+ they behave as before. Verified: `display:none` @375px, `display:block` @800px.
   Note: this makes the earlier below-`sm` left-flip effectively moot (nothing shows below `md` now),
   but it's kept in case the hide breakpoint is lowered later.
- Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- Deferred (user said "for later"): make the Translate + Charts header **mode warnings** ("Translation
  covers text only…") show **only at the largest screen size** — they currently show at `md`+ and
  crowd the header actions.
- Tooltip hide breakpoint is `md` (768). If "tablet" was meant as `lg` (1024), it's a one-word change.

### 2026-07-11 — Translate dropdown orange border + right-tooltips flip left on mobile
**Done (frontend):**
1. **Translate language dropdown highlighted** — `TranslateView.tsx` `<select>` border changed from
   `border border-slate-200` (+ `dark:border-slate-700`) to **`border-2 border-[#E2611B]`** (brand
   orange, both themes), dropping the redundant `focus:border` since the border is already orange.
   **(Follow-up:) the "Translate to" label + dropdown now sit on one line at all sizes** — a
   `flex items-center gap-2` row with the label `flex-shrink-0` and the select
   `flex-1 min-w-0 sm:flex-none sm:w-72` (fills the row on mobile, fixed 288px on desktop), instead
   of the label stacked above a full-width select.
2. **`side="right"` tooltips now flip to the LEFT below `sm`** (`Tooltip.tsx`). On small screens a
   right-opening bubble ran off the right edge and was invisible (e.g. the Landing **Proceed** button
   tooltip, which sits at the right of the chatbox). Since `right` is the site-wide default, updating
   just the `right` entries in `BUBBLE_POS`/`ARROW_POS` fixes **every** default tooltip at once:
   below `sm` the bubble uses `right-full mr-2` (opens left) + a left-edge arrow; at `sm`+ it flips
   back via `sm:right-auto sm:left-full sm:ml-2` (+ arrow `sm:left-auto sm:right-full` and the border
   color swaps `sm:border-l-transparent sm:border-r-[#303030]`). `top`/`bottom`/`left` unchanged.
- **Verified live** at 375px: the Proceed tooltip's bubble now sits fully within the viewport
  (`left=85,right=283` on a 375px screen, `opensLeft:true`); Translate `<select>` border computes
  `rgb(226,97,27)` 2px. Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- Trade-off of the always-flip approach: a `side="right"` tooltip on a **left-edge** element could now
  clip on the left on mobile (rare in this app). A position-aware flip would need JS measurement;
  deferred.

### 2026-07-11 — Move Follow-up/Preferences from the pinned composer to the end of each section's content
**Done (frontend):**
- Per the user: they still want the **"Follow-up suggestions" + "Preferences"** placeholder rows, but
  **not pinned above the composer** — they want them at the **end of the section content** so you can
  scroll down to reach them (superseding the previous "hide on mobile" change).
- **New `src/components/SectionExtras.tsx`** — the two placeholder rows (Sparkles/Follow-up +
  SlidersHorizontal/Preferences, each with a "Coming soon" `Tooltip`), separated from the content by a
  hairline (`pt-4 mt-2 border-t`). `show` prop gates visibility. **Each row wrapped in its own `<div>`**
  so they stack (Tooltip is `inline-flex`, so a bare `space-y-2` would put them side by side).
- **Removed** both placeholder blocks from `SectionComposer.tsx` (and its now-unused `Sparkles`/
  `SlidersHorizontal`/`Tooltip` imports).
- **Rendered `<SectionExtras>` at the end of each tool view's scroll area** (as the last child of the
  `overflow-y-auto` content div, before the pinned `<SectionComposer>`): `SummaryView` (`show={generated}`),
  `FlashcardsView` (`show={!!cards.length}`), `TranslateView` (`show={!!result}`), `PodcastView` /
  `ChartsView` / `SlidesView` (`show={engagedModes.has('<mode>')}`). Chat is unaffected (it has its own
  inline suggested questions).
- Verified live at 390px + 1000px (Summary): the rows render **inside the scroll area** (scroll to reach
  them), stacked, above the composer — not pinned. Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- Still blank placeholders ("Coming soon"). When real follow-up suggestions/preferences exist, populate
  `SectionExtras`.

### 2026-07-11 — Flashcards mobile layout + hide Follow-up/Preferences placeholders on mobile
**Done (frontend):**
1. **Flashcards — answer & hint no longer squeezed by buttons** (`FlashcardsView.tsx`).
   - **Revealed answer:** was a `flex justify-between` with the answer squeezed left and the two
     score buttons on the right. Now the **answer is a full-width `<p>` on its own line(s) below the
     question**, and the score buttons sit on their **own row below** (`justify-end`). On mobile the
     buttons are **just `✗` / `✓`** (`<span className="sm:hidden">✗</span>` + `hidden sm:inline` for
     the full "✗ Got it wrong" / "✓ Got it right"); `aria-label`s added.
   - **Hint:** was rendered in a `flex-1` span wedged between the "Show hint" and "Reveal answer"
     buttons. Now, when shown, it's a **full-width line below the question**; the two buttons are on
     their own row underneath (Reveal answer pushed right with `ml-auto`).
2. **Hid the "Follow-up suggestions" + "Preferences" placeholder rows on mobile** (`SectionComposer.tsx`
   — added `hidden sm:block` to both). They're empty "Coming soon" placeholders that only ate vertical
   space above the composer on phones. (When real content lands, consider moving them into the
   scrollable section body instead — the user's preferred long-term option.)
3. **Hero font** — confirmed the `<h1>` is **27px live at 320px** (a user report of "still 24px" was a
   stale browser/HMR cache; there is no `24px` left in the code).
- Verified live at 390px (real flashcard generation): hint + answer full-width, `✗`/`✓` icon buttons,
  Follow-up/Preferences not rendered. Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- Desktop flashcards now also stack (answer above, buttons below-right) — cleaner, but a change from
  the old same-line look; revert to responsive stacking (`sm:flex-row`) if the old desktop look is
  preferred.

### 2026-07-11 — Remove chat scroll-to-bottom btn, bigger mobile hero, mode tabs fit 2 lines on mobile
**Done (three frontend changes):**
1. **Removed the chat "scroll to bottom" button** (the orange `ChevronDown` FAB, `showScrollBtn`,
   `absolute bottom-24 right-6`) from `ChatWindow.tsx` — deleted the render block + the now-unused
   `ChevronDown` import. (`showScrollBtn` state + `scrollToBottom` are left; `scrollToBottom` is still
   used by the messages effect.)
2. **Hero headline bigger on small screens.** `Landing.tsx` `<h1>` ("Upload files. Paste website
   links. Ask anything.") mobile steps enlarged; final ladder: **base `text-[27px]`**,
   `min-420:31`, `min-520:38`, `sm:44`, `md:56`. (First bumped each sub-`sm` step +4px, then per a
   follow-up the smallest bucket `<360` was merged up so **320px now uses the same 27px as 360px**
   — the user found 24px too small at the narrowest width.) At 27px the line "Upload files. Paste
   website" renders **296px** wide (measured via Range) — it fits inside a 320px viewport, but the
   hero `<section>`'s `px-6` (24px each side) left the title only ~272px, so it wrapped to 3 lines.
   Fix: gave the `<h1>` **`-mx-4 min-[360px]:mx-0`** — only the headline pulls ~16px wider each side
   at the narrowest widths (the rest of the hero keeps its padding), so 320px now fits **2 lines**
   (box 306px > 296px). No page overflow at 320/360/375px.
3. **Workspace mode tabs (`ModeSwitcher`) now fit ~2 wrapped lines on mobile, no horizontal scroll.**
   Reverted the earlier one-line `overflow-x-auto` scroll back to `flex-wrap` (with `gap-1 sm:gap-1.5`);
   tighter mobile padding (`px-2 py-1 sm:px-3 sm:py-1.5`, still `text-xs`); and **short mobile-only
   labels** for the two longest tabs (new `SHORT_LABELS`: `flashcards → "Cards"`, `podcast →
   "Podcast"`) via `<span className="sm:hidden">{short}</span><span className="hidden sm:inline">{full}</span>`.
   Result at 375px: row 1 = Chat/Summary/Cards/Slides, row 2 = Translate/Podcast/Charts. Header titles
   (`MODE_LABELS`) are unchanged (still "Flashcards"/"Podcast scripts").
- **⚠️ Gotcha — the 16px font floor.** `index.css` has a rule forcing `.text-[9px]`…`.text-[15px]`
  (arbitrary bracket sizes only) to `font-size: 1rem !important`. So `text-[11px]` renders at **16px**
  (bigger, not smaller) — my first attempt at shrinking the tabs made them worse. **Named** classes
  (`text-xs`=12px, `text-sm`=14px) are NOT floored, so use those to go below 16px. This is why the
  tabs use `text-xs`, not an arbitrary px value.
- Type-check passes; all three verified live via Playwright at 320/375px.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- Mobile tab labels "Cards"/"Podcast" are abbreviations — fine on a small tab, but revisit if they
  read as ambiguous.

### 2026-07-11 — Translate dropdown, one-line mobile tabs, hide overview toggle on mobile, inline chat suggestions
**Done (four frontend changes):**
1. **Translate: language pills → dropdown.** `TranslateView.tsx` replaced the 20+ selectable
   language **pills + the gated "type any language" input** with a single **`<select>`**
   (`w-full sm:w-72`) in the "Translate to" `pickerRow`. Dropped the now-dead `customLang`/
   `isCustomLang` state + the "Coming soon" tooltip branch on the Translate button (it's always
   enabled now), and removed the unused `Tooltip` import.
2. **Mode tabs on one line on small screens.** `ModeSwitcher.tsx` container now
   `flex-nowrap overflow-x-auto justify-start` (hidden scrollbar) below `sm`, reverting to
   `sm:flex-wrap sm:justify-center` above — so the 7 tabs are a single **horizontally-scrollable
   row** on phones instead of wrapping to 3 lines. Tabs got `flex-shrink-0 whitespace-nowrap`
   (and the wrappers `flex-shrink-0`, incl. `Tooltip className`). No page overflow at 390px (they
   scroll internally).
3. **Hide the "View overview" toggle below `lg`.** The sidebar-collapse button (`PanelLeftOpen`,
   `title="View overview"`) in **both** `ChatWindow.tsx` and `WorkspaceHeader.tsx` is now
   `hidden lg:inline-flex` — the overview panel is `lg`-only, so the toggle did nothing on smaller
   screens.
4. **Chat suggested/follow-up questions now render inline with the messages.** Moved both the
   "Suggested questions" (pre-first-exchange) and "Follow-up suggestions" (after each Sage answer)
   blocks out of the footer (where they were pinned above the composer) into the **message scroll
   region**, just before `messagesEndRef`, restyled to sit in the conversation flow (no `border-t`/
   footer bg). They now scroll with the conversation instead of being attached to the chat box.
- **Verified live** (Playwright, real upload) at 390px + 1000px: Translate shows the dropdown
  (mobile full-width, desktop `w-72`); mode tabs are one scrollable line on mobile; the overview
  toggle is gone from the header on mobile; chat suggested questions appear inline after the welcome
  bubble on both widths. Type-check passes. (Follow-up-after-answer block mirrors the suggested block
  verbatim — moved by parity, not separately driven.)

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- The mobile tab row is scroll-only (no visible scrollbar/affordance) — consider a subtle fade/edge
  hint if discoverability is a concern.

### 2026-07-11 — Fix: tool-section chatbox rendered 2 lines on small screens
**Done:**
- Fixed the shared composer's textarea showing as **2 lines instead of 1 on small screens**
  (reported for Slides/Charts; actually affected every tool section). Root cause: the placeholder
  `"Add your preferences here."` **wraps to two lines below ~375px**, and `SectionComposer`'s
  auto-grow effect runs at mount with empty text and reads that wrapped-placeholder `scrollHeight`
  (~68px), pinning the box to two lines. (Only reproduces at narrow widths — it's fine on desktop.)
- Two changes, both in **`SectionComposer.tsx`** (so every section is fixed at once):
  1. **Short placeholder on small screens (all sections):** below `sm` (matchMedia
     `max-width: 639px`) the textarea uses `SHORT_PLACEHOLDER = 'Type here…'` instead of the passed
     placeholder, so it can't wrap. Reactive to resize via a `matchMedia('change')` listener.
  2. **Height hardening (root cause):** the auto-grow effect now forces `height: 44px` whenever the
     field is **empty** (`!text.trim()`), so an empty box is always exactly one line regardless of
     placeholder length/width. Auto-grow still applies once the user types.
- **Verified live** (Playwright, mount at width): Summary composer is **1 line at 360/375/480px**
  with placeholder `"Type here…"`, and **1 line at 1280px** with the full `"Add your preferences
  here."`. Type-check passes.

**Pending / next:**
- Uncommitted, same working branch as the other 2026-07-11 work.
- The short placeholder applies to **chat too** (it also routes through `SectionComposer`) — matches
  the "all sections" request; revisit if chat should keep a distinct mobile placeholder.

### 2026-07-11 — Tool-section action buttons collapse to icon-only on small screens
**Done:**
- Fixed a real responsive bug the user reported: the tool sections' action buttons
  ("Regenerate summary", "Translate to <language>", "Generate flashcards", etc.) kept their
  **full text at every width**, so on narrow screens the fixed-width button squeezed the shared
  chatbox/textarea. Now **below `sm` (640px) each button collapses to just its icon** (a 44px
  square, matching the mic/send buttons); the text label returns at `sm`+.
- Frontend only, all six tool views that pass a `proceedButton` to `SectionComposer`:
  `SummaryView`, `TranslateView`, `FlashcardsView`, `PodcastView`, `SlidesView`, `ChartsView`.
  Per button: className `px-5` → `justify-center … h-11 w-11 sm:w-auto px-0 sm:px-5`, the label
  wrapped in `<span className="hidden sm:inline">…</span>`, and an **`aria-label`** added (the
  hidden `<span>` leaves the a11y tree on mobile, so the button keeps its accessible name).
- Chat's own send/stop button was already icon-only, so it was left as-is (this only affected the
  tool-view generate/translate buttons).
- **Verified live** (Playwright, real upload → Translate view): button width **222px with label at
  768/1280px**, **44px icon-only at 360/414px** (`aria-label` intact); the textarea reclaims the
  freed width. Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- Uncommitted, on the same working branch as the other 2026-07-11 work.
- Breakpoint chosen is `sm` (640px). If a longer label ("Generate podcast script") still feels
  tight in the 640–767px band, bump those to collapse at `md` instead — trivial per-button change.

### 2026-07-11 — Android app (Capacitor shell) + fix homepage horizontal scroll on phones
**Done:**
- **Android app scaffolded** as a **Capacitor** shell that loads the **live** site
  (`https://talktofile.ai`) in a full-screen WebView — so the existing responsive React frontend *is*
  the app, and deploys to the site flow to the app with no new Play Store release. Added to
  **`frontend/`**: `@capacitor/core` + `@capacitor/android` (deps) + `@capacitor/cli` (dev),
  **`capacitor.config.ts`** (`appId: ai.talktofile.app`, `appName: Talktofile`, `server.url` = live
  site, `webDir: dist` as offline fallback), and the generated native project in **`frontend/android/`**.
  Verified a headless **`./gradlew assembleDebug` → BUILD SUCCESSFUL** (4.5 MB `app-debug.apk`) using
  Android Studio's bundled JDK 21 + SDK 36. **Not committed / not yet on the Play Store** — this is a
  local shell; publishing needs a Google Play Developer account. `android/local.properties` is
  machine-specific (git-ignored by Capacitor).
- **Fixed horizontal (sideways) page scroll on the homepage at phone widths** — surfaced by running the
  app on a real phone. Measured on live: **155px of overflow at 360px wide**. Two causes, both fixed:
  1. **`Navbar.tsx` didn't shrink:** the 56px logo mark + `text-[26px]` wordmark + right-side actions
     were slightly too wide and nothing could shrink. Made the mark `w-11 h-11 sm:w-14 sm:h-14`, the
     wordmark `text-[22px] sm:text-[34px]` with `-ml-2 sm:-ml-3` + `truncate`, added `min-w-0` to the
     left group and `shrink-0` to the right actions group (left yields first, actions never get pushed off).
  2. **Tooltips overflowed (the real bulk):** `Tooltip.tsx` renders its bubble always-in-DOM at
     `opacity-0` with `absolute w-max`; near the right edge a wide bubble (e.g. "Personalise your
     assistant (Pro)") extended to x=515 on a 360px screen. `body` already had `overflow-x:hidden` but
     **fixed-position** (navbar) + absolute tooltips **escape body's clip**, so the scroll happened on
     `<html>`. Added **`html { overflow-x: hidden }`** in `index.css` (root-level clip; vertical scroll
     intact). Empirically verified (Playwright, injected on the live navbar): overflow **155px → 0px**,
     `maxScrollLeft` 0 at 320/360/390px.
- Type-check (`tsc --noEmit`) + `npm run build` pass.

**Pending / next:**
- **These frontend fixes are on branch `c-cleanup`, uncommitted, and NOT deployed** — the Android app
  loads the *live* site, so the phone won't show the navbar/overflow fix until the frontend is deployed
  to `talktofile.ai` (DEPLOY.md: `git pull && docker compose build web && docker compose up -d web`).
- **Android Phase 2 (not started):** app icon/splash from `talktofile_logo/`, native status-bar theming,
  hardware back-button handling, then Phase 3 (signing key, release AAB, Play Store listing).
- Tooltips now rely on root clipping rather than not-overflowing; a `side="right"` tooltip at the extreme
  screen edge could clip on hover (harmless; touch devices don't hover). Fixing at source would mean
  making the hidden bubble `display:none` (loses the fade) — deferred.

### 2026-07-10 — SEO step 1: OG image + meta tags + robots/sitemap (frontend only)
**Done:**
- **`frontend/index.html`:** added `og:image` (+ width/height/alt), `og:site_name`, `twitter:title`/
  `twitter:description`/`twitter:image`, and a `canonical` link. **Changed the browser-tab `<title>`
  (and `og:title`/`twitter:title`) to `Talktofile.ai : AI Chat, Summaries, and More for Files and URLs`.**
  Left the `<meta name="description">` as-is (flagged for a possible rewrite; it's the search snippet).
- **`frontend/public/og-image.png`** (new, 1200×630): light `#F8FAFC` paper background, the **color
  lockup** (`lockup-color-transparent.png` — real Merriweather wordmark baked in), a **terracotta
  `#C2410C` border on all four sides**, and the title as a balanced 2-line tagline. Generated with
  Pillow (script kept in the session scratchpad, not committed). Note: the lockup PNG source is only
  391px wide, upscaled ~1.6× — re-export a larger `lockup-color-transparent.png` if razor-sharpness is
  wanted.
- **`frontend/public/robots.txt`** (new): allow-all + points to both `/sitemap.xml` and the blog's
  `/blog/sitemap-index.xml`. **`frontend/public/sitemap.xml`** (new): lists the homepage. Both serve
  from the apex root (Vite copies `public/` → `dist/` → Caddy serves `/srv`).
- `npm run build` passes; all three files land in `dist/`.

**Pending / next:**
- **Uncommitted** — these changes are in the working tree on `c-cleanup`, not committed yet.
- **Verify after deploy** with X Card Validator / LinkedIn Post Inspector / FB Sharing Debugger (they
  cache — force a refresh).
- Optional: rewrite `<meta name="description">` to match the new positioning.
- **Pre-rendered landing HTML** is the next SEO code step but **low priority — after blog content**
  (see "Not built / known gaps" above for the chosen prerender-plugin approach + caveats).

### 2026-07-07 — Left details panel is now drag-resizable (standard resizable sidebar)
**Done:**
- Made the **left details panel** (filename + "…see the original document" + Overview/summary) **width-
  adjustable by dragging its right edge**, like a standard resizable sidebar. Frontend only, all in
  **`App.tsx`** (`AppShell`).
- **Drag handle:** a thin strip on the panel's right edge (straddles the border, `z-30`) with
  **`cursor-col-resize`** (the ↔ arrow the user asked for) and a brand-orange line on hover/while
  dragging. Mouse-down starts a window-level `mousemove`/`mouseup` drag (so the cursor can outrun the
  handle); body cursor + `user-select` are locked during the drag.
- **State/consts:** new `sidebarWidth` (px, session-only like `sidebarHidden`) + `resizingSidebar`.
  Bounds: `SIDEBAR_DEFAULT_WIDTH=288` (the old `w-72` "standard size"), `MIN=220`, `MAX=560`,
  `COLLAPSE=180`. Width is clamped to [MIN, MAX]; a `transition-[width]` smooths non-drag changes and
  is disabled while dragging.
- **Minimise + restore:** dragging narrower than `COLLAPSE` **snaps the panel shut** (`sidebarHidden`)
  and resets the stored width to DEFAULT, so the **existing header `PanelLeftOpen` toggle** (in
  `ChatWindow` + `WorkspaceHeader`) reopens it at the **standard size** — that's the visible "put it
  back" option. **Double-clicking the handle** also resets to DEFAULT.
- **Structure change:** the panel's fixed-width `w-72 xl:w-80 … overflow-y-auto` div was split into an
  **outer width container** (`relative`, inline `style={{ width }}`, holds the handle) + an **inner
  scroll area** (`p-5 gap-4 overflow-y-auto scrollbar-thin`), so the handle isn't clipped by the scroll
  overflow and doesn't fight the scrollbar. Panel is still `hidden lg:flex` (lg+ only), so resize is a
  desktop affordance; the inline width is inert on mobile.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — on lg+, hover the right edge (↔ cursor + orange line), drag to
  widen/narrow (clamps 220–560px), drag hard-left to minimise → header toggle reopens at standard width,
  and double-click the handle resets. Check light/dark. Width is session-only (a reload starts at 288px);
  persist to localStorage if that's wanted.

### 2026-07-07 — Intro-offer banner now fires 5s after the user's first action (not on load), shows 15s
**Done:**
- Changed **when** the promo `IntroOfferBanner` appears. It no longer shows on page load — it now
  appears **5 seconds after the user's first action** (their first chat answer / generated summary /
  flashcards / podcast script, i.e. whichever mode they chose on the home page) and **stays up for 15s**
  before auto-closing. Also **replaced the em dash** in the footer copy with a comma ("Free through
  31 July 2026, $4.99/month after.").
- **`IntroOfferBanner.tsx` is now a controlled component:** props are `show` / `onClose` / `onSignUp`.
  It dropped its own `useState(true)` TESTING toggle, its load-time show logic, and the `SEEN_KEY`/
  `today()` per-day localStorage gate. It only renders + runs the `TOTAL_SECONDS` (15s) auto-close
  countdown (calls `onClose` on depletion / X / "Maybe later" / backdrop). `remaining` resets each time
  `show` flips true.
- **All the "when/whether to show" logic moved to `App`** (`App.tsx`):
  - `handleFirstAction()` is passed to `AppShell` as `onFirstAction`; **`AppShell.markEngaged` calls it
    on the first engagement** of the session (guarded by a `firstActionRef`, so once per AppShell mount).
    `markEngaged` already fires for every content-producing section (chat send, generate summary/
    flashcards/podcast/slides/charts/translate), so "first action, whichever mode" is covered.
  - `handleFirstAction` gates: **skip if signed up** (`user && !user.is_guest`), **skip if within the
    3-day cooldown** (localStorage `ttf_intro_offer_seen` now stores the last-shown **epoch ms**, not a
    `YYYY-MM-DD` date — `INTRO_OFFER_COOLDOWN_MS = 3 days`). Otherwise it starts a **10s timer**
    (`INTRO_OFFER_DELAY_MS = 5s`) that, on fire, **re-checks sign-up** (`userRef` — they may have signed up
    during the delay), writes `Date.now()` to localStorage, and sets `showIntroOffer = true`. Timer is
    cleared on unmount.
  - Net gate: **once per browser session, at most once every 3 days, only if not signed up.**
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — upload a doc as a **guest**, do a first action (chat/summary/
  flashcards/podcast), wait ~5s → the card appears (stays ~15s); confirm it does **not** reappear in the same
  session, does not show for a signed-up user, and stays hidden for 3 days after being shown (clear
  `ttf_intro_offer_seen` in localStorage to re-test). Check light/dark + 320–1280px.
- Still **date-agnostic** (doesn't auto-hide after 31 July 2026) — remove it or add a date gate once
  the offer ends.

### 2026-07-07 — First-load full-screen "introductory offer" splash
**Done:**
- Added a **full-screen promo banner** shown the **first time the app is opened on a given
  browser/device**, announcing that **Pro features are free for everyone who signs up, until
  31 July 2026**. It covers everything for **5 seconds**, then fades out and reveals the app.
- **New `src/components/IntroOfferBanner.tsx`** (frontend only): `fixed inset-0 z-[100]` orange
  gradient overlay (brand `#E2611B`) with the white brand mark, an "Introductory offer" pill, the
  headline, and the "free till 31 July 2026" line. framer-motion fade in/out; theme-agnostic (it's a
  solid orange splash, same in light/dark).
  - **Once per browser per day** via `localStorage` **`ttf_intro_offer_seen`**, which stores the
    **last-shown local date** (`YYYY-MM-DD`); the banner re-shows when the calendar day changes.
    `show` is decided **synchronously in `useState`** so the app never flashes behind it; today's
    date is written on mount; a 5s `setTimeout` dismisses it. Wrapped in try/catch so a blocked
    localStorage still shows the banner rather than crashing. (Was once-ever-per-browser initially;
    changed to per-day on 2026-07-07 for visibility during the promo.)
  - Fixed the copy typo from the request ("free for for everyone" → "free for everyone who signs up").
- Wired into **`App.tsx`**: imported and rendered at the very end of the top-level `App` return
  (above the toast), so it sits over every view (landing/app/loading) regardless of session state.
- Type-check (`tsc --noEmit`) passes.

**Redesigned same day** into a centered **dark "offer card"** (per a supplied reference) instead of
the full-screen orange splash: dim+blurred backdrop; a warm near-black card with the wordmark + a
**gold countdown ring**, a rotated "Limited-period offer" pill, the serif headline "Pro is ~~$4.99~~
*free*. Really.", a "Valid through 31 July 2026" strip, and **Sign up free** / **Maybe later**
buttons. It **counts down 8s then auto-closes** (also X / Maybe later / backdrop). Wired **"Sign up
free" → the subscribe modal**: `IntroOfferBanner` takes `onSignUp`; `App` holds a `signupNonce`
bumped on click; `AppShell` (new `signupNonce` prop) opens the `subscribe` `AuthModal` when it
changes. Also switched the gate from once-ever to **once-per-browser-per-day** (localStorage stores
the last-shown date).

**Pending / next:**
- **⚠️ Currently in TESTING mode — shows on EVERY load** (per request). The per-day gate is
  commented out in `IntroOfferBanner.tsx` behind clear `TESTING` markers. **Before shipping, revert
  it** (swap `useState(true)` back to the localStorage initializer, and restore the
  `localStorage.setItem(SEEN_KEY, today())` line).
- **Visual verification not done** — check the card at 320–1280px (headline `text-4xl`→`text-5xl`),
  the ring depletes + auto-closes, and "Sign up free" opens the subscribe modal after the card closes.
- It's **date-agnostic** (doesn't auto-hide after 31 July 2026) — remove it or add a date gate once
  the offer ends.

### 2026-07-06 — Podcast: fold the "continue" chatbox into the shared composer + rename "Podcasts" → "Podcast scripts"
**Done:**
- **Removed the separate "Want to go deeper? Ask the hosts to continue." extend box** (its own input +
  send button) from `PodcastView.tsx`.
- **Wired the shared bottom `SectionComposer` chatbox to drive the continue flow instead.** Podcast now
  passes `value`/`onChange`/`onSubmit`/`disabled` to the composer. `handleChatSubmit`:
  - if the text matches `isContinueRequest` (`continue|keep going|go on|carry on|proceed|more|next|and
    then|go deeper`) **and** a script exists **and** not already extending → calls `extend(...)`
    (`extendPodcast` with a generic "continue naturally, go a little deeper" request), clears the input.
  - **anything else → returns `false`**, so the composer falls back to its **"Coming soon"** bubble
    (free-form podcast chat isn't wired to the backend yet — deliberately does nothing).
  - Placeholder switches to `Type "continue" to keep the conversation going…` once a script exists; a
    subtle "Continuing the conversation…" spinner shows in the scroll area while extending.
- **`SectionComposer` change (shared):** `onSubmit` may now return `void | boolean`; the Enter handler
  shows the "Coming soon" bubble when `onSubmit()` returns `false`. Other tool sections are unaffected
  (they still don't pass `onSubmit`, so Enter → "Coming soon" as before).
- **Renamed the feature "Podcasts" → "Podcast scripts" in the visible UI:** the tab label
  (`ModeSwitcher` `SWITCH_MODES`, which also feeds the header title via `MODE_LABELS`), the Landing mode
  card label + its blurb (the blurb no longer implies playable audio), the Landing plans-table row
  ("Translation and podcast scripts"), and the `PodcastView` section headings ("Podcast Scripts").
  Left grammatical deliverable phrasing that already reads correctly (the "Generate podcast script"
  button, "Writing your podcast script…", the `podcast_script.txt` download name, and the `UploadZone`
  "Create a podcast script" fallback label) — swapping those to "Podcast scripts" would break the
  sentences. Code identifiers / API routes / the `'podcast'` `AppMode` value are unchanged.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — generate a script, type "continue" → new lines append (spinner
  shows); type something else → "Coming soon" bubble; confirm the tab/header/landing now read "Podcast
  scripts" (light/dark, 320–1280px).
- Free-form podcast chat still needs a backend before the non-"continue" branch can do more than
  "Coming soon".

### 2026-07-06 — Slides: render inline "like a chat produced a slide" instead of auto-downloading
**Done:**
- **Slides no longer auto-download.** Generating a deck now **renders it inline** as an assistant-style
  card (thumbnail grid of HTML slide previews), with **View fullscreen** and an **opt-in Download .pptx**.
- **Backend (`routers/tools.py`):** split slides into generate vs. download.
  - `POST /tools/slides/{id}` now returns **JSON `{slides, title}`** (the structured deck from
    `generate_slides_data`) instead of a PPTX blob. Still logs one `question` usage + the daily-limit cap.
    502 if the model returns an empty deck.
  - **New `POST /tools/slides/{id}/download`** accepts `{slides, title}` and builds the .pptx from the
    *already-generated* data via `build_pptx` — **no model call, no extra limit charge** (auth-scoped;
    400 if `slides` empty). So generation runs once; download just packages what the user sees (WYSIWYG).
- **Backend (`agents/slide_agent.py`):** finished the documented red→orange migration the slide agent was
  missed in — `_BRAND_RED` `#E60026`→**`#E2611B`** (kept the var name) + the title subtitle tint
  `#FFCCCC`→`#FBE0D1`, so the downloaded .pptx matches the on-brand inline preview.
- **Frontend (`SlidesView.tsx`, rewritten):**
  - New inner **`SlideCanvas`** renders one slide as HTML (title slide = orange bg; content slide = white
    + orange accent bar + bulleted body). Uses **container-query `cqw` units** (`containerType:
    'inline-size'`) so the *same* markup scales from small thumbnail to fullscreen — font sizes track the
    slide's own width. Slides stay white/orange in both themes (they're slides).
  - `generate()` now POSTs and stores `slides`/`title` (no blob, no download). **The deck is presented as a
    chat message** (refined 2026-07-06): the **gradient "T" (Talktofile) avatar** — copied verbatim from the
    chat's Sage avatar (`w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700` bold white "T") —
    on the left, **left-aligned** (not centered) with a white chat bubble (`rounded-2xl rounded-bl-md`),
    animated in via `framer-motion`. The bubble shows **only the first slide** as a large preview (with
    **stacked card layers behind it** hinting at the rest, a `Layers N` count badge, and a hover "View all N
    slides" reveal); clicking it opens the full deck fullscreen. **View fullscreen / Download .pptx** buttons
    below. (The old 2/3-col thumbnail grid was replaced by the single-first-slide preview.)
  - **Fullscreen viewer:** `fixed inset-0 z-50`, large current slide, prev/next buttons **+ ← → keys, Esc
    to close**, slide counter, speaker-note caption, and a bottom **thumbnail strip**. Download button also
    present up top.
  - **`download()`** posts the current `slides` to the new `/download` route (`responseType:'blob'`),
    triggers the .pptx save, flips to a "Downloaded" tick.
  - `autoGenerate` (landing-selected entry) now just **renders** the deck on arrival — the old
    auto-download-on-load concern is gone.
- Type-check (`tsc --noEmit`) passes; backend `import main` OK.

**Pending / next:**
- **⚠️ Restart the backend** so the changed `/tools/slides` (now JSON) + new `/tools/slides/{id}/download`
  routes take effect (if not on `--reload`).
- **Visual verification not done** — generate a deck: thumbnails render, click → fullscreen navigates
  (arrows/keys/strip), Download saves a .pptx that opens in PowerPoint and matches the preview (orange
  branding). Check light/dark + 320–1280px, and that landing-selected entry renders (no download) on arrival.

### 2026-07-06 — Auto-ask for feedback whenever a session closes
**Done:**
- To get more users leaving feedback, the **`FeedbackModal` now opens automatically at the end of a
  session** (any section — chat, summary, flashcards, etc.), not just from the navbar button. All
  wiring is in **`App.tsx`** (`AppShell`), frontend only.
- **In-app close → prompt immediately.** New `promptFeedback()` opens the modal; called from
  **`endToHome`** (so both the chat "End session" via `ChatWindow.onReset` **and** the tool-view
  "End session" via `endWorkspaceSession` are covered) and from the **"Leave this chat?"**
  `ConfirmDialog.onConfirm` (logo / How-it-works while in a session).
- **Reload / tab-close → prompt on the next load.** The browser owns the native "Reload site?"
  prompt, so we can't open our modal mid-unload. Instead the existing **`beforeunload` guard** now
  drops a `localStorage` flag (`PENDING_FEEDBACK_KEY = 'ttf_pending_feedback'`) and schedules a
  `setTimeout(…, 0)` that removes it: if the user **confirms** leaving, the page unloads before the
  timer runs → the flag survives → an on-mount effect in `AppShell` reads+clears it and opens the
  modal. If they **cancel**, the timer fires → flag cleared → no prompt. (The guard already skips
  `isProgrammaticReload()`, so a 401-recovery reload never triggers it.)
- Naturally gated to real sessions — the beforeunload guard and the in-app end paths only exist once
  a session/upload exists (e.g. after a file is uploaded). `FeedbackModal` is rendered in **both**
  the landing early-return and the main return (a closed session lands on the landing view).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — in a browser: upload a file → End session → feedback modal
  appears over the landing; repeat via "Leave this chat?"; then with a live session hit browser
  reload → confirm → after the page reloads the feedback modal appears (and cancelling the reload
  does **not** prompt).
- Possible follow-ups if it feels too frequent: suppress the auto-prompt if the user already sent
  feedback this session, or throttle to once per N closes.

### 2026-07-06 — Fix: Summary auto-reveal hung on "Summarising…" forever (StrictMode timer trap)
**Done:**
- **Bug:** after adding auto-generate-on-entry, picking **Summary** on Landing left it **stuck on the
  "Summarising…" spinner indefinitely** — nonsensical, since Summary has *nothing to generate* (it just
  reveals the precomputed `doc.summary` after a 500ms cosmetic beat).
- **Root cause — a React StrictMode double-invoke trap (dev only).** `SummaryView`'s `generate()`
  schedules the reveal via `setTimeout` stored in `genTimer.current`, and a **separate** effect
  `useEffect(() => () => clearTimeout(genTimer.current), [])` clears it on unmount. StrictMode
  double-invokes effects on mount (**setup → cleanup → setup**), so: my ref-guarded auto-gen effect
  scheduled the timer on the first setup → the separate effect's **cleanup cleared that timer** → the
  **ref guard (`didAutoGen`) blocked the second setup from rescheduling** → the reveal timer never
  fired and `loading` stayed `true` forever. (The other tool views don't hit this: their `generate()`
  is a plain async fetch with no cleanup cancelling it, so the ref-guard pattern is fine there —
  their front-loaded slowness is just the genuine model latency now shown up front.)
- **Fix (`SummaryView.tsx`, frontend only):** replaced the ref-guarded auto-gen with a **self-contained**
  effect — it schedules its own timer and returns its own `clearTimeout` cleanup, no blocking ref. That's
  the StrictMode-safe "run once" shape: the second setup reschedules its own timer, so it always fires.
  Manual "Generate summary" button path (uses `genTimer.current` + the unmount-cleanup effect) unchanged.
- **Lesson:** the `didAutoGen` ref "run once" pattern is **not** StrictMode-safe when the work being
  started can be cancelled by a *separate* cleanup effect (here, a timer). For such work, schedule +
  cancel within the *same* effect instead of guarding with a ref. Async-fetch auto-gens are unaffected.
- Type-check (`tsc --noEmit`) passes.

### 2026-07-06 — Slides made free for all (removed Pro gate) + auto-run on Landing entry
**Done:**
- **Slide generation is no longer Pro-only.** Removed the gate in **two places**:
  - **Backend** (`routers/tools.py`, `generate_slides`): deleted the `plan != "pro"` → **402** check.
    Everyone can now generate slides; the shared **daily question limit** still applies as the cost cap.
  - **Frontend** (`SlidesView.tsx`): stripped all Pro conditionals — dropped `useAuth`/`isPro`, the
    non-Pro upgrade hero, the `Crown`/`Lock`/`Tooltip` imports, the `disabled={!isPro}` on the button,
    and the "Pro only" tooltip. Everyone now sees the normal "Create Slide Deck" content + an enabled
    Generate button.
- **Auto-run now applies to Slides for all users.** The `autoGenerate` effect no longer requires
  `isPro`, so picking Slides on Landing → Proceed downloads the deck on entry (see the caveat below).
  The marketing **plans table already listed slides as `basic: true`** (`Landing.tsx` `PLAN_FEATURES`),
  so no copy change was needed there.
- Type-check (`tsc --noEmit`) passes; backend `import main` OK.

**Pending / next:**
- **⚠️ Restart the backend** so the un-gated `/tools/slides` route takes effect (if not on `--reload`).
- **Live verify:** as a **free** user, pick Slides on Landing → Proceed → the .pptx downloads on entry;
  and via the Slides tab, click Generate → downloads. Confirm no 402.

### 2026-07-06 — Landing-selected section auto-generates on entry (skip the redundant "Generate" click)
**Done:**
- When a user picks a tool section on the **Landing page** and clicks **Proceed**, that section now
  **generates immediately on arrival** instead of showing an empty hero + a "Generate …" button they
  have to click. This applies **only** to the section chosen on Landing — once in the workspace,
  **switching tabs** between Chat/Summary/Flashcards/etc. keeps the normal manual button (no auto-run).
- **Mechanism (frontend only):** each tool view gained an optional **`autoGenerate?: boolean`** prop.
  On mount, a `useEffect` guarded by a `didAutoGen` ref calls the view's existing `generate()` exactly
  once. `App.tsx` passes `autoGenerate={selectedMode === '<mode>'}` to each view. Key insight: the
  distinction is **`selectedMode`** (the Landing choice, stable for the session) **vs `viewMode`** (the
  active tab). Views stay mounted across tab switches, so the mount-effect fires once for the
  landing-selected view only — a later tab switch never re-triggers it. Wired into `FlashcardsView`,
  `SummaryView`, `PodcastView`, `ChartsView` (default type 'bar'), and `SlidesView`.
- **Excluded — Translate** (per the user): it needs a target-language choice first (like chat needs a
  typed prompt), so it keeps its manual "Translate to <language>" button even from Landing.
- **Slides caveat:** its `generate()` **downloads a .pptx** (there's no in-view render), so auto-run
  = an automatic download on entry. (The Pro gate was **removed later the same day** — see the entry
  above — so this now applies to all users.) Flagged to the user in case an auto-download-on-load
  feels too aggressive — trivial to disable Slides auto-run alone if so.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — from Landing, pick each section → Proceed → confirm it generates
  on arrival (spinner → content) with no button click; then confirm switching tabs to another section
  still shows that section's empty hero + manual Generate button (no auto-run). Check Slides' auto-
  download feel for Pro, and that free users just see the upgrade state (no auto-run).

### 2026-07-06 — Fix: deleting one file mid-upload removed *both* files
**Done:**
- **Bug:** uploading two files simultaneously and clicking X on the second **while it was still
  uploading** removed **both** rows, not just the second. Root cause was a race in
  `hooks/useDocumentProcessor.ts`. Deleting a file before the session is `ready` has nothing
  server-side to trim, so `removeFile` falls back to `processFiles(remaining)` (re-run the
  pipeline on the survivor). But the **original** batch's WebSocket was never closed and its
  promise stayed live — when that stale socket later closed/errored, its `catch` block ran
  `setFiles([])`, wiping the whole list (including the survivor the new upload had just set).
- **Fix (`useDocumentProcessor.ts`, frontend only):** added a monotonic **`uploadGen` ref**.
  `processFiles`/`processUrl` bump it at the start, close any in-flight socket, and **guard every
  async state write** (`onmessage`, the `if (sessionInfo) setSession`, and the `catch`) with
  `uploadGen.current === gen`, so a superseded upload's handlers — crucially the `setFiles([])`
  in `catch` — can no longer clobber the current one. `reset` also bumps the gen (covers
  "delete the last remaining file mid-upload"). The `session`-exists removal path (optimistic
  trim + backend `remove-file`) was already correct and is unchanged.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Live verify:** start a 2-file Pro upload, click X on the second *while both are still
  processing* → only the second disappears, the first finishes and stays "ready". Also confirm
  deleting the last remaining file mid-upload returns cleanly to the drop zone.

### 2026-07-06 — Made Supabase OAuth actually work end-to-end (fixed backend token rejection)
**Done:**
- Goal: get the social sign-in buttons (Google / Microsoft / LinkedIn) functional, not just rendered.
  Found and fixed a **hard backend blocker** that would have broken *all* Supabase auth (OAuth, email,
  and anonymous guests), then verified the full flow with a real Supabase token.
- **Root cause:** this project (ref `tbfvjowsqfvtljfmvzij`) issues **ES256 asymmetric** access tokens
  (confirmed via its JWKS endpoint + by minting a real anonymous session — token `alg=ES256`). The
  backend verifies those by fetching `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, but **`SUPABASE_URL`
  was unset** in `backend/.env`, so `verify_supabase_jwt` couldn't build the JWKS URL and rejected every
  token with `401 "Invalid token"`. Proven live: real ES256 token → `/auth/me` → **401** without the var.
- **Fix:** added `SUPABASE_URL=https://tbfvjowsqfvtljfmvzij.supabase.co` to `backend/.env`. Re-tested the
  **same token** → `/auth/me` → **200** (user provisioned into the local `users` table via
  `get_or_create_supabase_user`). Then ran the whole authed surface in real Supabase mode with that token:
  **upload 200 → process WS `ready` → chat WS** returned a correct grounded answer. This exercises **both**
  auth paths — `get_current_user` (HTTP) and `resolve_ws_user` (WebSocket) — so OAuth users, which take the
  identical verify+provision path, will work.
- **Docs:** `backend/.env.example` — rewrote the Supabase section to state that **`SUPABASE_URL` is REQUIRED**
  for asymmetric (ES256/RS256) projects (the current default) or all tokens are rejected. **⚠️ Gautham must
  add `SUPABASE_URL` to his own `backend/.env`** (per-machine, git-ignored) or he'll hit the same 401 wall.
- Note: `ALLOWED_ORIGINS` already includes `5173/5174/3000`. The earlier **FIND-1** (legacy `/auth/*`
  endpoints mint legacy tokens the backend rejects in Supabase mode) is **not a blocker for OAuth** — in
  Supabase mode the frontend uses `SupabaseAuthProvider` exclusively and never calls those endpoints. Left
  as-is per your call.

**Pending / next (Supabase + provider dashboards — config only, cannot be done from code):**
1. **Supabase → Authentication → URL Configuration:** set **Site URL** + add **Redirect URLs**
   (`http://localhost:5173`, `http://localhost:5174` if used, and the prod domain).
2. **Supabase → Authentication → Providers:** enable **Google**, **Azure** (Microsoft), and
   **LinkedIn (OIDC)**, pasting a Client ID/Secret created in each provider console (Google Cloud;
   Azure App registrations; LinkedIn Developers with the *Sign In with LinkedIn using OpenID Connect*
   product). Register `https://tbfvjowsqfvtljfmvzij.supabase.co/auth/v1/callback` as the redirect in each.
3. **Live verify** each button: consent screen → redirected back **signed in** (not guest); confirm the
   `users` row is created and `/auth/me` returns the provider email. Backend readiness is already proven;
   only the provider enablement remains.

### 2026-07-06 — Added a self-hosted SEO blog at /blog (Astro static site)
**Done:**
- Built a standalone **Astro** static blog in a new top-level **`blog/`** folder, served at
  **`https://talktofile.ai/blog`**, to publish SEO articles (replacing the pricey getautoseo.com;
  articles are drafted in SEOwriting.ai, exported as Markdown, and dropped in here). The React app
  in `frontend/` is untouched.
- **Stack:** Astro 5 + `@astrojs/mdx` + `@astrojs/sitemap`, static output. `astro.config.mjs` sets
  `site: 'https://talktofile.ai'` (non-www apex — Caddy redirects www→apex, so canonicals must be
  apex) and `base: '/blog'`. Articles are Markdown files in `blog/src/content/posts/` validated by a
  content-collection schema (`blog/src/content.config.ts`): `title, description, pubDate,
  updatedDate?, keyword?, draft, heroImage?, faq?`.
- **Pages:** `src/pages/index.astro` (post list) + `src/pages/[...slug].astro` (article template).
  Shared `src/layouts/BaseLayout.astro` emits full SEO: `<title>`, meta description, canonical,
  Open Graph + Twitter cards, and **JSON-LD** (Article + BreadcrumbList, plus **FAQPage** when a post
  declares `faq:`). Sitemap at `/blog/sitemap-index.xml`, `robots.txt` at `/blog/robots.txt`. Brand
  match: #E2611B accent, Inter/Plus Jakarta/Merriweather fonts, `mark-color.svg` logo (copied into
  `blog/public/`), orange CTA box → talktofile.ai on every article.
- **Seeded** with the first real post: `blog/src/content/posts/how-to-chat-with-a-pdf-for-free.md`
  (the SEOwriting.ai PDF article, cleaned + FAQ added).
- **Production wiring (Docker/Caddy):**
  - `frontend/Dockerfile` now has a second `blog-builder` stage (Astro build) and copies
    `blog/dist` → **`/srv/blog`** in the Caddy image. Because the blog is outside `frontend/`, the
    `web` service build **context moved to the repo root** (`docker-compose.yml`: `context: .`,
    `dockerfile: frontend/Dockerfile`); all Dockerfile COPYs are now `frontend/…`/`blog/…`-prefixed.
  - New **root `.dockerignore`** (keeps the now-root build context lean; re-includes `blog/**/*.md`).
  - `frontend/Caddyfile`: new **`handle /blog*`** block (before the SPA catch-all) roots at `/srv`,
    serves `/blog/*` statically with `try_files {path} {path}/index.html`, immutable cache on
    `/blog/_astro/*`, no-cache on blog HTML.
  - `.gitignore`: added `blog/node_modules/`, `blog/dist/`, `blog/.astro/`.
- **Verified:** `npm install` + `npm run build` succeed; built HTML has correct `/blog`-prefixed
  asset links, non-www canonical/og:url, all JSON-LD types (Article/Breadcrumb/FAQPage×5), and a
  2-URL sitemap. `astro preview` serves `/blog/`, the article, and the logo all 200. Playwright
  screenshots (index + article) confirm the design is clean, on-brand, responsive.
- **How to add an article** (see `blog/README.md`): create a `.md` in `posts/`, fill the frontmatter
  (title/description/pubDate/keyword, optional `faq:`), paste the Markdown body, rebuild+redeploy.

**Pending / next (only things that can't be done from code):**
- **Deploy:** on the server `git pull && docker compose build web && docker compose up -d web`, then
  confirm `https://talktofile.ai/blog/` and `.../blog/how-to-chat-with-a-pdf-for-free/` load, plus
  `/blog/sitemap-index.xml` and `/blog/robots.txt`. (First Docker build now also installs Astro, so
  it's a bit slower.)
- **Google Search Console:** verify `talktofile.ai`, submit `https://talktofile.ai/blog/sitemap-index.xml`,
  then **Request Indexing** for the first article. Watch impressions over 1–3 weeks — this is the
  proof-of-concept signal before bulk-publishing the rest.
- Ideally add a reference to the blog sitemap from the **root** `robots.txt` too (the React app
  doesn't serve one today; optional — GSC submission covers it).

### 2026-07-04 — Added LinkedIn to social sign-in (Google / Microsoft / LinkedIn)
**Done:**
- Added **LinkedIn** as a third social sign-in button alongside the existing Google + Microsoft.
  Uses Supabase's **`linkedin_oidc`** provider (the current OIDC integration; the legacy `linkedin`
  provider is deprecated). It returns `openid profile email` by default, so — unlike Azure — no
  explicit `scopes` are needed; the generic `signInWithProvider` path handles it unchanged.
- **`context/AuthContext.tsx`:** extended `OAuthProvider` to `'google' | 'azure' | 'linkedin_oidc'`.
- **`components/AuthModal.tsx`:** new `LinkedInIcon` (blue `#0A66C2` rounded square + white "in") and a
  `{ name: 'LinkedIn', provider: 'linkedin_oidc', Icon: LinkedInIcon }` entry in `SOCIAL_PROVIDERS`.
  Button label / loading spinner / disabled handling all come from the existing `.map` render — no
  other wiring. Backend needs nothing (any Supabase OAuth user is provisioned into `users` on first
  API call, keyed by `supabase_user_id`).
- **Docs:** `SUPABASE_SETUP.md` §6 retitled Google/Microsoft/LinkedIn; added the LinkedIn row to the
  provider table + a note (must add the **Sign In with LinkedIn using OpenID Connect** product in the
  LinkedIn app; old r_liteprofile/r_emailaddress scopes no longer apply).
- Type-check (`tsc --noEmit`) passes.

**Pending / next (config only — cannot be done in code):**
- **The app is currently in legacy mode** (the buttons are hidden), so LinkedIn is not yet exercisable.
  To turn it on: set `VITE_SUPABASE_*` + backend `SUPABASE_JWT_SECRET` (SUPABASE_SETUP.md steps 1–5),
  then in Supabase → Authentication → Providers enable **LinkedIn (OIDC)** with a Client ID/Secret from
  a LinkedIn Developers app that has the OpenID Connect product added, registering
  `https://<ref>.supabase.co/auth/v1/callback` as the redirect.
- **Live verify** once configured: click **Continue with LinkedIn account** → LinkedIn consent →
  redirected back signed in; confirm the local `users` row is created and `/auth/me` returns the
  LinkedIn email. **Visual check** of the button (light/dark, 320–1280px) not done.

### 2026-07-02 — Optional proxy for YouTube transcript fetches (production IP-ban workaround)
**Done:**
- YouTube blocks transcript requests from datacenter/cloud IPs, so YouTube URL ingestion fails on a
  deployed VM/container. Added **optional proxy support** so it's ready for production.
- **Config** (`core/config.py`): new `youtube_proxy` setting (env `YOUTUBE_PROXY`, default empty) +
  `youtube_proxy_enabled` property. Empty = go direct (fine on local/residential IPs).
- **Wiring** (`routers/document.py`): new `_build_youtube_api()` builds `YouTubeTranscriptApi`, and
  when `YOUTUBE_PROXY` is set, routes it through `GenericProxyConfig(http_url=…, https_url=…)` (1.x
  proxy API). `_fetch_youtube_transcript` now goes through it. Proxy dep is import-local (only loaded
  when a proxy is configured).
- **Docs** (`.env.example`): documented `YOUTUBE_PROXY=http://user:pass@host:port`, noting a rotating
  **residential** proxy (e.g. Webshare) is the reliable option (datacenter proxies are often blocked too).
- Verified both paths build cleanly (direct + proxy-enabled); backend imports OK, reloaded live.

**Pending / next:**
- Set a real `YOUTUBE_PROXY` in the prod `.env` when deploying (local dev needs nothing). The single
  generic-URL case is covered; if per-request rotation or Webshare-specific config is wanted later,
  extend `_build_youtube_api` to also accept `WebshareProxyConfig`.
- `.fetch()` is still a blocking call inside an async handler (pre-existing) — fine at current scale.

### 2026-07-02 — Stop leaking raw backend errors to the client (YouTube + transcribe)
**Done:**
- A failed YouTube URL ingest was dumping the **raw `youtube-transcript-api` exception** (a huge
  IP-ban/proxy explanation) straight into the browser via
  `detail=f"Could not fetch YouTube transcript: {exc}"` (`routers/document.py`). Now the full detail
  is **logged server-side** (`logging.getLogger("talktofile.document")`, `exc_info=True`) and the
  client gets a clean message: a specific-but-generic one for the IP-block case (exception name
  contains `IpBlocked`/`RequestBlocked` → "try again later, or upload the file directly") and a plain
  "An unexpected error occurred…" for anything else. Status now 502.
- Same leak fixed in `routers/tools.py` `/transcribe` (`detail=f"Transcription failed: {e}"`) → logs
  detail, returns "An unexpected error occurred while transcribing your audio. Please try again."
- Left `document.py`'s webpage-fetch error as-is — it only interpolates an HTTP status **number**, no
  raw exception text.
- **Note:** the underlying YouTube failure is environmental (YouTube IP-blocks server/cloud IPs) and
  can't be fixed in code — production needs a proxy (see the library's "Working around IP bans"). This
  change only makes the *error handling* clean. Backend imports OK; reloaded live.

### 2026-07-02 — Real social sign-in (Google / Apple / Microsoft) via Supabase OAuth
**Done:**
- The three social buttons in `AuthModal` were **stubs** (`handleSocial` faked a success toast —
  no real OAuth). Wired them to **Supabase OAuth** for real (the app already has full Supabase auth,
  incl. the `onAuthStateChange` listener that auto-hydrates a session after the OAuth redirect).
- **Frontend:** new `signInWithProvider(provider)` on the auth context (`context/AuthContext.tsx`) +
  exported `OAuthProvider` type (`'google' | 'apple' | 'azure'` — **Microsoft = `azure`** in Supabase).
  Supabase impl calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: origin, ... }})`
  (requests `email openid profile` for azure so the email claim returns); legacy impl throws a clear
  "not available on this deployment" error. `AuthModal` now maps each button to its provider id, shows
  a per-provider `Loader2` spinner + disables during redirect, surfaces errors, and **only renders the
  social section when `SUPABASE_ENABLED`** (no dead buttons in legacy mode). Removed the fake success.
- **Backend:** no changes needed — `get_or_create_supabase_user` (`core/auth.py`) already provisions
  any Supabase user (any provider) into the local `users` row keyed by `supabase_user_id`, syncing
  email. OAuth users flow through identically to email users.
- **Docs:** added a "Social sign-in" section to `SUPABASE_SETUP.md` (dashboard URL config + a
  per-provider table of where to create the OAuth app and which redirect URI to register).
- Type-check passes.

**Pending / next (config only — cannot be done in code):**
- The app is currently in **legacy mode** (no Supabase env vars), so the buttons are hidden. To turn
  social sign-in on: (1) set `VITE_SUPABASE_*` + backend `SUPABASE_JWT_SECRET` (SUPABASE_SETUP.md
  steps 1–5), (2) enable Google/Apple/Microsoft in the Supabase dashboard with OAuth client IDs/secrets
  created in Google Cloud / Apple Developer / Azure (step 6). Google + Microsoft are quick; **Apple**
  needs a paid Apple Developer account (Services ID + key).
- **Live verify** once configured: click each button → provider consent → redirected back signed in;
  confirm the local `users` row is created and `/auth/me` returns the provider email.

### 2026-07-02 — Post-merge check of Gautham's PR #6 (dark mode + chat interface)
**Done:**
- Pulled `origin/main` (PR #6: dark mode, `ThemeContext`/`ThemeToggle`, new citation system
  `CitationMarker`/`lib/citations.ts`, chat-box rewrite) into local `main` and verified the blend.
- **Checks pass:** frontend `tsc --noEmit` clean, backend `import main` OK, **no conflict markers**
  anywhere. Confirmed my features survived the rewrite: `MicButton` still wired in `ChatWindow` +
  `Landing`, `ChatWindow` `initialPrompt` auto-send intact, `ThemeProvider` mounted in `main.tsx`,
  and the `remove-file` / `transcribe` / `auth/refresh` endpoints all still present.
- **One real integration bug found + fixed (per-machine venv):** the PR bumped
  `youtube-transcript-api` 0.6.3 → **1.2.4** and rewrote `_fetch_youtube_transcript` to the 1.x
  instance API (`YouTubeTranscriptApi().fetch(...).to_raw_data()`). My local venv still had 0.6.3
  (no `.fetch`), so **YouTube URL ingestion would have crashed at call time** (import still passed).
  Ran `pip install youtube-transcript-api==1.2.4` into `backend/venv`; verified `.fetch` now exists
  and `import main` still OK. **Gautham must do the same `pip install -r requirements.txt` on his box.**

**Pending / next:**
- **Visual verification of dark mode not done** — needs the dev server + browser: check brand orange
  reads in dark theme across Landing/Navbar/ChatWindow, the `ThemeToggle`, and 320–1280px.

### 2026-07-03 (latest) — Blank "Preferences" box added below the follow-up box
**Done:**
- Added a second placeholder header, **"Preferences"** (`SlidersHorizontal` icon), to the tool
  sections in **`SectionComposer.tsx`**, directly **below the follow-up box and above the input**.
  Same gate (`active !== 'chat' && engaged.has(active)`), same blank label-only treatment, and the
  same **"Coming soon"** tooltip (right side). Intended to eventually render each user-entered
  preference as its own box (like a follow-up suggestion); blank for now. Type-check passes.

**Pending / next:**
- **Populate Preferences** (and Follow-up suggestions) with per-item boxes when that data exists.
- **Visual verification not done** — confirm the two stacked headers (Follow-up suggestions →
  Preferences → input) appear only after first Generate, tooltips open right un-clipped (light/dark).

### 2026-07-03 — Blank "Follow-up suggestions" box added to the tool sections
**Done:**
- Every **tool section** (Summary/Flashcards/Slides/Translate/Podcast/Charts) now shows a
  **"Follow-up suggestions"** header (the `Sparkles` + label, matching the chat's box) above the
  input — but **only after that section has been used at least once**, and **blank for now** (no
  suggestion buttons yet). Requested to mirror the chat's follow-up box across the other sections.
- Implemented entirely in **`SectionComposer.tsx`** (the shared bottom composer). Gated on
  `active !== 'chat' && engaged.has(active)`: the existing **`engaged` set** already tracks
  "produced content in this section at least once" (fires via each view's `onActivity` →
  `markEngaged`), so e.g. the box appears the moment the user first clicks **Generate summary** and
  stays for the session; before that it's hidden. **Chat is excluded** because it renders its own
  **populated** follow-ups in `ChatWindow` (this would double it up).
- Placed **above** the optional `pickerRow` (Charts type picker / Translate language picker), so
  those sections show follow-up header → picker → input → tabs. Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Populate the suggestions** — the box is intentionally empty; when per-section follow-up
  questions exist, render suggestion buttons under the header (see the chat's grid in
  `ChatWindow.tsx` ~L717 for the pattern).
- **Visual verification not done** — confirm each tool section: no box until first Generate, then a
  blank "Follow-up suggestions" header appears (light/dark, 320–1280px); chat's own box unchanged.

### 2026-07-03 — Unified the bottom composer into one shared `SectionComposer`
**Done:**
- **Every section (chat + the six tool views) now renders the same `SectionComposer`**, so the input
  row is pixel-identical everywhere. This replaces the six near-identical per-section copies (and the
  chat's own slightly-different copy) that had drifted apart — the user reported the chatbox size/
  position differing across sections and the mic/proceed button not sitting on the input's row.
- **New `src/components/SectionComposer.tsx`** owns the shared markup + boilerplate: the textarea
  (auto-grow, min 44 / **max 120px** everywhere — chat was 140), the live `MicButton`, the proceed
  button slot, the `↵ send` hint slot, the "Coming soon" bubble, and the `ModeSwitcher` tabs. **The
  only per-section differences are props:** `proceedButton` (chat's send/stop vs each tool's
  `Generate …`/`Translate …` button — also what drives the chatbox width), `placeholder`, and an
  optional `pickerRow` above the input (Charts chart-type picker, Translate language picker).
- **Two input modes:** chat passes `value`/`onChange`/`onSubmit`/`disabled`/`showEnterHint`/`inputRef`
  (send-on-Enter, `↵ send` hint, connection-gated disable, keeps its focus-after-send via the shared
  ref); the tool views pass none of those, so the composer owns its own input state and Enter shows the
  **"Coming soon"** bubble (`TODO(coming-soon)` unchanged — cross-section chat still isn't wired).
- **Chat now matches the tools** (per the user's choice): normalised its textarea to `min-w-0` + max
  120px; it keeps its send/stop button and `↵ send` hint (those are the intended differences). Removed
  chat's own auto-grow effect / `appendTranscript` / keydown handler (the composer owns them now).
- Wired all seven: `ChatWindow`, `SummaryView`, `FlashcardsView`, `PodcastView`, `SlidesView`,
  `ChartsView`, `TranslateView` — each deleted its duplicated input/mic/coming-soon boilerplate and now
  renders `<SectionComposer …>`. Charts/Translate pass their picker via `pickerRow`; Slides keeps its
  Pro-gate tooltip on `proceedButton`. `WorkspaceComposer.tsx` was already unused and is now fully
  superseded (safe to delete).
- **Follow-up polish (verified live with the user):**
  - **Row alignment:** the input row is `items-center` (was `items-end`) so the mic + proceed button
    sit level with the textarea instead of a few px low.
  - **Textarea height:** `py-2.5` + `leading-normal` so the collapsed single-line height matches the
    44px mic/button.
  - **Removed the send/stop button `shadow-sm`** (chat only had it; the tool buttons never did) — no
    section's composer casts a shadow now.
  - **Hid the textarea scrollbar** (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`). The
    auto-grow already fits the box to content, so the thin scrollbar on the right edge (the "white
    mark" the user saw in dark mode) was just noise.
- **Dev-server gotcha that cost time this session:** the user's browser showed a stale layout across
  several edits even after a hard refresh + a fresh browser, while `curl http://localhost:5173/src/
  components/SectionComposer.tsx` proved Vite was serving the new code. A temporary on-screen `DEBUG
  v3` banner + a mount `console.log` confirmed the browser *was* finally loading the live build (the
  earlier staleness was a dead HMR socket / cached tab). Both debug markers have been removed. **If a
  change "isn't applying," curl the module straight from Vite to isolate server vs. browser before
  chasing the code.**
- Type-check (`tsc --noEmit`) passes; verified visually with the user (light + dark).

### 2026-07-03 — Summary: no longer auto-shown; "Generate summary" button + own bottom bar
**Done:**
- **Summary is no longer displayed automatically.** `SummaryView.tsx` now starts on an empty-state hero
  and only reveals the summary when the user clicks **"Generate summary"** — matching Flashcards/Podcast/
  Slides/Charts. The button lives in the section's **own pinned bottom bar** (chat textbox + mic for
  parity, wide generate button in the send-button spot, `ModeSwitcher` tabs); once revealed it reads
  "Regenerate summary".
- **Important nuance:** the summary is still **produced by the upload pipeline** (analyst agent) and lives
  on `session.documents[i].summary` — there is **no backend regenerate endpoint**. So `generate` here
  **reveals the precomputed summary** after a brief (~500ms) "Summarising…" beat for parity; it does not
  re-run anything server-side. Added a "No summary available for this file." fallback. If a real on-demand
  (re)summarise is wanted, add a backend `/tools/summary/{id}` endpoint + `toolsApi.summary` and call it
  from `generate`.
- **`onActivity` star now fires on generate** (was: on mount), so Summary only earns its "pick up where you
  left off" star once the user has revealed it — consistent with the other sections.
- Props switched to `onSwitchMode` + `engagedModes`. **All six tool sections now render their own bottom
  bar**, so the shared **`WorkspaceComposer` is no longer used** — removed its render + import from
  `App.tsx` (the `WorkspaceComposer.tsx` file is left in place, now unused, as a reference composer).
  The **left-panel "Overview" card and the WorkspaceHeader "View summaries"/Share/Export still read
  `doc.summary` directly** and are unaffected (they still show/act on the precomputed summary).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — check Summary (single + multi-file, light/dark, 320–1280px): empty
  hero → click Generate → brief spinner → summary cards appear; button flips to "Regenerate summary".
- Consider whether the left-panel Overview showing the summary while the Summary tab is button-gated is
  the desired behaviour (slight inconsistency, out of scope here).

### 2026-07-03 — Flashcards too: generate button moved into a Translate-style bottom bar
**Done:**
- Extended the same-day change below to **Flashcards**: the **"Generate flashcards"** button moved out of
  the centered empty-state hero into a **pinned bottom bar `FlashcardsView.tsx` now renders itself**
  (chat textbox + mic for parity, the wide generate button in the send-button spot, `ModeSwitcher` tabs),
  matching Translate/Podcast/Slides/Charts. The button runs the real generation (says "Regenerate
  flashcards" once a set exists). The cards state (fixed progress header + scrollable card list +
  completion panel) now lives in the scroll region above the bar. Props switched to
  `onSwitchMode` + `engagedModes`; **`App.tsx`** passes them and **added `flashcards`** to the set of
  modes for which the shared `WorkspaceComposer` is hidden. **Summary is now the only section still on
  the shared `WorkspaceComposer`.** Type-check (`tsc --noEmit`) passes.

### 2026-07-03 — Podcast/Slides/Charts: generate button moved into a Translate-style bottom bar
**Done:**
- Moved the primary action button of **Podcast** ("Generate podcast script"), **Slides** ("Generate
  slides") and **Charts** ("Generate `<Type>` Chart") out of the centered empty-state hero and into a
  **pinned bottom bar each view now renders itself**, exactly where Translate's "Translate to `<lang>`"
  button sits (the send-button spot). The button **still runs the real generation** (not "Coming soon").
- Each of `PodcastView.tsx`, `SlidesView.tsx`, `ChartsView.tsx` was restructured to
  `flex flex-col h-full overflow-hidden`: a scrollable content region on top (the hero/description,
  results, chart, dialogue, etc.) and a `flex-shrink-0` bottom bar mirroring `TranslateView`'s — the
  chat textbox + live `MicButton` (parity; sending still shows the **"Coming soon"** bubble,
  `TODO(coming-soon)`), the wide **brand-orange generate button** in place of send, and the
  `ModeSwitcher` tabs. **Charts** additionally puts its **chart-type picker** in the bottom bar (pills,
  in the slot Translate uses for its language picker); its old in-content chart-type switcher +
  "Change chart" button were removed as redundant. **Slides** keeps its Pro gate: for non-Pro the
  content shows the upgrade message and the bottom-bar generate button is **disabled with a "Pro only"
  tooltip**.
- **Props change:** these three views now take `onSwitchMode` + `engagedModes` (like Translate) instead
  of `onStartChat`, so they render their own tabs; the in-view "Chat" buttons now call
  `onSwitchMode('chat')`. **`App.tsx`** passes those props and **hides the shared `WorkspaceComposer`**
  for `translate | podcast | slides | charts` (the condition was generalised from translate-only).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — run the dev server and check each section (light/dark, 320–1280px):
  the generate button sits in the same spot as Translate's, actually generates, the textbox shrinks as
  the button widens, Charts' type pills wrap cleanly and drive the button label, Slides shows the
  "Pro only" tooltip for free users, and the tabs still switch sections.

### 2026-07-02 — Translate: typed custom language gated off ("Coming soon")
**Done:**
- The Translate section's **"Or type any language…"** input is now non-functional on purpose: the
  backend doesn't validate arbitrary typed languages yet, so running one could request a nonexistent
  language. In `TranslateView.tsx`, when the user has typed a custom language (`isCustomLang =
  customLang.trim().length > 0`):
  - the **"Translate to `<language>`" button is disabled** (`disabled-cursor-not-allowed`) and
    wrapped in the shared `Tooltip` showing **"Coming soon"** on hover (`side="top"`); picking one
    of the `LANGUAGES` pills clears `customLang`, so the button re-enables.
  - `handleTranslate` **early-returns** if `isCustomLang`, so clicking never advances to a result.
- Only when a **preset pill** is selected does translation run. Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Backend still needs to validate the target language** before the typed input can be re-enabled
  (remove the `isCustomLang` gate + `handleTranslate` guard when that lands).
- **Visual verification not done** — type a language → button greys out + "Coming soon" tooltip on
  hover, click does nothing; pick a pill → button re-enables and translates (light/dark, 320–1280px).

### 2026-07-02 — Original-document panel: tooltip, click-to-toggle, header icon across all sections
**Done:**
- **Sidebar filename now toggles** the original-document panel (click to show, click again to hide),
  and carries a shared `Tooltip` (`side="bottom"`): *"Click here to see the original document"* →
  flips to *"…hide the original document"* while open (`App.tsx`).
- **Added a `ScrollText` toggle icon to the header row** (next to the sidebar-collapse toggle), in
  **both** `ChatWindow` (chat) and `WorkspaceHeader` (summary/flashcards/slides/translate/podcast/
  charts) — so the original document is reachable from **every** section, not just via the sidebar.
  It highlights brand-orange while the panel is open; `title` flips *See/Hide the original document*.
- **Wiring:** `App.tsx` owns the toggle — `toggleDocPanel()` closes the panel if any doc is open, else
  opens the **active-overview** document (`activeDocName`, first file when single). New props
  `docPanelOpen` + `onToggleDocPanel` threaded into `ChatWindow` and `WorkspaceHeader`.
- **Smoother open/close animation.** The panel now animates its **width** (not an `x`-slide), so the
  chat reflows gracefully as it opens *and* closes instead of snapping back when the old slide-out
  unmounted. Fixed-width content is anchored left inside an `overflow-hidden` shell (clean reveal, no
  squish); slow easeOutQuint ease (`[0.22,1,0.36,1]`, ~0.45s) + a subtle content fade/slide and a
  soft right-edge shadow. See `DocumentPanel.tsx`.
- Type-check (`tsc --noEmit`) passes. No backend change (uses the existing `/content` route).

**Pending / next:**
- **Visual verification not done** — confirm the sidebar tooltip + toggle, the width-reveal
  open/close feels smooth (chat reflows, no snap), and that the header `ScrollText` icon opens/closes
  the panel from chat and each tool section (light/dark, its active state highlights). On mobile the
  header icon is the only way in (sidebar is `lg+`).

### 2026-07-02 — Translate section: controls moved into its own bottom bar
**Done:**
- Reworked the **Translate** section so its language controls live in a **bottom bar it renders
  itself** (results scroll above, controls pinned below), instead of a picker card in the scroll area
  + the shared `WorkspaceComposer`. Per the user's choice, this is **translate-only**: `App.tsx` now
  **hides `WorkspaceComposer` when `viewMode === 'translate'`** and passes `TranslateView`
  `onSwitchMode` + `engagedModes` (it renders its own `ModeSwitcher` tabs). `onStartChat` prop dropped.
- **`TranslateView.tsx`** restructured (`flex flex-col h-full`; scroll region + `flex-shrink-0` bar):
  - **Removed the inner "Translate" heading** (Globe + `<h2>`) — redundant with the `WorkspaceHeader`
    title. Kept the amber image-only note + the results list.
  - Bottom bar: a **"Translate to"** picker replaces the composer's "Follow-up suggestions" row —
    label, then language pills with the **"Or type any language…" input inline to their right** (2
    lines, no separate row for the custom input). The **wide "Translate to `<language>`" button**
    replaces the send button; the chat textbox is kept but **smaller** (`flex-1 min-w-0`, so the wider
    button squeezes it) with the live mic. Sending still shows the **"Coming soon"** bubble
    (`TODO(coming-soon)` — chatting from tool sections isn't wired yet).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — run the dev server and check the Translate bar (light/dark,
  320–1280px): pills + custom input wrap cleanly to ~2 lines, the "Translate to X" button label
  updates with the selection, the textbox shrinks as the button widens, translation still runs +
  results render, and the tabs still switch sections. Confirm the other five sections still show the
  normal shared composer.

### 2026-07-02 — Left panel: filename is now a clickable link that opens the full original document
**Done:**
- **Removed the "DOCUMENT" heading + mode badge** from the left panel's first card (`App.tsx`). The
  card now just lists the file(s); each **filename is rendered in brand orange as a clickable button**
  (hover underline) instead of plain slate text.
- **Clicking a filename opens the full original document** in a slide-in panel (`DocumentPanel`,
  new) — the sidebar analogue of the citation "Jump to source" panel, but showing the **whole**
  extracted text rather than one passage. Slides in from the left over a dim backdrop; tap the
  backdrop or the X to close. Fetches lazily on open (loading spinner → text; brand-orange error if
  the session expired).
- **New backend endpoint** `GET /document/{session_id}/content?filename=…` (`routers/document.py`)
  returns `{ filename, content }` from the in-memory session's `DocumentData.raw_text` (auth-scoped;
  404 if the file isn't in the session). For a URL/YouTube source this is the fetched page text /
  transcript. Nothing is written to disk — served straight from memory.
- **Frontend wiring:** `documentApi.getContent(sessionId, filename)` (`api/client.ts`); `App.tsx`
  gains `openDoc` state (reset on `handleReset`/`enterWorkspace`) and renders `<DocumentPanel>` via
  `AnimatePresence` inside the workspace. Removed the now-dead `modeBadge` (+ its `GitCompare`/`Files`
  imports).
- Type-check (`tsc --noEmit`) passes; backend `import main` OK.

**Pending / next:**
- **⚠️ Restart the backend** so the new `/content` route registers (the `--reload` gotcha — a stale
  uvicorn returns 404). Quick check:
  `curl -s "http://localhost:9099/api/document/x/content?filename=y" -o /dev/null -w "%{http_code}"`
  → 401/403 = live, 404 = restart.
- **Visual verification not done** — click a filename in the left panel (single + multi-file, light/
  dark), confirm the panel slides in with the full text, scrolls, closes via backdrop/X, and that a
  long transcript renders readably. Left panel is `lg+` only.

### 2026-07-02 — Left document panel: "Overview" heading + switchable per-file overview
**Done:**
- Renamed the **left document panel's summary card heading from "Summary" to "Overview"** (the
  single-file case in `App.tsx`). Only that left-column heading changed; the **Summary feature tab,
  the main-section header, and the chat are all untouched** (still read "Summary").
- Made the left-panel **overview switchable when there's more than one file.** Previously it stacked
  one overview card per document; now it renders a **single card with a button row (one pill per file,
  labelled with the filename + a `FileText` icon)** that swaps which file's overview `SummaryCard` is
  shown. The **button row only renders when `documents.length > 1`** (single-file view is unchanged —
  no buttons, heading "Overview"). New `activeOverview` index state in `AppShell`, clamped via
  `Math.min(activeOverview, docs.length - 1)` so it stays valid if a file is removed; active pill is
  brand-orange (matches `ModeSwitcher`). Falls back to "No overview available for this file." if the
  selected doc has no summary.
- (Discarded earlier this session, per user correction: a first pass renamed the *main-section* header
  via `WorkspaceHeader` and put the switcher in `SummaryView` — both **reverted**. The rename + switch
  belong to the **left column** only.)
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — with 2+ files (Pro), confirm the left-panel pills appear, swap the
  shown overview, truncate long filenames (they have `max-w-full` + `truncate` + a `title` tooltip),
  and wrap cleanly in the narrow `w-72`/`xl:w-80` panel (light/dark). Single-file: no pills, heading
  reads "Overview". Left panel is `lg+` only.

### 2026-07-02 — Header "Add files/URLs": right-aligned URL box, then made it "Coming soon"
**Done:**
- The mid-session **Add files / Add URLs** control (the `+` menu in the chat header **and** the
  shared `WorkspaceHeader` for summary/flashcards/etc.) was confirmed to be **frontend-only** —
  added sources were never uploaded/merged (no backend add-to-session endpoint exists; only
  `remove-file`). Two-phase change per the user:
  - **Phase 1 — URL box alignment.** Made the whole right-hand **button group** the positioning
    context (`relative` on the `flex items-center gap-2` group; removed `relative` from the inner
    `+` wrapper) so the dropdown's `right-0` edge coincides exactly with the **End session** button's
    right edge (End session is the group's last child). The URL-input popover widens to `w-80` while
    adding a URL (`w-64` for the plain menu). Robust across breakpoints (no hardcoded px offset that
    would drift when the "End session" label hides below `sm`). **Side effect (accepted by user):**
    the plain Add-files/URLs menu now also anchors flush-right under End session, not under the `+`.
  - **Phase 2 — non-functional "Coming soon".** `openAddFiles` / `startAddUrl` in both
    `ChatWindow.tsx` and `WorkspaceHeader.tsx` now just `setAddHint('Coming soon!')` — no file
    picker, no URL box (`addingUrl` stays false, so that branch + the source chips never render).
    The scaffold (URL input JSX, hidden file input, `onExtraFilesSelected`/`saveExtraUrl`/
    `removeExtra`, state) is **kept in place** for when a backend add-to-session endpoint lands —
    reverting the two handlers re-enables it. `tsconfig` has `noUnusedLocals:false`, so the now-dead
    handlers/refs don't break the build.
- **Incidental build fix:** `WorkspaceComposer.tsx` (untracked, from the earlier composer session)
  rendered `<Mic />` without importing it — `tsc` was failing repo-wide before this. Added `Mic` to
  its lucide import.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — confirm in a browser (chat + a tool section, light/dark,
  320–1280px): the plain menu + URL box right-edge sit on End session's right edge; clicking Add
  files / Add URLs shows the orange "Coming soon!" note and never opens a picker/URL box.
- The real feature still needs a **backend add-to-session endpoint** (extract→embed→append doc to
  the in-memory session, refresh suggested questions) before Phase-2 can be reverted to live wiring.

### 2026-07-02 — Mode-tab description tooltips: added then reverted (felt like over-information)
**Done:**
- Briefly added the Landing-page mode blurbs (Chat / Summary / Flashcards / …) as hover tooltips on
  the feature tabs in `ModeSwitcher.tsx`, shown only on tabs without the amber `*` star. **Reverted
  the same session** — the user felt the per-section descriptions were over-informative. `ModeSwitcher`
  is back to its prior state: **only the `*` (engaged-but-not-active) tabs show a tooltip** ("Click to
  pick up where you left off"); un-starred tabs have no tooltip. Type-check (`tsc --noEmit`) passes.

### 2026-07-02 — Summary section trimmed; non-chat sections get a chat-style composer
**Done:**
- **Trimmed the Summary section's redundant chrome** (`SummaryView.tsx`): removed the inner
  "Document Summary" title + Share + Start-chatting header (the shared `WorkspaceHeader` + Chat tab
  already cover these), the `doc_type` badge, the bottom "Chat with your document" button, and the
  "Want to explore further?" suggested-questions block. Also **fixed invisible-in-dark-mode headings**
  — Overview/Key Points/Topics `<h3>`s had conflicting `text-slate-800 text-brand-600` and no dark
  variant; now `text-slate-800 dark:text-slate-100`. `onStartChat` kept in `Props` (parent still
  passes it) but dropped from the destructure.
- **New `src/components/WorkspaceComposer.tsx`** — a self-contained copy of the chat's bottom area
  (Follow-up suggestions header + input + `ModeSwitcher` tabs) rendered at the bottom of every non-chat
  section, so they match the chat. **Chat is untouched.** `App.tsx` now renders `<WorkspaceComposer>`
  in the tool layer's footer (replaced the standalone `ModeSwitcher`; dropped that import).
  - **Follow-up suggestions list is intentionally blank for now.**
  - The **textarea, mic (real `MicButton` voice dictation), and send button are all live** — the
    only difference from chat is you can't send: clicking send (or pressing Enter) shows a
    **"Coming soon"** bubble above the button (sending isn't wired to a backend).
  - **⚠️ TODO when cross-section chatting is built:** wire `handleSend` in `WorkspaceComposer.tsx` to
    the real chat pipeline and **REMOVE the "Coming soon" bubble** (search `TODO(coming-soon)`).
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — check the composer matches the chat bottom (light/dark, 320–1280px)
  across each section; confirm typing works, send enables with text, "Coming soon" shows on send, and the
  blank follow-up header reads okay.

### 2026-07-02 — Charts/Podcast off-brand red → orange; error/warning boxes recoloured to brand
**Done:**
- **Fixed off-brand red used as a brand accent.** `ChartsView.tsx` (chart `PALETTE[0]` + all UI
  accents: loading spinner, empty-state icon, selected chart-type buttons, Generate button, header
  hover states) and `PodcastView.tsx` (Generate button, input focus border/ring, hover borders) were
  still using the old red `#E60026` instead of brand orange `#E2611B`. All swapped to `#E2611B`.
- **Error/warning message boxes recoloured red → brand orange** (user decision: warnings/errors →
  orange, destructive actions stay red). Converted the standalone error/warning *notice* boxes
  (`text-red-* bg-red-50 border-red-200` + dark variants → the `brand` scale) in: `ChartsView` (×2),
  `ChatWindow` (connection-lost toast + Retry), `SlidesView`, `TranslateView`, `PodcastView` (×2),
  `FlashcardsView`, `AuthModal` (×3), `ProfileModal`, `PersonaModal`, `FeedbackModal`, `UploadZone`
  (the error notice), and `Landing` (source-row error icon/text, hero error, URL error, error box).
- **Deliberately kept red** (semantic, not off-brand): destructive **delete/remove/close** hover
  states, required-field `*` asterisks, Flashcards **Hard** difficulty + **Wrong answer** button,
  message **downvote**. Two **functional state-distinction** cases also kept red because orange is
  already the adjacent state there: the **MicButton error** tint/bubble (recording state is already
  brand orange) and the **UploadZone drag-reject** border (valid-drag state is already brand orange) —
  recolouring these to orange would make the two states indistinguishable.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — sweep light/dark to confirm the recoloured error/warning boxes
  read as intended (brand-orange notices, not danger-red), and that charts/podcast accents are orange.
  Re-check the mic error + drag-reject still read as distinct red states.

### 2026-07-02 — Persistent tab sections + "pick up where you left off" stars
**Done:**
- **Every section now keeps its state across tab switches.** `App.tsx` mounts each **visited**
  tool view (`SummaryView`/`FlashcardsView`/…) and keeps it mounted (`hidden` when inactive), just
  like chat — so generated flashcards / podcast script / translation / chart survive hopping away
  and back. New `visited: Set<AppMode>` state (seeded on entry + grown by `switchMode`); the tool
  views render in a persistent `TOOL_MODES.filter(visited).map(...)` layer with the shared
  `WorkspaceHeader` + `ModeSwitcher` around them.
- **"Pick up where you left off" stars.** New `engaged: Set<AppMode>` tracks sections the user has
  **produced content in**; an engaged-but-not-active tab shows a filled amber `Star` + a `Tooltip`.
  Wiring: each view takes an optional `onActivity?()` → `markEngaged(mode)`. Chat fires it on send
  (`ChatWindow`, via an `onActivityRef` to avoid dep churn); Flashcards/Podcast/Translate/Charts fire
  after a successful generate; Slides after the PPTX downloads; **Summary fires on mount** (its
  content is produced by the upload pipeline, so it's present the moment you open it). `ModeSwitcher`
  gained an `engaged` prop and renders the star only for `engaged && !active` tabs.
- `ChatWindow` gained `engagedModes` + `onActivity` props and passes `engaged` to its own switcher.
  All tab clicks (chat switcher, tool switcher, tool views' "Start chatting") now go through
  `switchMode` so visited-tracking stays consistent.
- Type-check + `npm run build` both pass.

**Pending / next:**
- **Visual verification not done** — confirm: (1) generated content really survives Flashcards→Chat→
  Flashcards; (2) the star + tooltip render un-clipped at the bottom tab bar (light/dark, 320–1280px);
  (3) Summary starring on mere open feels right (it stars as soon as you leave it — flagged this to
  the user as a deliberate choice since its content is always present).
- Chat now opens a WebSocket even when the user lands directly in a non-chat section (chat is always
  mounted). Harmless, and desirable for instant tab-switching, but note the extra idle connection.

### 2026-07-02 — Feature tabs wired up: switch sections in-workspace; header shows section name
**Done:**
- **The in-chat feature switcher is now functional.** The pill row (Chat / Summary / Flashcards /
  Slides / Translate / Podcasts / Charts) switches `viewMode` via a new `onSwitchMode` callback
  threaded from `App.tsx` — clicking a tab opens that section on the **same live session**, exactly
  like picking it on the Landing page (no upload step). The active tab reads orange.
- **New `src/components/ModeSwitcher.tsx`** — the single source of truth for the tab set + labels.
  Exports `SWITCH_MODES`, `MODE_LABELS`, and the `<ModeSwitcher active onSwitch>` bar. Rendered at
  the **bottom of the chat** (inside `ChatWindow`) **and the bottom of every tool view** (in
  `App.tsx`, below the scroll area) so you can tab between sections from anywhere.
- **True browser-tab behaviour: chat state is preserved.** `App.tsx` now keeps `<ChatWindow>`
  **mounted but `hidden`** while on a tool view (instead of unmounting it), so the conversation,
  WebSocket and history survive when hopping to Summary/etc. and back. Guarded the landing-prompt
  auto-send with `selectedMode === 'chat'` so a prompt typed alongside a non-chat mode can't silently
  fire in the now-always-mounted background chat.
- **Header title = active section name.** The row under the navbar now shows **Chat / Summary /
  Flashcards / …** (`MODE_LABELS[mode]`) instead of the filename, in both `ChatWindow`'s inline header
  and `WorkspaceHeader` (new `mode` prop). The filename(s) stay reachable via the hover tooltip on
  that row and the left document panel.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Visual verification not done** — check the tab bar + new header title (light/dark, 320–1280px)
  across chat and each tool section, and confirm chat history survives a Chat→Summary→Chat round-trip.
- The tool views still have their **own inner headers** (e.g. SummaryView's "Document Summary" +
  Start chatting), so those sections still show a header row plus the shared bar — the "Start
  chatting" buttons are now redundant with the Chat tab and could be trimmed.

### 2026-07-02 — Shared WorkspaceHeader: chat's header row duplicated onto the other sections
**Done:**
- The chat header row (file icon + title, status line, **View summaries** drawer, **Share**, **Export**,
  **Add files/URLs**, **End session**) now appears **on top of every non-chat section** (summary,
  flashcards, slides, translate, podcast, charts). Chat is the untouched reference.
- **New `src/components/WorkspaceHeader.tsx`** — a self-contained *copy* of the chat header (not an
  extraction, so `ChatWindow` is unchanged). Duplicates all the row's properties + the summary drawer
  + the Add-files/URLs scaffold (Pro-gated, additive). Session-level adaptations for views with no
  chat transcript: **Share/Export operate on the document summary**, and the status shows a static
  green **"Ready"** (no chat WS in these views).
- **`App.tsx`** wiring: the main panel now renders `<ChatWindow>` as-is for `viewMode === 'chat'`, and
  for every other mode renders `<WorkspaceHeader>` above the (lazy) tool view in a scroll wrapper.
  New `endWorkspaceSession` (deletes the server session via `documentApi.deleteSession`, then
  `handleReset`) backs the header's End session; added the `documentApi` import.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- The tool views still have their **own inner headers** (e.g. SummaryView's "Document Summary" +
  Share + Start chatting), so those sections now show **two header rows**. Decide whether to trim the
  per-view headers now that the shared bar carries the session-level actions.
- These sections are only reachable by picking that mode on the **Landing page** (the in-chat
  feature-switcher buttons are still display-only). Wiring the switcher is still pending.
- Add-files chips remain a frontend scaffold (no backend add-to-session). **Visual verification not
  done** — check the shared header (light/dark, 320–1280px) above each section.

### 2026-07-02 — Chat header: replaced confusing "Upload new file(s)" with additive Add files/URLs
**Done:**
- **Removed the confusing `↻` "Upload new file(s)" reset button** from the `ChatWindow` header (it
  threw away the whole session — read as "add files" but actually *removed* the current file).
- **Replaced it with a `+` (Plus) icon button** that opens a small dropdown popover matching the
  home-page (Landing) add-more pattern: **"Add files"** and **"Add URLs"** rows (orange, Plus icons),
  a URL input when adding a link, and added-source chips with a remove (X). Click-away backdrop closes it.
- **Pro-gated & additive:** non-Pro users clicking either option get an inline upgrade hint (same as
  the Landing `isPro` gate); adding a source **never touches the current document** (chips prepend,
  newest on top). Session reset now lives only on **End session** (still calls `onReset`).
- **Frontend scaffold only (consistent with the Landing add-more, per CLAUDE.md):** added files/URLs
  show as chips but are **not yet uploaded or merged into the live session** — that needs a backend
  *add-to-session* endpoint (only `remove-file` exists today). Wiring it for real is the next step.
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Backend add-to-session endpoint** + wire the chat "Add files/URLs" (and the Landing scaffold) to
  actually ingest/merge/re-index the new sources. Until then the chips are display-only.
- **Visual verification not done** — check the `+` popover (light/dark, 320–1280px), the Pro gate
  hint for free users, and that adding a source leaves the current document intact.

### 2026-07-02 — Chat: feature-switcher buttons, input hint moved, Share chat button
**Done:**
- **Feature-switcher buttons in the chatbox (frontend only, display-only).** Added a centered,
  wrapping row of pill buttons below the chat input in `ChatWindow.tsx` — the same set as the
  Landing mode tabs (Chat / Summary / Flashcards / Slides / Translate / Podcasts / Charts), **labels
  only, no blurbs**. `SWITCH_MODES` const drives them; "Chat" reads as the active (orange) pill.
  **Clicking does nothing yet** — the switching functionality is deliberately deferred to a later
  step (will thread a `setViewMode` callback from `App.tsx`; open question then is whether to keep
  the live chat conversation mounted across switches, since `ChatWindow` currently unmounts when you
  leave chat).
- **Input hint moved into the placeholder.** Removed the "Answers drawn only from your document ·
  Shift+Enter for new line" caption under the input; the textarea placeholder is now
  "Ask anything about the document. Shift+Enter for a new line."
- **Share chat button** added to the chat header (top bar, next to Export/Restart/End session).
  Works the same way as the summary share: builds a plain-text transcript (`You:` / `Sage:` turns)
  with the standard `withAttribution` footer and calls `shareOrCopy` (native Web Share sheet →
  clipboard fallback). Shows an orange `Check` on success; disabled until there's a real exchange
  (same `< 2 messages` guard as Export).
- **Green → orange** on the summary share confirmation (`SummaryView` `Check` icon `text-green-600`
  → `text-[#E2611B]`), and the new chat share uses the same orange tick.
- **Share window theming — won't fix (out of our control).** The "share window" is the **native
  OS/browser share sheet** (`navigator.share`); its light/dark look follows Windows/the browser, not
  our app's dark-mode toggle, so it can't be themed from the frontend. Offered to build a custom
  in-app themed share dialog instead; **user chose to keep the native sheet as-is.**
- Type-check (`tsc --noEmit`) passes.

**Pending / next:**
- **Wire up the feature-switcher buttons** (next step): make them actually switch `viewMode`, and
  decide whether to preserve the in-flight chat conversation across switches.
- **Visual verification not done** — check the switcher row + new Share button at 320–1280px and in
  dark mode; confirm the transcript share copies/shares correctly.

### 2026-07-02 — Dark-mode fixes: autofill white flash + light-only error/warning boxes
**Done:**
- **Root cause of "textbox turned white when I picked a previously entered YouTube link":** browser
  **autofill**. Chromium paints its own light background on an autofilled field (`-webkit-autofill`)
  and ignores our Tailwind `dark:` classes, so the input flashed white in dark mode. Fixed in
  `index.css` with a global `input/textarea:-webkit-autofill` override (inset box-shadow forcing the
  field's own colour — white in light, `#0f172a` in dark — plus `-webkit-text-fill-color`/`caret-color`
  and the long-transition trick). Applies to every input site-wide.
- **Fixed error/warning boxes that had no `dark:` variant** (were light tint on the dark page):
  `Landing.tsx` (the URL/YouTube error box — the one the user hit), `ChatWindow.tsx` (connection-lost
  toast + Retry), `AuthModal.tsx` (login/reset error boxes ×3, the amber session-expired notice, the
  offer-signup error), `FeedbackModal.tsx`, `PersonaModal.tsx` (error + green "saved"),
  `ProfileModal.tsx` (error + green "saved"), `FlashcardsView.tsx` (difficulty badges + the
  wrong/right answer buttons), `MicButton.tsx` (error tint), `UploadZone.tsx` (drag-reject / drag-active
  / processing dropzone states + red error + amber dup-warning). All now use the standard dark tint
  pattern already used elsewhere: `dark:bg-<c>-500/10 dark:border-<c>-500/30 dark:text-<c>-400`.
- Type-check (`tsc --noEmit`) passes. Changes HMR into the running dev server.

**Pending / next:**
- **Visual verification not done** — sweep in a browser in dark mode: trigger a URL/YouTube upload
  error (light box gone), the modals' error/success states, flashcards buttons, and confirm picking a
  saved value from browser autofill no longer whitens the input. The Recharts panel in `ChartsView`
  stays intentionally light (documented earlier) — not a bug.

### 2026-07-01 — Chat header pinned; fixed workspace page-scroll bug
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
