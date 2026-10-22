// Per-page SEO for the use-case landing pages: the <title>, meta description and
// FAQ. Plain data with no imports on purpose — vite.config.ts reads this at build
// time to bake each page's head tags, FAQPage JSON-LD and FAQ markup into its own
// static HTML file (dist/students.html, …), so crawlers see them without running
// JS. The visible FAQ (FaqSection) and the JSON-LD are both generated from `faqs`
// here, so their text can't drift apart. Brand is always "Talktofile".

export const SITE_URL = 'https://talktofile.ai'

export interface Faq {
  q: string
  a: string
}

export interface PageSeo {
  title: string
  description: string
  faqs: Faq[]
}

export const PAGE_SEO = {
  students: {
    title: 'AI Flashcards & Study Notes from Your Textbooks | Talktofile',
    description: 'Turn textbooks and lecture videos into flashcards, summaries, and podcast scripts. Questions stay within your material. Free, no sign-up needed.',
    faqs: [
      { q: 'Will the flashcards stay within my syllabus?', a: "Yes. Flashcards and questions are built only from the files you upload, so you revise exactly what's in your material." },
      { q: 'Can I use lecture videos?', a: 'Yes. Paste a video link and Talktofile works with it just like a document.' },
      { q: 'Which files can I upload?', a: 'PDF, Word, PowerPoint, and 50+ other formats, plus web and video links.' },
      { q: 'Is it free?', a: 'Yes. Talktofile is currently free to use, and you can start without signing up.' },
    ],
  },
  research: {
    title: 'Chat with Research Papers, With Citations | Talktofile',
    description: 'Ask questions across research papers and get answers that point to the exact page. Cross-check findings and turn them into summaries or slides.',
    faqs: [
      { q: 'How do citations work?', a: 'Every answer shows the page or section it came from, so you can check it against the original.' },
      { q: 'Can I work across several papers?', a: 'Yes. Upload multiple papers and ask questions across them to compare and cross-check findings.' },
      { q: 'Does it understand tables and figures?', a: "It reads the text and tables in your papers, including long ones. Figures and images aren't supported yet." },
      { q: 'Will it make things up?', a: 'No. Talktofile answers only from the files you upload, not from general knowledge, and shows where each answer comes from.' },
    ],
  },
  legal: {
    title: 'Chat with Contracts and Legal Documents | Talktofile',
    description: 'Ask about terms, obligations, and deadlines in plain language. Your contracts are never stored. Translate into 15+ languages.',
    faqs: [
      { q: 'Are my contracts stored?', a: 'No. Files are processed in memory and never stored.' },
      { q: 'What can I ask?', a: 'Anything about the document: payment terms, notice periods, renewal dates, termination clauses, or who is responsible for what.' },
      { q: 'Does it work with contracts in other languages?', a: 'Yes. It supports 15+ languages and can translate documents.' },
      { q: 'Is this legal advice?', a: 'No. Talktofile helps you find and understand what a document says. For advice on your situation, consult a lawyer.' },
    ],
  },
  business: {
    title: 'AI Report Summaries, Charts & Slides | Talktofile',
    description: 'Get the key points, charts, and slides from any report or spreadsheet before your next meeting. Works with Excel, PDF, and PowerPoint.',
    faqs: [
      { q: 'Which files can I use?', a: 'Excel, PDF, PowerPoint, Word, and 50+ other formats, plus website links.' },
      { q: 'Can it turn spreadsheets into charts?', a: 'Yes. Charts mode turns your data into visuals you can drop into a presentation.' },
      { q: 'Can it make slides?', a: "Yes. Slides mode turns a report's key points into finished slides ready to present." },
      { q: 'Is my company data stored?', a: 'No. Files are processed in memory and never stored.' },
    ],
  },
} satisfies Record<string, PageSeo>

// schema.org FAQPage for a page's <script type="application/ld+json">.
export function faqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}
