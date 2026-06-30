export type Plan = 'free' | 'pro'
export type AppMode = 'chat' | 'summary' | 'flashcards' | 'slides' | 'translate' | 'podcast' | 'charts'

export interface UserProfile {
  full_name?: string
  email?: string
  phone?: string
  company_name?: string
  company_role?: string
  company_size?: string
  industry?: string
  /** Profile photo as a small, client-downscaled image data URL ("" when none). */
  avatar?: string
}

export interface User {
  username: string
  plan: Plan
  is_guest: boolean
  persona?: string | null
  profile?: UserProfile
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Source {
  filename: string
  text: string
  score: number
  chunk_index?: number
  context_before?: string
  context_after?: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isStreaming?: boolean
  isGuardReject?: boolean
  isPeriodicFeedback?: boolean
  sources?: Source[]
  followups?: string[]
}

export type SessionMode = 'single' | 'compare' | 'multi'

export interface DocumentSummary {
  overview: string
  doc_type: string
  key_points: string[]
  topics: string[]
}

export interface DocumentInfo {
  filename: string
  original_language: string
  summary: DocumentSummary
}

export interface SessionInfo {
  session_id: string
  documents: DocumentInfo[]
  mode: SessionMode
  suggested_questions: string[]
  ready: boolean
}

export type PipelineStage =
  | 'extracting'
  | 'analysing'
  | 'ready'
  | 'error'

export interface PipelineUpdate {
  stage: PipelineStage
  message: string
  mode?: SessionMode
  suggested_questions?: string[]
  documents?: DocumentInfo[]
}

// Plan limits — kept in sync with backend core/config.py
export const PLAN_LIMITS: Record<Plan, { maxFiles: number; maxSizeMb: number }> = {
  free: { maxFiles: 1, maxSizeMb: 5 },
  pro: { maxFiles: 5, maxSizeMb: 8 },
}
