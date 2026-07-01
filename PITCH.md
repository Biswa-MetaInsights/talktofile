# Talktofile

**Upload a document. Have an intelligent conversation with it.**

Talktofile lets anyone drop in a file and instantly ask questions, get summaries,
compare documents, or run calculations on spreadsheets — in any language, with
answers grounded strictly in the document's own content. No setup, no learning
curve, no data left behind.

---

## The problem

People drown in documents — contracts, reports, research papers, financial
statements, spreadsheets — and the tools to "just ask a question" about them are
either:

- **Generic chatbots** (ChatGPT/Claude file upload) that aren't built for a real
  document workflow and retain your data, or
- **Thin "chat with PDF" wrappers** (ChatPDF, AskYourPDF, Humata) that store your
  files, hallucinate freely, and offer no real safety or multi-document analysis, or
- **Big-tech tools** (NotebookLM) that lock you into an account and can't be
  self-hosted for data sovereignty.

None of them combine **accuracy, privacy, and focus** — which is exactly what
privacy-sensitive professionals and budget-conscious teams need.

---

## The solution

Talktofile is a **purpose-built, privacy-first document intelligence app** powered
by a multi-agent AI pipeline. It answers only from your document, refuses to
hallucinate or take controversial stances, never stores your files, and runs on a
single low-cost server.

---

## What makes it different

### 🧠 A multi-agent pipeline, not a prompt wrapper
Most competitors are a single LLM call. Talktofile runs five specialised agents,
each with one job:

| Agent | Role |
|---|---|
| **Orchestrator** | Drives the extract → process → ready pipeline |
| **Lingua** | Detects language; handles non-English & mixed-language docs |
| **Analyst** | Chunks, embeds, indexes, and summarises each document |
| **Sage** | Streaming, document-grounded answers |
| **Guard** | Screens every question for safety + AI ethics before it reaches Sage |

### 🔒 Privacy by architecture
Documents and chat history live **only in memory** and disappear when the session
ends — nothing is written to disk or database. This is a *structural* guarantee,
not a policy promise.

### ✅ Trust built in
- **Zero hallucination** — answers come from the document or Sage says it can't find it.
- **AI-ethics Guard** — stays neutral on geopolitical, racial, religious, and other
  controversial topics; refuses harmful requests; still answers factual questions.
- **Security-hardened** — rate limiting, zip-bomb guards, capped uploads,
  authenticated WebSockets, ORM (no SQL injection), no stored XSS.

### 💸 Lean and cost-disciplined
Per-user **daily caps** prevent runaway AI bills. Runs on a single ~€4.50/mo VPS —
no Kubernetes, no cloud sprawl.

---

## Key features

- **📄 Multi-format** — PDF, DOCX, XLSX, CSV, TXT, Markdown. Dual-engine PDF
  extraction recovers text other tools miss.
- **🌍 Any language in, English out** — auto-detects and answers consistently.
- **🔀 Compare & multi-doc** — up to 5 files; surface similarities, differences,
  and contradictions across them.
- **🧮 Spreadsheet intelligence** — real calculations using only the numbers present.
- **⚡ Real-time streaming** — token-by-token answers with stop/regenerate.
- **🎭 Personalise Sage** — tune the assistant to your domain (legal, clinical, finance…).
- **👍 Built-in feedback loop** — per-answer ratings + periodic check-ins for
  continuous improvement.

---

## How it compares

| Capability | **Talktofile** | ChatPDF / AskYourPDF | Humata | ChatGPT / Claude upload | NotebookLM |
|---|:--:|:--:|:--:|:--:|:--:|
| Multi-agent safety + ethics guard | ✅ | ❌ | ❌ | ⚠️ generic | ⚠️ generic |
| Memory-only, zero-persistence privacy | ✅ | ❌ | ❌ | ⚠️ retained | ❌ |
| Multi-doc compare / contradictions | ✅ | ⚠️ | ✅ | ⚠️ manual | ✅ |
| Real spreadsheet calculations | ✅ | ❌ | ❌ | ✅ | ❌ |
| Any-language → English answers | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| Domain personalisation | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| Self-hostable / data sovereignty | ✅ | ❌ | ❌ | ❌ | ❌ |
| Per-user cost caps | ✅ | n/a | n/a | n/a | n/a |

**Where we win**
- vs **ChatPDF / AskYourPDF / Humata** — stronger privacy, explicit
  ethics/anti-hallucination controls, true multi-doc comparison, and spreadsheet
  math, at a fraction of the operating cost.
- vs **ChatGPT / Claude upload** — a purpose-built document workflow (compare mode,
  summaries panel, suggested questions, personas, per-doc grounding) with a privacy
  model you control.
- vs **NotebookLM** — no account lock-in, self-hostable, stricter grounding and
  ethics guardrails.

**Honest positioning:** our edge is **trust + focus + cost**, not raw model scale.
The differentiators are the multi-agent guardrails, privacy-by-design, and an owned,
low-cost deployment — what privacy-sensitive professionals and budget teams want,
and what generic wrappers and big-tech tools don't offer together.

---

## Who it's for

Legal & compliance, healthcare & clinical, finance & accounting, researchers, and
any team that needs **accurate, private, domain-aware answers from their own
documents** — without handing data to a third party or paying enterprise prices.

---

## Tech stack

**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion
**Backend:** FastAPI · Python 3.12 · WebSocket streaming
**AI:** OpenAI `gpt-4o` · `gpt-4o-mini` · `text-embedding-3-small` · FAISS (RAG)
**Data & Auth:** Supabase (Postgres + Auth) · documents never persisted
**Deploy:** Single-VM Docker stack · Caddy (automatic HTTPS) · ~€4.50/mo to run
