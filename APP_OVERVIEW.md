# Talktofile — Complete Application Overview

> **For:** Marketing copy, investor pitch decks, sales one-pagers, and technical due diligence.
> **Last updated:** June 2026

---

## 1. What Is Talktofile?

Talktofile is a **private, AI-powered document intelligence platform**. A user uploads any file — or pastes a web link — and immediately has a conversation with it. The AI assistant, named **Sage**, answers questions, generates summaries, creates flashcards and podcast scripts, translates content, visualises spreadsheet data as charts, and more — all in real time, with every answer grounded strictly in the user's own document.

**The one-sentence pitch:**  
> *Upload a file. Ask anything. Get accurate, sourced answers — in seconds, with nothing stored.*

---

## 2. The Problem We Solve

Every knowledge worker drowns in documents. Contracts, reports, research papers, financial statements, lecture slides, medical records — the information is in the file, but getting to it takes hours of reading.

Existing tools fail in one or more of these ways:

| Problem | Who causes it |
|---|---|
| Stores your files on their servers | ChatPDF, Humata, AskYourPDF |
| Hallucinates — invents facts not in the document | All generic LLM wrappers |
| No multi-document analysis | Most "chat with PDF" tools |
| Requires an account, subscription, or data handoff | NotebookLM, ChatGPT upload |
| Too generic — not built for a document workflow | Claude / ChatGPT file upload |

Talktofile fixes all five at once.

---

## 3. How It Works — The User Journey

### Step 1 — Land and choose a mode

The homepage presents a clean upload card with **seven modes** the user can pick before uploading:

| Mode | What it does |
|---|---|
| **Chat** | Ask anything about the document in natural language |
| **Summary** | Generate a structured summary with key points and topics |
| **Flashcards** | Auto-generate Q&A flashcards for study or onboarding |
| **Slides** | Turn the document into a downloadable PowerPoint deck |
| **Translate** | Translate the full document into any of 20 supported languages |
| **Podcast** | Convert the document into a two-person HOST / EXPERT conversation script, extendable on demand |
| **Charts** | Turn Excel or CSV numerical data into bar, line, area, pie, or scatter charts |

No account is required to get started. A guest session is created automatically.

---

### Step 2 — Upload

The user drags-and-drops a file (or pastes a URL). Supported formats:

**Documents:** PDF · DOCX · PPTX · TXT · Markdown · HTML  
**Data:** XLSX · CSV · JSON  
**Web:** Any public webpage or YouTube video with captions  
**Code:** Python · JS/TS · Go · Rust · SQL · 30+ source formats  

**Plan limits (enforced client- and server-side):**

| | Free | Pro |
|---|---|---|
| Files per session | 1 | Up to 5 |
| Max file size | 5 MB | 8 MB each |
| Daily questions | 20 | 300 |
| Daily uploads | 5 | 50 |

A real-time progress bar streams three pipeline stages: **Extracting → Analysing → Ready**.

---

### Step 3 — The Agent Pipeline (what happens in the background)

Every uploaded document is processed by a five-agent orchestrated pipeline:

```
File bytes
    │
    ▼
┌─────────────────────────────────┐
│  ORCHESTRATOR                   │
│  Extracts text (dual-engine PDF,│
│  pdfplumber + PyMuPDF, docx,    │
│  xlsx, pptx, html, json, csv)   │
│  Guards: zip-bomb, scanned PDF  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  LINGUA AGENT                   │
│  Detects document language       │
│  (langdetect + GPT-4o fallback)  │
│  Translates to English if needed │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  ANALYST AGENT                  │
│  Chunks text · Embeds chunks     │
│  Builds FAISS vector index       │
│  Writes structured summary       │
│  Generates suggested questions   │
└──────────────┬──────────────────┘
               │
               ▼
         Session READY
    (stored in-memory only)
```

When the user asks a question, two more agents activate:

```
User question
      │
      ▼
┌─────────────────┐
│  GUARD AGENT    │  ──── Rejects off-topic, unsafe,
│  (gpt-4o-mini)  │       or controversial questions
└────────┬────────┘
         │ (passes)
         ▼
┌─────────────────────────────────┐
│  SAGE AGENT  (gpt-4o)           │
│  Retrieves top-k FAISS chunks   │
│  Streams answer token-by-token  │
│  Cites source chunks + filename │
└─────────────────────────────────┘
```

---

### Step 4 — Chat

The chat window streams answers in real time. Features:

- **Token-by-token streaming** via WebSocket
- **Stop generation** mid-answer
- **Suggested follow-up questions** generated per-document
- **Sources panel** — each answer shows the exact text chunk it came from
- **Auto-reconnect** — WebSocket drops are handled transparently
- **Session guard** — a "leave this chat?" confirm dialog and `beforeunload` browser event prevent accidental data loss
- **Persona mode (Pro)** — tune Sage to a specific domain (legal, clinical, finance, academic) for more specialised language

---

### Step 5 — Document Tools

After uploading, users can switch between tools without re-uploading:

#### Summary
A structured document summary: overview, document type, key points, and topics — displayed in the sidebar and as a full-page view.

#### Flashcards
10–20 Q&A flashcards with difficulty ratings (easy / medium / hard) and hints. For non-English documents, content is translated to English before card generation — ensuring accuracy even for Malayalam, Arabic, or Chinese source files.

#### Podcast Script
A full HOST–EXPERT dialogue script covering the document's key ideas. After the initial script is generated, the user can **extend the conversation on demand** — typing e.g. *"Go deeper on the financial risk section"* appends new exchanges to the existing script.

#### Translate
Translates the full document into any of 20 languages:

> Spanish · French · German · Portuguese · Italian · Dutch · Polish · Russian · Arabic · Hindi · Mandarin Chinese · Japanese · Korean · Turkish · Swedish · Danish · Finnish · Norwegian · Romanian · Greek

The translation agent is context-aware — it uses the document's summary to help decode garbled or encoded text before translating.

#### Charts *(Excel / CSV only)*
The user picks a chart type, and the Chart Agent interprets the spreadsheet's numerical data and returns a fully rendered, interactive chart:

- **Bar** — compare values across categories  
- **Line** — trends over time  
- **Area** — cumulative volumes  
- **Pie** — part-to-whole proportions  
- **Scatter** — correlation between two variables  

Charts are rendered client-side (Recharts) from structured JSON — no image generation, no external service.

#### Slides *(Pro only)*
Generates a downloadable `.pptx` presentation from the document's key points and structure.

---

### Step 6 — Multi-Document Mode *(Pro)*

Pro users can upload up to 5 files at once. The session automatically enters one of:

- **Compare mode** (2 files) — surfaces similarities, contradictions, and differences across both documents
- **Multi-file mode** (3–5 files) — analyses and answers across the full set, with each answer tagged by source filename

---

## 4. Privacy Architecture

Privacy is structural, not a policy promise.

| What happens | Detail |
|---|---|
| **No file storage** | Documents live in Python process memory only. No disk writes, no database rows for document content. |
| **Session TTL** | Sessions auto-expire after 2 hours of inactivity. LRU eviction caps active sessions at 500. |
| **Guest accounts** | Auto-created in memory (not in the database) and evicted with their session. |
| **Registered users** | Only credentials, plan info, and feedback ratings are stored in Postgres — never document content. |
| **WebSocket auth** | Tokens are passed via the `Sec-WebSocket-Protocol` subprotocol header, not the URL — never in server access logs. |
| **Refresh = session end** | An intentional product choice: refreshing the page clears the session. A browser `beforeunload` guard warns users before they accidentally lose work. |

---

## 5. Security Hardening

Eight security controls are in place:

1. **Secret-key startup guard** — app refuses to start in production without a strong `SECRET_KEY`
2. **Chunked + capped uploads** — body-size middleware rejects oversized requests before they hit application code
3. **Zip-bomb guard** — compressed archives are inspected before extraction
4. **Scanned-PDF guard** — image-only PDFs are rejected with a clear message (no silent failure)
5. **Rate limiting** — per-IP and per-user via `slowapi`
6. **WebSocket origin check** — prevents cross-site WebSocket hijacking
7. **ORM throughout** — SQLAlchemy with no raw SQL → no SQL injection surface
8. **No stored XSS** — `react-markdown` renders without `rehype-raw`, no raw HTML insertion

---

## 6. Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python 3.12) |
| AI models | OpenAI `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small` |
| Vector search | FAISS (in-memory, per-session) |
| Real-time | WebSocket (native FastAPI) |
| Auth | Custom JWT (python-jose + bcrypt) · Supabase Auth (optional) |
| Database | SQLite (dev) · Postgres via Supabase (prod) · SQLAlchemy 2.0 |
| PDF extraction | pdfplumber + PyMuPDF (dual-engine) |
| Office formats | openpyxl, python-docx, python-pptx |
| Rate limiting | slowapi |
| Migrations | Alembic (auto-run on startup) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v3 |
| Animation | Framer Motion |
| Charts | Recharts |
| Upload | react-dropzone |
| Markdown | react-markdown + remark-gfm |
| Icons | lucide-react |
| Analytics | PostHog |

### Infrastructure
| Layer | Technology |
|---|---|
| Serving | Caddy (automatic HTTPS, WebSocket proxy, SPA fallback) |
| Containerisation | Docker Compose (backend + frontend + Caddy) |
| Hosting | Single VM — Hetzner CX22 (~€4.50/mo) or Azure equivalent |
| Scaling model | Vertical (one Uvicorn worker; in-memory sessions cannot be sharded without a shared session store) |

---

## 7. Plans and Monetisation

| | **Free** | **Pro** |
|---|---|---|
| Files per session | 1 | Up to 5 |
| Max file size | 5 MB | 8 MB each |
| Multi-doc compare | ❌ | ✅ |
| Slide generation | ❌ | ✅ |
| Domain persona | ❌ | ✅ |
| Daily questions | 20 | 300 |
| Daily uploads | 5 | 50 |
| Billing | Free | Via `PRO_EMAILS` env var (real billing not yet implemented) |

**Revenue model:** Freemium SaaS. Free tier drives organic growth and word-of-mouth; Pro unlocks power-user features. Daily caps on both tiers protect the OpenAI cost line.

---

## 8. Competitive Positioning

| Capability | **Talktofile** | ChatPDF / Humata | ChatGPT upload | NotebookLM |
|---|:---:|:---:|:---:|:---:|
| Zero file storage (structural) | ✅ | ❌ | ⚠️ | ❌ |
| Multi-agent safety + ethics guard | ✅ | ❌ | ⚠️ generic | ⚠️ generic |
| Anti-hallucination grounding | ✅ strict | ⚠️ | ⚠️ | ⚠️ |
| Multi-doc compare (up to 5 files) | ✅ | ⚠️ limited | ⚠️ manual | ✅ |
| Spreadsheet calculations | ✅ | ❌ | ✅ | ❌ |
| Data visualisation (charts) | ✅ | ❌ | ❌ | ❌ |
| Podcast script generation | ✅ | ❌ | ❌ | ✅ audio |
| Flashcard generation | ✅ | ⚠️ | ❌ | ❌ |
| Slide deck generation | ✅ | ❌ | ❌ | ❌ |
| Translation (20 languages) | ✅ | ⚠️ | ✅ | ⚠️ |
| Domain persona customisation | ✅ | ❌ | ⚠️ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |
| Runs on ~€5/mo VPS | ✅ | ❌ | ❌ | ❌ |
| No account to get started | ✅ | ⚠️ | ❌ | ❌ |

**Our edge:** Trust + Focus + Cost. Not raw model scale — our differentiator is the multi-agent guardrail stack, privacy-by-architecture, the breadth of document tools (chat, summary, flashcards, slides, translate, podcast, charts), and an owned, low-cost deployment that privacy-sensitive teams can control.

---

## 9. Target Users

### Students and Researchers
Turn dense textbooks, lecture slides, and research papers into summaries, flashcards, and instant Q&A — without reading every page.

### Legal and Compliance Teams
Extract clauses, obligations, and deadlines from contracts and policies. Client-sensitive files never leave the session.

### Finance and Analysts
Question spreadsheets and annual reports, pull out the numbers that matter, and turn tables into charts — with every figure sourced directly from the file.

### Healthcare and Personal Documents
Make sense of lab results, medical letters, and insurance policies in plain English. No account required; nothing stored.

### Consultants and Knowledge Workers
Get through long reports, RFPs, and meeting notes fast. Compare two versions of a document. Generate a slide deck from a report in one click.

### Anyone Reading the Fine Print
Terms of service, warranties, rental agreements — understand what you're actually agreeing to in seconds.

---

## 10. Roadmap (Not Yet Built)

| Feature | Status |
|---|---|
| Real billing / Stripe integration | Not built — Pro currently granted via `PRO_EMAILS` env var |
| OCR for scanned PDFs | Not built — scanned PDFs are currently rejected with a clear error |
| Chat history persistence | Not built by design — sessions are in-memory; registered users get no saved history |
| Multi-instance / horizontal scaling | Not built — requires shared session store (Redis) to shard FAISS indexes |
| YouTube transcript fallback (when captions are off) | Not built — currently rejected if no caption track found |
| Mobile app | Not built |

---

## 11. Live Demo Flow (for pitches)

The fastest way to show Talktofile:

1. **Open the app** — no account needed; guest session auto-creates.
2. **Drop in a PDF** — a research paper, a contract, a financial report. Processing takes 5–15 seconds.
3. **Ask a specific question** — *"What is the termination clause?"* or *"What was revenue in Q3?"*. Watch the answer stream in real time, sourced to the exact page.
4. **Switch to Summary** — one click shows the structured overview and key points.
5. **Generate Flashcards** — 10 Q&A cards from the document, ready in under 10 seconds.
6. **Try Charts** — upload an Excel file, pick Bar chart, see the data visualised instantly.
7. **Extend the Podcast** — generate a podcast script, then type *"add a debate section"* and watch new dialogue appear.
8. **Show the privacy model** — refresh the page. The session is gone. Nothing was stored.

---

## 12. Key Numbers (MVP)

| Metric | Value |
|---|---|
| Supported file formats | 40+ (documents, data, code, web) |
| Languages supported for Q&A | Any (Sage answers in English from any source language) |
| Languages supported for translation | 20 |
| Chart types | 5 (bar, line, area, pie, scatter) |
| Max files per Pro session | 5 |
| Processing time (typical PDF) | 5–15 seconds |
| Answer latency (first token) | < 1 second |
| Infrastructure cost | ~€4.50/month (single Hetzner CX22 VM) |
| OpenAI models used | gpt-4o · gpt-4o-mini · text-embedding-3-small |

---

*Built by Gautham Krishna and Biswajith Gopinathan — MetaInsights, 2026.*
