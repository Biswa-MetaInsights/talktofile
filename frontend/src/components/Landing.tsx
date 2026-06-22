import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { motion } from 'framer-motion'
import {
  FileText, Upload, MessageSquare, Sparkles, Globe, GitCompare,
  Table2, ShieldCheck, Lock, Zap, ArrowRight, Check, ArrowUp,
} from 'lucide-react'
import { ACCEPT } from './UploadZone'

interface Props {
  // Called to enter the app. When the user drops/picks files on the hero dropbox,
  // they're passed through so UploadZone can validate + process them automatically.
  onGetStarted: (accepted?: File[], rejections?: FileRejection[]) => void
}

const FORMATS = ['PDF', 'Word', 'Excel', 'PowerPoint', 'HTML', 'JSON', 'CSV', 'Text']

const STEPS = [
  { icon: Upload, title: 'Upload your document', body: 'Drop in a PDF, Word, Excel, PowerPoint and more — in any language.' },
  { icon: MessageSquare, title: 'Ask anything', body: 'Chat naturally. Summaries, specific facts, comparisons, calculations — just ask.' },
  { icon: Sparkles, title: 'Get sourced answers', body: 'Sage answers only from your document, in clear English, with the file it came from.' },
]

const FEATURES = [
  { icon: Globe, title: 'Any language in, English out', body: 'Upload documents in Arabic, French, German, Dutch, Spanish, Chinese — virtually any language. Sage always answers in clear English.' },
  { icon: GitCompare, title: 'Compare documents', body: 'Upload several files and surface differences, similarities and contradictions.' },
  { icon: Table2, title: 'Spreadsheet intelligence', body: 'Real calculations on your tables — using only the numbers in your file, never made up.' },
  { icon: ShieldCheck, title: 'No hallucinations', body: 'If the answer isn’t in your document, Sage says so. It never invents facts.' },
  { icon: Lock, title: 'Private by design', body: 'Your documents live in memory only and vanish when your session ends. Nothing stored.' },
  { icon: Zap, title: 'Instant & streaming', body: 'Answers stream in real time. No waiting, no friction — just drop a file and talk.' },
]

// Mode tabs shown on the hero upload card. Selecting one only changes the active
// tab on this page — no navigation, no backend. (Output wiring comes later.)
const MODES = ['Chat', 'Summary', 'Flashcards', 'Slides', 'Translate', 'Podcasts']

export default function Landing({ onGetStarted }: Props) {
  const [activeMode, setActiveMode] = useState('Chat')

  // Hand any dropped/selected files to UploadZone (via onGetStarted), which runs
  // the existing file-count/size/type validation and the upload→chat pipeline.
  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    if (accepted.length > 0 || rejections.length > 0) onGetStarted(accepted, rejections)
  }, [onGetStarted])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT })

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
            <span className="text-[#E60026]">Ask anything.</span>
          </h1>
          <p className="mt-6 font-merriweather text-lg text-[#303030] mx-auto leading-relaxed md:whitespace-nowrap">
            Upload anything in any language. Get answers in seconds, drawn only from your file.
          </p>

          {/* Upload card — drop a file, paste a link, pick a mode. */}
          <div className="mt-10 max-w-2xl mx-auto text-left">
            {/* Mode tabs — selecting changes the active tab only (no navigation) */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-full border border-[#303030] bg-[#F8FAFC] p-1">
                {MODES.map((label) => {
                  const isActive = activeMode === label
                  return (
                    <button
                      key={label}
                      onClick={() => setActiveMode(label)}
                      className="relative text-sm font-medium px-4 py-1.5 rounded-full"
                    >
                      {/* The "spotlight" — a single shared pill that slides
                          laterally between tabs when the selection changes. */}
                      {isActive && (
                        <motion.span
                          layoutId="mode-spotlight"
                          className="absolute inset-0 rounded-full bg-[#E60026] shadow-sm"
                          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                        />
                      )}
                      <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-700 hover:text-[#E60026]'}`}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Drop zone — accepts a real file and hands it to the upload pipeline */}
            <div
              {...getRootProps()}
              className={`mt-6 rounded-2xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-[#E60026] bg-[#E60026]/5' : 'border-[#303030] bg-white hover:border-[#E60026] hover:bg-[#E60026]/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E60026]/10 mb-4">
                <ArrowUp className="w-6 h-6 text-[#E60026]" />
              </div>
              <p className="text-slate-800 font-medium">
                {isDragActive
                  ? 'Drop your document here'
                  : <>Drop a document, or <span className="text-[#E60026] underline underline-offset-2">browse to upload</span></>}
              </p>
              <p className="mt-1.5 text-sm text-slate-400">PDF · Word · Excel · PowerPoint · EPUB · images</p>
            </div>

            {/* OR divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400 tracking-wider">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Paste a link */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-[#303030] bg-white px-4 hover:border-[#E60026] focus-within:border-[#E60026] focus-within:ring-2 focus-within:ring-[#E60026]/20 transition-all">
                <input
                  type="text"
                  placeholder="Paste a webpage or video link"
                  className="flex-1 bg-transparent py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
              <button
                onClick={() => onGetStarted()}
                className="px-6 rounded-xl bg-[#E60026] text-white font-medium text-sm hover:bg-[#E60026]/90 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-brand font-bold text-2xl sm:text-3xl text-slate-900 tracking-[-0.02em]">How it works</h2>
          <p className="mt-2 text-slate-500">Three steps. No setup, no learning curve.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-[#E60026] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                {/* Step number to the left of the icon */}
                <span className="w-8 h-8 rounded-full bg-[#E60026] text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                <div className="w-10 h-10 rounded-xl bg-[#E60026]/10 border border-[#E60026]/20 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-[#E60026]" />
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-brand font-bold text-2xl sm:text-3xl text-slate-900 tracking-[-0.02em]">Built to be trusted</h2>
          <p className="mt-2 text-slate-500">Accurate, private, and genuinely useful on real work.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="group font-merriweather bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:bg-[#E60026] hover:border-[#E60026] hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E60026]/10 border border-[#E60026]/20 group-hover:bg-white/15 group-hover:border-white/30 flex items-center justify-center mb-4 transition-colors">
                <f.icon className="w-5 h-5 text-[#E60026] group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-white mb-1.5 transition-colors">{f.title}</h3>
              <p className="text-sm text-slate-600 group-hover:text-white leading-relaxed transition-colors">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Privacy band */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#E60026] to-[#b3001e] rounded-3xl p-8 sm:p-12 text-center shadow-xl shadow-[#E60026]/20">
          <Lock className="w-10 h-10 text-white/90 mx-auto mb-4" />
          <h2 className="font-brand font-bold text-2xl sm:text-3xl text-white tracking-[-0.02em]">Your documents never leave your session</h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto leading-relaxed">
            Files are processed in memory and discarded the moment you’re done — never written to disk,
            never used for training. Privacy isn’t a setting here; it’s how the product is built.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
            {['No file storage', 'No training on your data', 'Answers only from your document'].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><Check className="w-4 h-4" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pt-8 pb-24 text-center">
        <h2 className="font-brand font-bold text-3xl text-slate-900 tracking-[-0.02em]">Ready to talk to your file?</h2>
        <p className="mt-2 text-slate-500">Upload a document and get your first answer in under a minute.</p>
        <button
          onClick={() => onGetStarted()}
          className="group mt-6 inline-flex items-center gap-2 text-base font-semibold px-6 py-3 rounded-xl bg-[#E60026] text-white shadow-lg shadow-[#E60026]/20 hover:bg-[#E60026]/90 transition-all"
        >
          Get started — it’s free
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#E60026] flex items-center justify-center">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="font-brand font-bold text-[#E60026]">TalkToFile</span>
          </div>
          <span>© {new Date().getFullYear()} TalkToFile · Private document intelligence</span>
        </div>
      </footer>
    </div>
  )
}
