// Generates the 4 poster HTML files (one per use case, 1080×1350) from one
// shared template, so the series stays consistent. Copy comes from
// marketing/use-cases.md and brand values from marketing/brand.md.
//
//   node marketing/posters/src/build.mjs
//
// Output files are self-contained: inline CSS, inline SVG logo and icons. The only
// external request is the Google Fonts stylesheet (Merriweather, as in frontend/index.html).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..') // talktofile/
const OUT = join(HERE, '..')
const LUCIDE = join(ROOT, 'frontend', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons')

// ── Brand tokens (frontend/tailwind.config.js, src/index.css) ────────────────────
const BRAND = {
  50: '#fdf4ee', 100: '#fbe6d6', 200: '#f6cbab', 300: '#efa878', 400: '#e9854a',
  500: '#e56f2d', 600: '#E2611B', 700: '#bc4d14', 800: '#963d14', 900: '#793314',
}
const INK = '#303030'

// ── Lucide icons, read from the same package version the app ships ───────────────
function icon(file, { size = 24, stroke = 2, cls = '' } = {}) {
  const src = readFileSync(join(LUCIDE, `${file}.js`), 'utf8')
  const arr = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*\])\);/)[1]
  const nodes = Function(`return ${arr}`)()
  const inner = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}

// Logo mark for light surfaces (CLAUDE.md → Design / Brand → Wordmark).
const MARK = readFileSync(join(ROOT, 'talktofile_logo', 'svg', 'mark-color.svg'), 'utf8')
  .replace('<svg ', '<svg class="mark" aria-hidden="true" ')

// Real QR codes for each page URL, pre-generated into src/qr/ (see qr/README.md).
const qr = (slug) => readFileSync(join(HERE, 'qr', `${slug}.svg`), 'utf8').replace('<svg ', '<svg aria-hidden="true" ')

// ── Poster content (marketing/use-cases.md) ─────────────────────────────────────
const POSTERS = [
  {
    file: 'students',
    slug: 'students',
    tag: 'Students & exam prep',
    tagIcon: 'graduation-cap',
    headline: ['Upload textbooks.', 'Paste lecture videos.'],
    payoff: 'Learn faster.',
    subhead: 'Turn any chapter into flashcards, summaries, or a podcast script.',
    benefits: [
      ['layers', 'Flashcards built only from your material'],
      ['youtube', 'Paste a lecture video link. It works like a document.'],
      ['smartphone', 'Revise on the go'],
    ],
    chat: {
      headIcon: 'file-text',
      files: 'Biology_Textbook.pdf · Chapter 3',
      question: 'Summarise chapter 3 for my exam',
      answer: `<p><strong>Chapter 3: Cell membranes &amp; transport</strong></p>
        <ul>
          <li>Membranes are phospholipid bilayers with proteins.<sup>1</sup></li>
          <li>Diffusion and osmosis are passive: no energy needed.<sup>2</sup></li>
          <li>Active transport uses ATP to move against a gradient.<sup class="on">3</sup></li>
        </ul>`,
      source: {
        file: 'Biology_Textbook.pdf', loc: '¶ 14', pct: 93,
        text: 'Active transport moves molecules <mark>against their concentration gradient</mark> using ATP.',
      },
    },
  },
  {
    file: 'researchers',
    slug: 'research',
    tag: 'Research papers',
    tagIcon: 'microscope',
    headline: ['Upload papers.', 'Paste article links.'],
    payoff: 'Get answers you can cite.',
    subhead: 'Cross-check findings across papers, then turn them into summaries or slides.',
    benefits: [
      ['quote', 'Every answer shows where it came from'],
      ['files', 'Ask across several papers to cross-check findings'],
      ['circle-check-big', 'Answers only from your files. No making things up.'],
    ],
    chat: {
      headIcon: 'files',
      files: 'sleep-trial-2024.pdf, sleep-trial-2025.pdf',
      question: 'Do these two trials agree on the effect?',
      answer: `<p><strong>Partly.</strong> The 2024 trial reports a 32% drop in time to fall asleep.<sup>1</sup> The 2025 trial found 18% in an older group.<sup class="on">2</sup> Both flag small samples as a limitation.<sup>3</sup></p>`,
      source: {
        file: 'sleep-trial-2025.pdf', loc: '¶ 9', pct: 91,
        text: '…sleep onset latency fell by <mark>18% in participants aged 60 and over</mark>, a smaller effect than earlier reports.',
      },
    },
  },
  {
    file: 'business',
    slug: 'business',
    tag: 'Business reports & data',
    tagIcon: 'chart-line',
    headline: ['Upload reports.', 'Paste website links.'],
    payoff: 'Walk in prepared.',
    subhead: 'Get key points, charts, slides, and quick answers from any report before your next meeting.',
    benefits: [
      ['chart-column', 'Turn spreadsheets into charts for your deck'],
      ['presentation', 'Turn a report’s key points into finished slides'],
      ['lock', 'Your company data is never stored'],
    ],
    chat: {
      headIcon: 'file-text',
      files: 'Q3_Board_Report.xlsx',
      question: 'Give me the key numbers before my board meeting',
      answer: `<ul>
          <li><strong>Revenue:</strong> $4.2M, up 12% on Q2.<sup>1</sup></li>
          <li><strong>Gross margin:</strong> 61%, down 2 pts on higher freight costs.<sup class="on">2</sup></li>
          <li><strong>Churn:</strong> 3.1%, the lowest this year.<sup>3</sup></li>
        </ul>`,
      source: {
        file: 'Q3_Board_Report.xlsx', loc: '¶ 6', pct: 95,
        text: 'Gross margin closed at <mark>61%, down 2 points</mark> quarter on quarter, driven by freight.',
      },
    },
  },
  {
    file: 'legal',
    slug: 'legal',
    tag: 'Contracts & legal docs',
    tagIcon: 'scale',
    headline: ['Upload contracts.', 'Paste policy links.'],
    payoff: 'Find the clause you need.',
    subhead: 'Ask about terms, obligations, and deadlines, or translate into 15+ languages.',
    benefits: [
      ['lock', 'Nothing stored. Files are processed in memory.'],
      ['circle-check-big', 'Answers only from your file'],
      ['languages', 'Translate contracts into 15+ languages'],
    ],
    chat: {
      headIcon: 'file-text',
      files: 'Master_Services_Agreement.pdf',
      question: 'Find the termination clause in this contract',
      answer: `<p><strong>Clause 14.2: Termination for convenience.</strong> Either party can end the agreement with 60 days’ written notice.<sup class="on">1</sup> If you terminate in the first 12 months, an early-exit fee of two months’ fees applies.<sup>2</sup></p>`,
      source: {
        file: 'Master_Services_Agreement.pdf', loc: '¶ 31', pct: 96,
        text: '14.2 Either party may terminate this Agreement for convenience by giving <mark>not less than sixty (60) days’ written notice</mark> to the other party.',
      },
    },
    // landingVariants.ts footerNote — the legal page always carries it.
    footnote: 'Not legal advice. Talktofile explains what your document says. For decisions, consult a qualified lawyer.',
  },
]

// ── Formats ─────────────────────────────────────────────────────────────────────
// Both formats are laid out on a CSS-px canvas. A4 is 210×297mm (≈794×1123px).
// Social is laid out at 864×1080 and zoomed ×1.25 to exactly 1080×1350px, so it
// shares every px value with A4 and only the layout overrides differ.
const FORMATS = {
  social: { suffix: '-social', label: '1080×1350', page: 'width:864px;height:1080px;zoom:1.25;', at: '@page{size:1080px 1350px;margin:0}' },
}

const CSS = (p, f) => `
${f.at}
:root{
  --brand-50:${BRAND[50]};--brand-100:${BRAND[100]};--brand-200:${BRAND[200]};--brand-500:${BRAND[500]};
  --brand-600:${BRAND[600]};--brand-700:${BRAND[700]};--brand-800:${BRAND[800]};
  --ink:${INK};--slate-900:#0f172a;--slate-700:#334155;--slate-600:#475569;--slate-500:#64748b;
  --slate-400:#94a3b8;--slate-300:#cbd5e1;--slate-200:#e2e8f0;--slate-50:#F8FAFC;
  --accent:var(--brand-600);--accent-ink:var(--brand-700);
  --pad:56px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--slate-50)}
body{font-family:'Merriweather',Georgia,serif;color:var(--slate-900);-webkit-font-smoothing:antialiased;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{${f.page}position:relative;overflow:hidden;display:flex;flex-direction:column;background-color:var(--slate-50);
  /* .bg-grid from src/index.css */
  background-image:radial-gradient(circle,rgba(226,97,27,.08) 1px,transparent 1px);background-size:24px 24px}
.watermark{position:absolute;top:-56px;right:-96px;width:440px;height:440px;color:var(--accent);opacity:.07;transform:rotate(-12deg);pointer-events:none}
.watermark svg{width:100%;height:100%}

/* Top: logo lockup (Navbar) + audience tag */
.top{position:relative;display:flex;align-items:center;justify-content:space-between;padding:30px var(--pad) 0}
.logo{display:flex;align-items:center;gap:4px}
.logo .mark{width:56px;height:56px;flex-shrink:0}
.logo span{margin-left:-12px;font-style:italic;font-weight:700;font-size:34px;letter-spacing:-0.02em;color:var(--brand-600)}
.tag{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:9999px;background:#fff;
  border:1px solid var(--slate-200);box-shadow:0 1px 2px 0 rgb(0 0 0 / .05);
  color:var(--accent-ink);font-weight:600;font-size:15px;letter-spacing:-0.01em;white-space:nowrap}
.tag svg{width:18px;height:18px}

/* Hero (Landing h1 + payoff line) */
.hero{position:relative;padding:28px var(--pad) 0}
h1{margin:0;font-weight:800;font-size:48px;line-height:1.1;letter-spacing:-0.03em;color:var(--ink)}
h1 .l{display:block;white-space:nowrap}
h1 .payoff{display:block;font-style:italic;color:var(--brand-600);text-wrap:balance}
.sub{margin:16px 0 0;font-size:19px;line-height:1.55;letter-spacing:-0.03em;color:var(--ink);text-wrap:pretty}
.sub svg{display:inline-block;vertical-align:-0.15em;width:22px;height:22px;color:var(--brand-600);margin-right:8px}

/* Chat mockup (ChatWindow + MessageBubble + CitationMarker) */
.zone{position:relative;flex:1;display:flex;align-items:stretch;padding:18px var(--pad)}
.chat{width:100%;display:flex;flex-direction:column;background:#fff;border:1px solid var(--slate-200);border-radius:16px;overflow:hidden;
  box-shadow:0 10px 15px -3px rgb(226 232 240 / .6),0 4px 6px -4px rgb(226 232 240 / .6),0 1px 2px 0 rgb(0 0 0 / .04)}
.head{display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--slate-200);background:#fff}
.hchip{width:32px;height:32px;border-radius:8px;background:var(--brand-50);border:1px solid var(--brand-100);
  display:flex;align-items:center;justify-content:center;color:var(--brand-500);flex-shrink:0}
.hchip svg{width:16px;height:16px}
.htitle{font-size:15px;font-weight:500;color:#1e293b;margin:0;line-height:1.3}
.hfile{font-size:13px;color:var(--slate-500);margin:2px 0 0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dots{margin-left:auto;display:flex;gap:6px;color:var(--slate-400)}
.dots svg{width:16px;height:16px}
.body{flex:1;background:rgb(253 244 238 / .25);padding:14px 18px 16px;display:flex;flex-direction:column;gap:12px}
.msg{display:flex;align-items:flex-end;gap:10px}
.msg.user{flex-direction:row-reverse}
.av{width:32px;height:32px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(to bottom right,var(--brand-500),var(--brand-700));color:#fff;font-weight:700;font-size:14px;
  box-shadow:0 1px 2px 0 rgb(0 0 0 / .05)}
.av svg{width:14px;height:14px}
.bubble{max-width:85%;min-width:0;font-size:14.5px;line-height:1.55}
.user .bubble{background:linear-gradient(to bottom right,var(--brand-600),var(--brand-700));color:#fff;
  border-radius:16px 16px 6px 16px;padding:10px 16px;box-shadow:0 1px 2px 0 var(--brand-200)}
.bot .bubble{background:#fff;border:1px solid var(--slate-200);border-radius:16px 16px 16px 6px;padding:11px 16px;
  color:var(--slate-700);box-shadow:0 1px 2px 0 rgb(226 232 240 / .5)}
.bot .bubble p{margin:0}
.bot .bubble p + ul{margin-top:6px}
.bot .bubble ul{margin:0;padding-left:18px}
.bot .bubble li{margin:2px 0}
.bot .bubble strong{color:var(--slate-900);font-weight:600}
sup{display:inline-block;margin:0 2px;border-radius:6px;background:var(--brand-50);color:var(--brand-600);font-weight:700;
  font-size:.72em;line-height:1.35;min-width:1.15em;padding:0 .28em;text-align:center;vertical-align:super}
sup.on{background:var(--brand-600);color:#fff}
.src{margin-left:42px;max-width:85%;background:#fff;border:1px solid var(--slate-200);border-radius:12px;padding:10px 14px;
  box-shadow:0 20px 25px -5px rgb(15 23 42 / .1),0 8px 10px -6px rgb(15 23 42 / .1)}
.src-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;font-size:12px}
.src-f{font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.src-m{display:flex;align-items:center;gap:6px;flex-shrink:0;color:var(--slate-500);white-space:nowrap}
.src-m i{width:1px;height:10px;background:var(--slate-200)}
.src-m b{color:var(--brand-700);font-weight:600}
.src-t{margin:0;font-size:13px;line-height:1.6;color:var(--slate-600)}
/* Composer (ChatWindow input block) */
.composer{display:flex;align-items:center;gap:8px;padding:10px 16px 12px;border-top:1px solid var(--slate-200);background:#fff}
.field{flex:1;min-width:0;height:40px;display:flex;align-items:center;padding:0 14px;border:1px solid var(--slate-200);border-radius:12px;
  font-size:14px;color:var(--slate-400);white-space:nowrap}
.send{width:40px;height:40px;border-radius:12px;background:var(--brand-600);color:#fff;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;box-shadow:0 1px 2px 0 rgb(0 0 0 / .05)}
.send svg{width:16px;height:16px}
mark{background:var(--brand-100);color:var(--brand-800);border-radius:4px;padding:0 2px}

/* Benefits (landing icon-chip style) */
.benefits{position:relative;list-style:none;margin:0;padding:0 var(--pad);display:flex;flex-direction:column;gap:10px}
.benefits li{display:flex;align-items:center;gap:14px;font-size:17.5px;line-height:1.35;letter-spacing:-0.01em;color:var(--ink)}
.ichip{width:38px;height:38px;border-radius:12px;flex-shrink:0;background:rgb(226 97 27 / .1);border:1px solid rgb(226 97 27 / .2);
  display:flex;align-items:center;justify-content:center;color:var(--brand-600)}
.ichip svg{width:19px;height:19px}

/* Legal disclaimer — sits on the light surface so it stays readable at small size */
.note{position:relative;margin:14px 0 0;padding:0 var(--pad);font-size:12.5px;line-height:1.5;color:var(--slate-500)}

/* CTA band — the site footer's surface (bg #E2611B, white text) */
.cta{position:relative;margin-top:24px;background:var(--brand-600);color:#fff;padding:22px var(--pad);
  display:flex;align-items:center;justify-content:space-between;gap:28px}
.cta .url{margin:0;font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;white-space:nowrap}
.qr{width:120px;height:120px;flex-shrink:0;background:#fff;border-radius:12px;padding:10px;box-shadow:0 1px 2px 0 rgb(0 0 0 / .1)}
.qr svg{display:block;width:100%;height:100%}

/* Social (864×1080 before zoom): wider, shorter → benefits go to 3 columns */
.social{--pad:52px}
.social .top{padding-top:34px}
.social .hero{padding-top:34px}
.social h1{font-size:52px}
.social .sub{margin-top:18px;font-size:20px}
.social .zone{padding-top:16px;padding-bottom:16px}
.social .benefits{flex-direction:row;gap:16px}
.social .benefits li{flex:1;flex-direction:column;align-items:flex-start;gap:10px;font-size:17px}
.social .cta{margin-top:22px;padding-top:18px;padding-bottom:18px}
.social .note{margin-top:12px}
.social .qr{width:112px;height:112px}
`

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function render(p, fmtKey) {
  const f = FORMATS[fmtKey]
  const c = p.chat
  const url = `talktofile.ai/${p.slug}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talktofile · ${esc(p.tag)} poster (${f.label})</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&display=swap" rel="stylesheet">
<style>${CSS(p, f)}</style>
</head>
<body>
<main class="page ${fmtKey}">
  <div class="watermark">${icon(p.tagIcon, { stroke: 1.25 })}</div>

  <header class="top">
    <div class="logo">${MARK}<span>Talktofile</span></div>
    <div class="tag">${icon(p.tagIcon, { stroke: 2.25 })}${esc(p.tag)}</div>
  </header>

  <section class="hero">
    <h1>${p.headline.map((l) => `<span class="l">${esc(l)}</span>`).join('')}<span class="payoff">${esc(p.payoff)}</span></h1>
    <p class="sub">${icon('sparkles', { stroke: 2.25 })}${esc(p.subhead)}</p>
  </section>

  <section class="zone">
    <div class="chat">
      <div class="head">
        <div class="hchip">${icon(c.headIcon)}</div>
        <div style="min-width:0">
          <p class="htitle">Chat</p>
          <p class="hfile">${esc(c.files)}</p>
        </div>
        <div class="dots">${icon('scroll-text')}${icon('share-2')}${icon('download')}</div>
      </div>
      <div class="body">
        <div class="msg user"><div class="av">${icon('user', { stroke: 2.25 })}</div><div class="bubble">${esc(c.question)}</div></div>
        <div class="msg bot"><div class="av">T</div><div class="bubble">${c.answer}</div></div>
        <div class="src">
          <div class="src-h"><span class="src-f">${esc(c.source.file)}</span><span class="src-m">${c.source.loc}<i></i><b>${c.source.pct}% match</b></span></div>
          <p class="src-t">${c.source.text}</p>
        </div>
      </div>
      <div class="composer"><div class="field">Ask anything here.</div><div class="send">${icon('send')}</div></div>
    </div>
  </section>

  <ul class="benefits">
    ${p.benefits.map(([ic, t]) => `<li><span class="ichip">${icon(ic, { stroke: 2.25 })}</span><span>${esc(t)}</span></li>`).join('\n    ')}
  </ul>

  ${p.footnote ? `<p class="note">${esc(p.footnote)}</p>` : ''}

  <footer class="cta">
    <div>
      <p class="url">${esc(url)}</p>
    </div>
    <div class="qr" aria-label="QR code for ${esc(url)}">${qr(p.slug)}</div>
  </footer>
</main>
</body>
</html>
`
}

for (const p of POSTERS) {
  for (const fmt of Object.keys(FORMATS)) {
    const name = `${p.file}${FORMATS[fmt].suffix}.html`
    writeFileSync(join(OUT, name), render(p, fmt))
    console.log('wrote', name)
  }
}
