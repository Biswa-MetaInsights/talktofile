import { SummaryCard } from 'talktofile'

const summary = {
  doc_type: 'Research paper',
  overview:
    'This paper evaluates retrieval-augmented generation on long legal contracts and finds that chunking by clause, rather than by fixed token windows, cuts unsupported answers by 41% while keeping latency flat.',
  key_points: [
    'Clause-level chunking outperforms 512-token windows on every benchmark tested.',
    'Answers that cite two or more passages are rated more trustworthy by reviewers.',
    'Re-ranking adds ~120ms but removes most off-topic citations.',
  ],
  topics: ['retrieval', 'legal contracts', 'chunking', 'evaluation'],
}

export const Default = () => (
  <div className="glass-card rounded-2xl p-5 max-w-xl">
    <SummaryCard summary={summary} />
  </div>
)

export const Compact = () => (
  <div className="glass-card rounded-2xl p-4 w-80">
    <SummaryCard summary={summary} compact />
  </div>
)

export const OverviewOnly = () => (
  <div className="glass-card rounded-2xl p-5 max-w-xl">
    <SummaryCard
      summary={{
        doc_type: 'Invoice',
        overview: 'Invoice #4821 from Northwind Supplies for 120 units of printer paper, due 14 November.',
        key_points: [],
        topics: [],
      }}
    />
  </div>
)
