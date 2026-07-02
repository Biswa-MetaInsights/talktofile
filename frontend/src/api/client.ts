import axios from 'axios'
import type { UserProfile, Plan, SessionInfo } from '../types'

// Absolute backend origin, for split deployments where the frontend and backend
// live on different hosts (e.g. Vercel + Render). Set VITE_API_URL to the backend
// base URL, e.g. "https://talktofile-api.onrender.com". Leave it UNSET for local
// dev (Vite proxies /api) and single-origin prod (Caddy serves both), where a
// relative "/api" on the same origin is correct.
export const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  timeout: 60000,
})

// Current auth token, kept in sync by AuthContext. Falls back to the legacy
// localStorage token when Supabase isn't in use.
let authToken: string | null = null
export function setAuthToken(token: string | null) {
  authToken = token
}

// True once the app itself triggers a full-page reload (e.g. the legacy fallback
// when no unauthorized handler is registered). The refresh guard checks this so it
// doesn't show a "Leave site?" prompt for a reload the app intentionally started.
let _programmaticReload = false
export const isProgrammaticReload = () => _programmaticReload

// Handler invoked when an authenticated request returns 401 (an expired/invalid
// session). AuthContext registers one that gracefully re-bootstraps a guest and
// prompts the user to sign in again — instead of a jarring full-page reload.
// Until one is registered we fall back to the old reload behaviour.
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn
}

api.interceptors.request.use((config) => {
  const token = authToken || localStorage.getItem('ttf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    const isAuthAttempt =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/guest') ||
      url.includes('/auth/refresh')
    // Let login/register/guest/refresh failures surface to the caller. For an
    // expired token mid-session, hand off to the registered handler (graceful
    // re-auth) or, if none, fall back to clearing the token and reloading.
    if (err.response?.status === 401 && !isAuthAttempt) {
      if (onUnauthorized) {
        onUnauthorized()
      } else {
        localStorage.removeItem('ttf_token')
        _programmaticReload = true
        window.location.reload()
      }
    }
    return Promise.reject(err)
  }
)

interface AuthResponse {
  access_token: string
  username: string
  plan: Plan
  is_guest: boolean
}

export const authApi = {
  guest: () => api.post<AuthResponse>('/auth/guest'),
  // Slide the current session's expiry forward (called periodically while active).
  refresh: () => api.post<AuthResponse>('/auth/refresh'),
  register: (username: string, password: string, profile: UserProfile) =>
    api.post<AuthResponse>('/auth/register', { username, password, profile }),
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<AuthResponse>('/auth/reset-password', { token, new_password: newPassword }),
  me: () =>
    api.get<{ username: string; plan: Plan; is_guest: boolean; persona: string | null; profile: UserProfile }>('/auth/me'),
  updateProfile: (profile: UserProfile) =>
    api.put<{ username: string; plan: Plan; is_guest: boolean; persona: string | null; profile: UserProfile }>('/auth/profile', profile),
  getPersona: () => api.get<{ persona: string | null }>('/auth/persona'),
  generatePersona: (role: string, specialty: string, address_as: string) =>
    api.post<{ persona: string | null }>('/auth/persona/generate', { role, specialty, address_as }),
  setPersona: (persona: string | null) =>
    api.put<{ persona: string | null }>('/auth/persona', { persona }),
}

export const feedbackApi = {
  submit: (payload: { message: string; rating?: number | null; category?: string; context?: string }) =>
    api.post<{ message: string }>('/feedback', payload),
  rateMessage: (payload: { vote: 1 | -1; session_id?: string; question?: string; answer_excerpt?: string }) =>
    api.post<{ message: string }>('/feedback/message', payload),
}

export const documentApi = {
  upload: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return api.post<{ session_id: string; filenames: string[] }>('/document/upload', form)
  },
  uploadUrl: (url: string) =>
    api.post<{ session_id: string; filenames: string[] }>('/document/url', { url }),
  getSession: (sessionId: string) =>
    api.get(`/document/${sessionId}`),
  deleteSession: (sessionId: string) =>
    api.delete(`/document/${sessionId}`),
  // Remove one document from a ready multi-file session; the survivors keep their
  // indexes (no re-processing). Returns the updated session.
  removeFile: (sessionId: string, filename: string) =>
    api.post<SessionInfo>(`/document/${sessionId}/remove-file`, { filename }),
}

export interface Flashcard {
  question: string
  answer: string
  hint?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface TranslateDoc {
  filename: string
  translated_text: string | null
  error: string | null
}

export interface PodcastLine {
  speaker: string
  text: string
}

export interface ChartSeries {
  name: string
  data: number[] | [number, number][]
}

export interface ChartData {
  chart_type: string
  title: string
  x_label: string
  y_label: string
  labels: string[]
  series: ChartSeries[]
}

export const toolsApi = {
  flashcards: (sessionId: string) =>
    api.post<{ flashcards: Flashcard[] }>(`/tools/flashcards/${sessionId}`),
  translate: (sessionId: string, targetLanguage: string) =>
    api.post<{ target_language: string; documents: TranslateDoc[]; note: string }>(
      `/tools/translate/${sessionId}`,
      { target_language: targetLanguage }
    ),
  podcast: (sessionId: string) =>
    api.post<{ script: PodcastLine[] }>(`/tools/podcast/${sessionId}`),
  extendPodcast: (sessionId: string, script: PodcastLine[], request: string) =>
    api.post<{ new_lines: PodcastLine[] }>(`/tools/podcast/${sessionId}/extend`, { script, request }),
  chart: (sessionId: string, chartType: string) =>
    api.post<ChartData>(`/tools/chart/${sessionId}`, { chart_type: chartType }),
  slidesDownloadUrl: (sessionId: string) => `${API_ORIGIN}/api/tools/slides/${sessionId}`,
  // Transcribe a recorded audio blob (voice dictation) via Whisper.
  transcribe: (audio: Blob) => {
    const form = new FormData()
    const ext = (audio.type.split('/')[1] || 'webm').split(';')[0]
    form.append('audio', audio, `dictation.${ext}`)
    return api.post<{ text: string }>('/tools/transcribe', form)
  },
}

// The token is sent via the WebSocket subprotocol header (["bearer", <jwt>])
// rather than the URL, so it never appears in server access logs.
function openSocket(path: string, token: string): WebSocket {
  // Point the socket at the configured backend origin when set (split deploy),
  // otherwise the current page origin (dev proxy / single-origin prod).
  let proto: string, host: string
  if (API_ORIGIN) {
    const u = new URL(API_ORIGIN)
    proto = u.protocol === 'https:' ? 'wss' : 'ws'
    host = u.host
  } else {
    proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    host = window.location.host
  }
  return new WebSocket(`${proto}://${host}${path}`, ['bearer', token])
}

export function createProcessWebSocket(sessionId: string, token: string): WebSocket {
  return openSocket(`/api/document/process/${sessionId}`, token)
}

export function createChatWebSocket(sessionId: string, token: string): WebSocket {
  return openSocket(`/api/chat/${sessionId}`, token)
}

export default api
