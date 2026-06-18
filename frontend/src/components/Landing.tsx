import { motion } from 'framer-motion'
import {
  FileText, Upload, MessageSquare, Sparkles, Globe, GitCompare,
  Table2, ShieldCheck, Lock, Zap, ArrowRight, Check, LogIn,
} from 'lucide-react'

interface Props {
  onGetStarted: () => void
  onSignIn: () => void
}

const FORMATS = ['PDF', 'Word', 'Excel', 'PowerPoint', 'HTML', 'JSON', 'CSV', 'Text']

const STEPS = [
  { icon: Upload, title: 'Upload your document', body: 'Drop in a PDF, Word, Excel, PowerPoint and more — in any language.' },
  { icon: MessageSquare, title: 'Ask anything', body: 'Chat naturally. Summaries, specific facts, comparisons, calculations — just ask.' },
  { icon: Sparkles, title: 'Get sourced answers', body: 'Sage answers only from your document, in clear English, with the file it came from.' },
]

const FEATURES = [
  { icon: Globe, title: 'Any language in, English out', body: 'Upload documents in Malayalam, Arabic, French — anything. Sage answers in English.' },
  { icon: GitCompare, title: 'Compare documents', body: 'Upload several files and surface differences, similarities and contradictions.' },
  { icon: Table2, title: 'Spreadsheet intelligence', body: 'Real calculations on your tables — using only the numbers in your file, never made up.' },
  { icon: ShieldCheck, title: 'No hallucinations', body: 'If the answer isn’t in your document, Sage says so. It never invents facts.' },
  { icon: Lock, title: 'Private by design', body: 'Your documents live in memory only and vanish when your session ends. Nothing stored.' },
  { icon: Zap, title: 'Instant & streaming', body: 'Answers stream in real time. No waiting, no friction — just drop a file and talk.' },
]

function Header({ onGetStarted, onSignIn }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm shadow-indigo-200">
          <FileText className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-brand font-bold text-[15px] tracking-[-0.02em] text-slate-900">TalkToFile</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSignIn} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5">
          <LogIn className="w-4 h-4" /> <span className="hidden sm:block">Sign in</span>
        </button>
        <button onClick={onGetStarted} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium shadow-sm hover:bg-indigo-700 transition-all">
          Get started
        </button>
      </div>
    </header>
  )
}

export default function Landing({ onGetStarted, onSignIn }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 bg-grid">
      <Header onGetStarted={onGetStarted} onSignIn={onSignIn} />

      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Private by design
          </span>
          <h1 className="font-brand font-extrabold tracking-[-0.03em] text-slate-900 text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
            Every document<br />
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">has answers.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            TalkToFile reads it so you don’t have to — upload anything, in any language,
            and get accurate, sourced answers in seconds.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="group flex items-center gap-2 text-base font-semibold px-6 py-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              Get started — it’s free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">No credit card · Try instantly as a guest</p>

          {/* Supported formats strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {FORMATS.map((f) => (
              <span key={f} className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">{f}</span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
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
              className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
            >
              <span className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-indigo-200">{i + 1}</span>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5 text-indigo-600" />
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
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Privacy band */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-center shadow-xl shadow-indigo-200">
          <Lock className="w-10 h-10 text-white/90 mx-auto mb-4" />
          <h2 className="font-brand font-bold text-2xl sm:text-3xl text-white tracking-[-0.02em]">Your documents never leave your session</h2>
          <p className="mt-3 text-indigo-100 max-w-2xl mx-auto leading-relaxed">
            Files are processed in memory and discarded the moment you’re done — never written to disk,
            never used for training. Privacy isn’t a setting here; it’s how the product is built.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-indigo-100">
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
          onClick={onGetStarted}
          className="group mt-6 inline-flex items-center gap-2 text-base font-semibold px-6 py-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
        >
          Get started — it’s free
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="font-brand font-bold text-slate-700">TalkToFile</span>
          </div>
          <span>© {new Date().getFullYear()} TalkToFile · Private document intelligence</span>
        </div>
      </footer>
    </div>
  )
}
