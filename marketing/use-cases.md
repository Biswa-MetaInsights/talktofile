# Use-case landing pages: poster copy

All four pages are the same `Landing` component (`frontend/src/components/Landing.tsx`). Only the
hero copy, trust row, default mode, FAQ and footer note change. That copy lives in:

- `frontend/src/lib/landingVariants.ts`: headline, payoff, subhead, trust row, default mode, footer note
- `frontend/src/lib/landingSeo.ts`: page title, meta description, FAQ

Base URL: `SITE_URL = 'https://talktofile.ai'`. The route is the variant `slug`.

> **Note:** the researchers page lives at **`/research`**, not `/researchers`. The poster file is
> still named `researchers.html`, as requested.

## The CTA

The use-case pages have **no CTA button with a text label**. The hero's main action is the upload
box, which reads **"Drop a document, or browse to upload"**, plus an **"Add"** button next to the
link box. Every page shares the trust line **"No sign-up needed to start"** (the `NO_SIGNUP`
constant; the research page shortens it to "No sign-up to start").

Poster CTA: the footer shows only the page URL, **talktofile.ai/<slug>**, next to a QR code
for the same URL. An earlier version also had "Drop a document. Ask anything." and "No sign-up
needed to start" in the footer; both were removed on request.

## Columns

- **Headline:** the variant `headline` plus the italic orange `payoff`, unchanged.
- **Subheadline:** the variant `subhead`, unchanged.
- **Benefits:** 3 lines taken from the page's trust row and FAQ answers, shortened. The source is
  given for each.
- **Chat mockup:** an example question and answer for the poster. The answers are made-up
  document content. They show features the app has: chat answers, ¹²³ citation markers, the
  citation popover (filename · ¶ location · % match), chapter scoping, and multiple files.

---

## Students: `/students`

| Field | Copy |
|---|---|
| URL | https://talktofile.ai/students |
| Nav label | Students & exam prep (icon `GraduationCap`) |
| Headline | Upload textbooks. Paste lecture videos. ***Learn faster.*** |
| Subheadline | Turn any chapter into flashcards, summaries, or a podcast script. |
| Default mode | Flashcards |
| CTA | Drop a document. Ask anything. · No sign-up needed to start |

**Benefits**

| Icon | Poster line | Source on page |
|---|---|---|
| `Layers` | Flashcards built only from your material | FAQ: "Flashcards and questions are built only from the files you upload, so you revise exactly what's in your material." |
| `Youtube` | Paste a lecture video link. It works like a document. | FAQ: "Paste a video link and Talktofile works with it just like a document." |
| `Smartphone` | Revise on the go | Trust row: "Revise on the go" |

**Chat mockup.** File: `Biology_Textbook.pdf` · scoped to Chapter 3

- Q: "Summarise chapter 3 for my exam"
- A: **Chapter 3: Cell membranes & transport**
  - Membranes are phospholipid bilayers with proteins.¹
  - Diffusion and osmosis are passive: no energy needed.²
  - Active transport uses ATP to move against a gradient.³
- Citation 3: "Active transport moves molecules **against their concentration gradient** using ATP." · ¶ 14 · 93% match

---

## Researchers: `/research`

| Field | Copy |
|---|---|
| URL | https://talktofile.ai/research |
| Nav label | Research papers (icon `Microscope`) |
| Headline | Upload papers. Paste article links. ***Get answers you can cite.*** |
| Subheadline | Cross-check findings across papers, then turn them into summaries or slides. |
| Default mode | Chat |
| CTA | Drop a document. Ask anything. · No sign-up needed to start |

**Benefits**

| Icon | Poster line | Source on page |
|---|---|---|
| `Quote` | Every answer shows where it came from | FAQ: "Every answer shows the page or section it came from, so you can check it against the original." |
| `Files` | Ask across several papers to cross-check findings | FAQ: "Upload multiple papers and ask questions across them to compare and cross-check findings." |
| `CheckCircle` | Answers only from your files. It won't make things up. | Trust row: "Answers only from your files"; FAQ "Will it make things up? No. Talktofile answers only from the files you upload…" |

**Chat mockup.** Files: `sleep-trial-2024.pdf`, `sleep-trial-2025.pdf` (2 documents)

- Q: "Do these two trials agree on the effect?"
- A: **Partly.** The 2024 trial reports a 32% drop in time to fall asleep.¹ The 2025 trial found 18% in an older group.² Both flag small samples as a limitation.³
- Citation 2: "…sleep onset latency fell by **18% in participants aged 60 and over**, a smaller effect than earlier reports." · ¶ 9 · 91% match

---

## Business: `/business`

| Field | Copy |
|---|---|
| URL | https://talktofile.ai/business |
| Nav label | Business reports & data (icon `LineChart`) |
| Headline | Upload reports. Paste website links. ***Walk in prepared.*** |
| Subheadline | Get key points, charts, slides, and quick answers from any report before your next meeting. |
| Default mode | Charts |
| CTA | Drop a document. Ask anything. · No sign-up needed to start |

**Benefits**

| Icon | Poster line | Source on page |
|---|---|---|
| `BarChart3` | Turn spreadsheets into charts for your deck | FAQ: "Charts mode turns your data into visuals you can drop into a presentation." |
| `Presentation` | Turn a report's key points into finished slides | FAQ: "Slides mode turns a report's key points into finished slides ready to present." |
| `Lock` | Your company data is never stored | FAQ: "Is my company data stored? No. Files are processed in memory and never stored." |

**Chat mockup.** File: `Q3_Board_Report.xlsx`

- Q: "Give me the key numbers before my board meeting"
- A:
  - **Revenue:** $4.2M, up 12% on Q2.¹
  - **Gross margin:** 61%, down 2 pts on higher freight costs.²
  - **Churn:** 3.1%, the lowest this year.³
- Citation 2: "Gross margin closed at **61%, down 2 points** quarter on quarter, driven by freight." · ¶ 6 · 95% match

---

## Legal: `/legal`

| Field | Copy |
|---|---|
| URL | https://talktofile.ai/legal |
| Nav label | Contracts & legal docs (icon `Scale`) |
| Headline | Upload contracts. Paste policy links. ***Find the clause you need.*** |
| Subheadline | Ask about terms, obligations, and deadlines, or translate into 15+ languages. |
| Default mode | Chat |
| CTA | Drop a document. Ask anything. · No sign-up needed to start |
| Footer note (required) | Not legal advice. Talktofile explains what your document says. For decisions, consult a qualified lawyer. |

**Benefits**

| Icon | Poster line | Source on page |
|---|---|---|
| `Lock` | Nothing stored. Files are processed in memory. | Trust row: "Nothing stored"; FAQ: "Files are processed in memory and never stored." |
| `CheckCircle` | Answers only from your file | Trust row: "Answers only from your file" |
| `Languages` | Translate contracts into 15+ languages | Subhead / FAQ: "It supports 15+ languages and can translate documents." |

**Chat mockup.** File: `Master_Services_Agreement.pdf`

- Q: "Find the termination clause in this contract"
- A: **Clause 14.2: Termination for convenience.** Either party can end the agreement with 60 days' written notice.¹ If you terminate in the first 12 months, an early-exit fee of two months' fees applies.²
- Citation 1: "14.2 Either party may terminate this Agreement for convenience by giving **not less than sixty (60) days' written notice** to the other party." · ¶ 31 · 96% match
