import { MessageBubble, MotionGlobalConfig } from 'talktofile'

MotionGlobalConfig.skipAnimations = true

const now = new Date('2026-10-08T10:30:00')

const sources = [
  {
    filename: 'Q3-board-report.pdf',
    text: 'Revenue for the quarter rose 18% year over year to $4.2M, driven mainly by enterprise renewals.',
    score: 0.91,
    chunk_index: 3,
  },
  {
    filename: 'Q3-board-report.pdf',
    text: 'Churn fell to 2.1%, the lowest level since the company began reporting the metric.',
    score: 0.84,
    chunk_index: 7,
  },
]

export const UserQuestion = () => (
  <MessageBubble
    username="Priya"
    message={{ id: 'u1', role: 'user', content: 'How did revenue and churn change this quarter?', timestamp: now }}
  />
)

export const AssistantAnswer = () => (
  <MessageBubble
    message={{
      id: 'a1',
      role: 'assistant',
      timestamp: now,
      content:
        'Revenue for the quarter rose **18% year over year** to $4.2M, driven mainly by enterprise renewals.\n\nOther highlights:\n\n- Churn fell to **2.1%**, the lowest since reporting began.\n- Enterprise renewals were the main growth driver.',
      sources,
    }}
  />
)

export const GuardReject = () => (
  <MessageBubble
    message={{
      id: 'g1',
      role: 'assistant',
      timestamp: now,
      isGuardReject: true,
      content: "I can only answer questions about your uploaded document. Try asking about what's in the report.",
    }}
  />
)
