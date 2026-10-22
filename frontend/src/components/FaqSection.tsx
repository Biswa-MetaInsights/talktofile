import { HelpCircle } from 'lucide-react'
import type { Faq } from '../lib/landingSeo'

// "Frequently asked questions" block, shown directly above the footer on the
// use-case landing pages. Same section header and card look as Landing's
// "Who it's for" / "How it works" sections; every answer is always visible.
//
// ⚠️ vite.config.ts also renders this with react-dom/server at build time to bake
// the FAQ into each page's static HTML. Keep it pure markup: no hooks, no
// framer-motion (its `initial` would bake opacity:0 into the static HTML), no
// window/document, no imported assets.
export default function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 px-6 py-16 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="h-px w-8 bg-[#E2611B]/40" />
          <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">FAQ</span>
          <span className="h-px w-8 bg-[#E2611B]/40" />
        </div>
        <h2 id="faq-heading" className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] dark:text-slate-100 tracking-[-0.02em]">
          Frequently asked <span className="italic text-[#E2611B]">questions</span>
        </h2>
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-[#E2611B]/30" />
          <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
          <span className="h-px w-10 bg-[#E2611B]/30" />
        </div>
      </div>
      {/* Same breakpoints as Landing's Features grid: 1 column on phones, 2 from
          sm, all four in one row from lg. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {faqs.map(({ q, a }) => (
          <div
            key={q}
            className="group font-merriweather bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] dark:hover:bg-[#E2611B] hover:border-[#E2611B] dark:hover:border-[#E2611B] hover:shadow-md transition-all"
          >
            {/* Mobile (single column): icon + question sit side by side. From sm up
                (multi-column) they stack, icon on top. */}
            <div className="flex items-center gap-3 mb-1.5 sm:block sm:mb-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center sm:mb-4 transition-colors">
                <HelpCircle className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" aria-hidden />
              </div>
              <h3 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-white dark:group-hover:text-white sm:mb-1.5 transition-colors">{q}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-white dark:group-hover:text-white leading-relaxed transition-colors">{a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
