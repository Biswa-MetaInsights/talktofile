import axios from 'axios'
import type { UserProfile, Plan } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

// Current auth token, kept in sync by AuthContext. Falls back to the legacy
// localStorage token when Supabase isn't in use.
let authToken: string | null = null
export function setAuthToken(token: string | null) {
  authToken = token
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
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/guest')
    // Let login/register/guest failures surface to the caller. For an expired
    // token mid-session, clear it and reload so the app re-bootstraps a guest.
    if (err.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('ttf_token')
      window.location.reload()
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
  register: (username: string, password: string, profile: UserProfile) =>
    api.post<AuthResponse>('/auth/register', { username, password, profile }),
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
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
  getSession: (sessionId: string) =>
    api.get(`/document/${sessionId}`),
  deleteSession: (sessionId: string) =>
    api.delete(`/document/${sessionId}`),
}

// The token is sent via the WebSocket subprotocol header (["bearer", <jwt>])
// rather than the URL, so it never appears in server access logs.
function openSocket(path: string, token: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return new WebSocket(`${proto}://${host}${path}`, ['bearer', token])
}

export function createProcessWebSocket(sessionId: string, token: string): WebSocket {
  return openSocket(`/api/document/process/${sessionId}`, token)
}

export function createChatWebSocket(sessionId: string, token: string): WebSocket {
  return openSocket(`/api/chat/${sessionId}`, token)
}

export default api
