import {
  CheckCircle, GraduationCap, LineChart, Lock, Microscope, Scale, Smartphone, Zap, type LucideIcon,
} from 'lucide-react'
import type { AppMode } from '../types'
import { PAGE_SEO, SITE_URL, type PageSeo } from './landingSeo'

// Use-case landing pages. Every page is the same `Landing` component — only the
// hero copy, the trust row, the pre-selected mode and an optional footer note
// change. The page is picked from the URL path (talktofile.ai/students → the
// `students` entry); any unknown path falls back to the home page. No router is
// needed: Caddy (and the Vite dev server) already serve index.html for every
// non-file path.
//
// Adding a page = adding an entry to VARIANTS. Nothing else needs touching.

// Where a headline segment is followed by a forced line break:
//   'mobile'  → below lg only   'desktop' → lg and up only   'always' → every width
// Breaks are explicit (not auto-wrap) so the headline keeps a stable shape while
// resizing — see CLAUDE.md → Design / Brand → Responsiveness. At lg+ every
// headline is "Upload X. Paste Y." on one line + the payoff below; below lg the
// use-case pages stack all three. Line 1 must fit ~1040px at 56px (≈39 chars of
// "Upload textbooks. Paste lecture videos.", the widest today) — measure before
// lengthening it.
export type HeadlineBreak = 'mobile' | 'desktop' | 'always'

export interface LandingVariant {
  slug: string
  // Entry in the navbar "Use cases" dropdown. Omitted on home.
  nav?: { label: string; icon: LucideIcon }
  // Headline text before the italic orange payoff, split at its line breaks.
  headline: { text: string; br?: HeadlineBreak }[]
  // The italic orange phrase that ends the headline. Rendered `whitespace-nowrap`,
  // so it must stay short (~25 chars max) or it overflows at 320px.
  payoff: string
  // One line at lg+: must stay under ~1040px at 24px. The business subhead
  // (~92 chars, 1003px) is the widest today and nearly at the limit — measure
  // before lengthening any subhead. Wraps freely below lg.
  subhead: string
  trust: { icon: LucideIcon; label: string }[]
  defaultMode: AppMode
  footerNote?: string
  // Title, description and FAQ, from lib/landingSeo.ts. Baked into the page's
  // static HTML at build time (see vite.config.ts) and re-applied on mount by
  // applyVariantMeta. Omitted on home, which keeps index.html's tags and has no FAQ.
  meta?: PageSeo
}

const NOTHING_STORED = { icon: Lock, label: 'Nothing stored' }
const NO_SIGNUP = { icon: Zap, label: 'No sign-up needed to start' }

export const HOME_VARIANT: LandingVariant = {
  slug: '',
  headline: [
    { text: 'Upload files. Paste web or', br: 'mobile' },
    { text: ' video links.', br: 'desktop' },
  ],
  payoff: 'Make anything.',
  subhead: 'Get flashcards, slides, charts, answers, and more. All from your file.',
  trust: [NOTHING_STORED, NO_SIGNUP],
  defaultMode: 'chat',
}

const VARIANTS: LandingVariant[] = [
  {
    slug: 'students',
    nav: { label: 'Students & exam prep', icon: GraduationCap },
    headline: [
      { text: 'Upload textbooks.', br: 'mobile' },
      { text: ' Paste lecture videos.', br: 'always' },
    ],
    payoff: 'Learn faster.',
    subhead: 'Turn any chapter into flashcards, summaries, or a podcast script.',
    trust: [{ icon: Smartphone, label: 'Revise on the go' }, NO_SIGNUP],
    defaultMode: 'flashcards',
    meta: PAGE_SEO.students,
  },
  {
    slug: 'research',
    nav: { label: 'Research papers', icon: Microscope },
    headline: [
      { text: 'Upload papers.', br: 'mobile' },
      { text: ' Paste article links.', br: 'always' },
    ],
    payoff: 'Get answers you can cite.',
    subhead: 'Cross-check findings across papers, then turn them into summaries or slides.',
    trust: [{ icon: CheckCircle, label: 'Answers only from your files' }, { icon: Zap, label: 'No sign-up to start' }],
    defaultMode: 'chat',
    meta: PAGE_SEO.research,
  },
  {
    slug: 'legal',
    nav: { label: 'Contracts & legal docs', icon: Scale },
    headline: [
      { text: 'Upload contracts.', br: 'mobile' },
      { text: ' Paste policy links.', br: 'always' },
    ],
    payoff: 'Find the clause you need.',
    subhead: 'Ask about terms, obligations, and deadlines, or translate into 15+ languages.',
    trust: [NOTHING_STORED, { icon: CheckCircle, label: 'Answers only from your file' }],
    defaultMode: 'chat',
    footerNote: 'Not legal advice. Talktofile explains what your document says. For decisions, consult a qualified lawyer.',
    meta: PAGE_SEO.legal,
  },
  {
    slug: 'business',
    nav: { label: 'Business reports & data', icon: LineChart },
    // "Upload reports and spreadsheets." made line 1 too long for one desktop row,
    // so it was shortened; spreadsheets are still named in the subhead (Excel).
    headline: [
      { text: 'Upload reports.', br: 'mobile' },
      { text: ' Paste website links.', br: 'always' },
    ],
    payoff: 'Walk in prepared.',
    subhead: 'Get key points, charts, slides, and quick answers from any report before your next meeting.',
    trust: [NOTHING_STORED, NO_SIGNUP],
    defaultMode: 'charts',
    meta: PAGE_SEO.business,
  },
]

// The use-case pages, in VARIANTS order — the navbar "Use cases" dropdown lists these.
export const USE_CASES = VARIANTS.filter(
  (v): v is LandingVariant & { nav: NonNullable<LandingVariant['nav']> } => !!v.nav,
)

// '/students', '/Students/', '/students/' → the students page; anything else → home.
export function getLandingVariant(pathname: string): LandingVariant {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  return VARIANTS.find((v) => v.slug === slug) ?? HOME_VARIANT
}

// Point the page's <title>, description, social tags and canonical URL at the
// variant, so /students isn't treated as a duplicate of the home page. The built
// /students.html (etc.) already carries these tags; this covers paths that fall
// back to the home shell, e.g. a trailing slash.
export function applyVariantMeta(variant: LandingVariant) {
  if (!variant.meta) return
  const { title, description } = variant.meta
  const url = `${SITE_URL}/${variant.slug}`
  document.title = title
  const set = (selector: string, attr: string, value: string) =>
    document.querySelector(selector)?.setAttribute(attr, value)
  set('meta[name="description"]', 'content', description)
  set('meta[property="og:title"]', 'content', title)
  set('meta[property="og:description"]', 'content', description)
  set('meta[property="og:url"]', 'content', url)
  set('meta[name="twitter:title"]', 'content', title)
  set('meta[name="twitter:description"]', 'content', description)
  set('link[rel="canonical"]', 'href', url)
}
