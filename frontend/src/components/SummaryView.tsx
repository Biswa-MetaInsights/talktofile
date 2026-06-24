import { MessageSquare, FileText, Tag, List } from 'lucide-react'
import type { SessionInfo } from '../types'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

export default function SummaryView({ session, onStartChat }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-brand font-bold text-xl text-slate-900">Document Summary</h2>
        <button
          onClick={onStartChat}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          Start chatting
        </button>
      </div>

      {session.documents.map((doc, idx) => {
        const s = doc.summary
        return (
          <div key={idx} className="flex flex-col gap-4">
            {session.documents.length > 1 && (
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
                <FileText className="w-4 h-4" />
                {doc.filename}
              </div>
            )}

            {/* Document type badge */}
            {s?.doc_type && (
              <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-xs font-semibold bg-[#E2611B]/10 text-[#E2611B] border border-[#E2611B]/20">
                <FileText className="w-3 h-3" />
                {s.doc_type}
              </span>
            )}

            {/* Overview */}
            {s?.overview && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-2 text-sm uppercase tracking-wide text-brand-600">Overview</h3>
                <p className="text-slate-700 leading-relaxed text-sm">{s.overview}</p>
              </div>
            )}

            {/* Key points */}
            {s?.key_points?.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <List className="w-4 h-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide text-brand-600">Key Points</h3>
                </div>
                <ul className="space-y-2.5">
                  {s.key_points.map((point: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-1 w-5 h-5 rounded-full bg-[#E2611B]/10 text-[#E2611B] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics */}
            {s?.topics?.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide text-brand-600">Topics Covered</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.topics.map((topic: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {idx < session.documents.length - 1 && (
              <hr className="border-slate-200" />
            )}
          </div>
        )
      })}

      {/* Suggested questions */}
      {session.suggested_questions?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Want to explore further?</p>
          <div className="flex flex-col gap-2">
            {session.suggested_questions.slice(0, 4).map((q, i) => (
              <button
                key={i}
                onClick={onStartChat}
                className="text-left text-sm text-brand-600 hover:text-[#E2611B] bg-white border border-slate-200 hover:border-[#E2611B] rounded-xl px-4 py-2.5 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onStartChat}
        className="self-center flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E2611B] text-white font-medium text-sm hover:bg-[#E2611B]/90 transition-all shadow-md shadow-[#E2611B]/20"
      >
        <MessageSquare className="w-4 h-4" />
        Chat with your document
      </button>
    </div>
  )
}
