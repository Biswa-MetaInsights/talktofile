import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion } from 'framer-motion'
import {
  FileText, Upload, MessageSquare, Sparkles, Globe, Files, BookOpen, Link2,
  ShieldCheck, Lock, Zap, ArrowUp,
  GraduationCap, Scale, LineChart, HeartPulse, Briefcase, ScrollText,
} from 'lucide-react'
import { ACCEPT, ACCEPT_EXCEL } from './UploadZone'
import type { AppMode } from '../types'

interface Props {
  onGetStarted: (accepted?: File[], rejections?: FileRejection[], mode?: AppMode, url?: string) => void
}

const FORMATS = ['PDF', 'Word', 'Excel', 'PowerPoint', 'HTML', 'JSON', 'CSV', 'Text']

const STEPS = [
  { icon: Upload, title: 'Upload your document', body: 'Drop in a PDF, Word, Excel, PowerPoint and more, in any language.' },
  { icon: MessageSquare, title: 'Ask anything', body: 'Chat naturally. Summaries, specific facts, comparisons, calculations. Just ask.' },
  { icon: Sparkles, title: 'Get sourced answers', body: 'Your assistant answers only from your document, in clear English, with the file it came from.' },
]

const FEATURES = [
  { icon: FileText, title: 'Answers only from your file', body: 'Every answer is pulled straight from your document and shows where it came from. Nothing borrowed from the open web.' },
  { icon: ShieldCheck, title: 'It says “I don’t know”', body: 'If the answer isn’t in your file, you’ll be told. No guessing, no filling the gap.' },
  { icon: Lock, title: 'Nothing is stored', body: 'Your file lives in memory for one session and disappears on refresh. Never written to disk, never trained on.' },
  { icon: Zap, title: 'No account, no setup', body: 'Drop a file and start asking. No sign-up, no email, no paywall to read your document. Sign in only when you want to chat with several files at once.' },
  { icon: Globe, title: 'Any language in, English out', body: 'Supports more than 15+ languages, including Arabic, Chinese, Hindi and Spanish. Upload in any of them and get clear answers in English.' },
  { icon: Files, title: 'Works with any file', body: 'PDF, Word, Excel, PowerPoint and more. If it’s a document, you can talk to it.' },
  { icon: BookOpen, title: 'Handles long documents', body: 'Drop in a 200 page report or a whole textbook. Ask about any part of it, including tables and figures, without scrolling to find it.' },
  { icon: Link2, title: 'Talk to links too', body: 'Paste a web page or video link and ask about it, the same way you would a document.' },
]

const AUDIENCES = [
  { icon: GraduationCap, title: 'Students and researchers', body: 'Turn dense textbooks, lecture slides, and papers into summaries, flashcards, and quick answers, without reading every page.' },
  { icon: Scale, title: 'Legal and contracts', body: 'Pull clauses, deadlines, and obligations out of contracts, leases, and policies. Nothing you upload is stored, so client-sensitive files stay private.' },
  { icon: LineChart, title: 'Finance and analysts', body: 'Question your spreadsheets and reports, turn the tables into charts, and pull out the figures that matter. Every number comes straight from your file, never invented.' },
  { icon: HeartPulse, title: 'Healthcare and personal docs', body: 'Make sense of lab results, medical letters, and insurance documents in plain English, privately, with no account.' },
  { icon: Briefcase, title: 'Professionals and consultants', body: 'Get through long reports, manuals, and meeting notes fast, and ask exactly what you need to know.' },
  { icon: ScrollText, title: 'Anyone reading the fine print', body: 'Terms of service, warranties, rental agreements. Find out what you are actually agreeing to in seconds.' },
]

const MODES: { value: AppMode; label: string; blurb: string }[] = [
  { value: 'chat', label: 'Chat', blurb: 'Ask anything in plain language and get answers pulled straight from your file. Follow-up questions remember what you already asked.' },
  { value: 'summary', label: 'Summary', blurb: 'Turn a long document into a clear, structured summary. The key points, without reading every page.' },
  { value: 'flashcards', label: 'Flashcards', blurb: 'Generate study-ready flashcards from any document. Useful for revision, onboarding, or learning something new fast.' },
  { value: 'slides', label: 'Slides', blurb: 'Turn a report or dense document into a clean slide deck you can present or share.' },
  { value: 'translate', label: 'Translate', blurb: 'Read documents in any language. Upload in one, get clear results in another.' },
  { value: 'podcast', label: 'Podcasts', blurb: 'Turn your document into a natural, listenable audio rundown for when you’d rather listen than read.' },
  { value: 'charts', label: 'Charts', blurb: 'Turn the tables in your file into bar, line, or pie charts, and more. See the numbers, don’t just read them.' },
]

export default function Landing({ onGetStarted }: Props) {
  const [activeMode, setActiveMode] = useState<AppMode>('chat')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')

  const handleAddUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('Please enter a full URL starting with https://')
      return
    }
    setUrlError('')
    onGetStarted(undefined, undefined, 'chat', trimmed)
  }

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    if (accepted.length > 0 || rejections.length > 0) {
      onGetStarted(accepted, rejections, activeMode)
    }
  }, [onGetStarted, activeMode])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: activeMode === 'charts' ? ACCEPT_EXCEL : ACCEPT,
  })

  return (
    <div className="min-h-screen bg-slate-50 bg-grid">
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-merriweather font-extrabold tracking-[-0.03em] text-[#303030] text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
            Upload files. Paste Website links.<br />
            <span className="italic text-[#E2611B]">Ask anything.</span>
          </h1>
          <p className="mt-6 font-merriweather text-lg text-[#303030] mx-auto leading-relaxed md:whitespace-nowrap">
            Upload anything in any language. Get answers in seconds, drawn only from your file.
          </p>

          {/* Upload card — drop a file, paste a link, pick a mode. */}
          <div className="mt-10 max-w-2xl mx-auto text-left">
            {/* Mode tabs — selecting changes the active tab only (no navigation) */}
            <div className="overflow-x-auto pb-1 -mx-6 px-6 scrollbar-none">
              <div className="inline-flex items-center gap-1 rounded-full border border-[#303030] bg-[#F8FAFC] p-1 min-w-max">
                {MODES.map(({ value, label }) => {
                  const isActive = activeMode === value
                  return (
                    <button
                      key={value}
                      onClick={() => setActiveMode(value)}
                      className="relative text-sm font-medium px-4 py-1.5 rounded-full"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="mode-spotlight"
                          className="absolute inset-0 rounded-full bg-[#E2611B] shadow-sm"
                          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                        />
                      )}
                      <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-700 hover:text-[#E2611B]'}`}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* One-line blurb for the selected mode */}
            <motion.p
              key={activeMode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 text-center text-sm text-slate-500"
            >
              {MODES.find((m) => m.value === activeMode)?.blurb}
            </motion.p>

            {/* Drop zone — accepts a real file and hands it to the upload pipeline */}
            <div
              {...getRootProps()}
              className={`mt-6 rounded-2xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-[#E2611B] bg-[#E2611B]/5' : 'border-[#303030] bg-white hover:border-[#E2611B] hover:bg-[#E2611B]/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E2611B]/10 mb-4">
                <ArrowUp className="w-6 h-6 text-[#E2611B]" />
              </div>
              <p className="text-slate-800 font-medium">
                {isDragActive
                  ? 'Drop your document here'
                  : <>Drop a document, or <span className="text-[#E2611B] underline underline-offset-2">browse to upload</span></>}
              </p>
              <p className="mt-1.5 text-sm text-slate-400">PDF · Word · Excel · PowerPoint</p>
            </div>

            {/* OR divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400 tracking-wider">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Paste a link */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-[#303030] bg-white px-4 hover:border-[#E2611B] focus-within:border-[#E2611B] focus-within:ring-2 focus-within:ring-[#E2611B]/20 transition-all">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                    placeholder="Paste a webpage or video link"
                    className="flex-1 bg-transparent py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddUrl}
                  className="px-6 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all"
                >
                  Add
                </button>
              </div>
              {urlError && (
                <p className="text-xs text-red-500 px-1">{urlError}</p>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">How it works</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] tracking-[-0.02em]">
            Three steps. <span className="italic text-[#E2611B]">No setup.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-slate-500 italic">No learning curve, no account, no waiting.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                {/* Step number to the left of the icon */}
                <span className="w-8 h-8 rounded-full bg-[#E2611B] text-white group-hover:bg-white group-hover:text-[#E2611B] text-sm font-bold flex items-center justify-center transition-colors">{i + 1}</span>
                <div className="w-10 h-10 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center transition-colors">
                  <s.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-white mb-1.5 transition-colors">{s.title}</h3>
              <p className="text-sm text-slate-600 group-hover:text-white leading-relaxed transition-colors">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">Features</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] tracking-[-0.02em]">
            Built to be <span className="italic text-[#E2611B]">trusted.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-slate-500 italic">Grounded answers, zero storage, no account required.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.08 }}
              className="group font-merriweather bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center mb-4 transition-colors">
                <f.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-white mb-1.5 transition-colors">{f.title}</h3>
              <p className="text-sm text-slate-600 group-hover:text-white leading-relaxed transition-colors">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#E2611B]/40" />
            <span className="text-xs font-semibold tracking-[0.25em] text-[#E2611B] uppercase">Who it's for</span>
            <span className="h-px w-8 bg-[#E2611B]/40" />
          </div>
          <h2 className="font-merriweather font-bold text-3xl sm:text-4xl md:text-5xl text-[#303030] tracking-[-0.02em]">
            One tool, <span className="italic text-[#E2611B]">many use cases.</span>
          </h2>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#E2611B]/30" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#E2611B]" />
            <span className="h-px w-10 bg-[#E2611B]/30" />
          </div>
          <p className="mt-3 text-slate-500 italic">Grounded in your file, private by default, whatever you’re using it for.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="group font-merriweather bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:bg-[#E2611B] hover:border-[#E2611B] hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E2611B]/10 border border-[#E2611B]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center mb-4 transition-colors">
                <a.icon className="w-5 h-5 text-[#E2611B] group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-white mb-1.5 transition-colors">{a.title}</h3>
              <p className="text-sm text-slate-600 group-hover:text-white leading-relaxed transition-colors">{a.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#E2611B] text-slate-50 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            {/* Brand — inverted wordmark for the orange surface (see CLAUDE.md) */}
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shadow-sm">
                  <FileText className="w-3.5 h-3.5 text-[#E2611B]" />
                </div>
                <span className="font-brand italic font-bold text-[34px] tracking-[-0.02em] text-slate-50">
                  Talktofile
                </span>
              </div>
            </div>

            {/* Quick links */}
            <nav className="flex flex-col gap-2.5 text-sm">
              <span className="font-semibold text-slate-50">Product</span>
              <a href="#how-it-works" className="text-slate-50/80 hover:text-slate-50 transition-colors">How it works</a>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-slate-50/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-50/80">
            <span>© {new Date().getFullYear()} MetaInsights. All rights reserved.</span>
            <span>Private by default · No file storage · Answers only from your document</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
