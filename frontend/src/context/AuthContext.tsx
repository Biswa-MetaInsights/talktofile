import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, setAuthToken } from '../api/client'
import { supabase, SUPABASE_ENABLED } from '../lib/supabase'
import { identifyUser, track, resetAnalytics } from '../lib/analytics'
import type { User, UserProfile } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  // identifier = username (legacy) or email (Supabase)
  login: (identifier: string, password: string) => Promise<void>
  register: (identifier: string, password: string, profile: UserProfile) => Promise<void>
  logout: () => void
  setPersona: (persona: string | null) => void
  isLoading: boolean
  // Password reset (Supabase mode). resetPassword emails a recovery link;
  // recoveryMode becomes true when the user returns via that link; updatePassword
  // sets the new password.
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  recoveryMode: boolean
  clearRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const TOKEN_KEY = 'ttf_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  return SUPABASE_ENABLED ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <LegacyAuthProvider>{children}</LegacyAuthProvider>
  )
}

/* ----------------------------- Supabase mode ----------------------------- */

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const hydrate = async (accessToken: string, isAnonymous: boolean) => {
    setAuthToken(accessToken)
    setToken(accessToken)
    // If the user signed up while email confirmation was required, their profile
    // was stashed pending verification — apply it now that they're really signed in.
    if (!isAnonymous) {
      const pending = localStorage.getItem('ttf_pending_profile')
      if (pending) {
        try { await authApi.updateProfile(JSON.parse(pending)) } catch { /* best-effort */ }
        localStorage.removeItem('ttf_pending_profile')
      }
    }
    try {
      const me = await authApi.me()
      setUser({
        username: me.data.username,
        plan: me.data.plan,
        is_guest: me.data.is_guest,
        persona: me.data.persona,
        profile: me.data.profile,
      })
      if (!isAnonymous) identifyUser(me.data.username, { plan: me.data.plan })
    } catch {
      // Backend unreachable — still mark the session so the app can show an error.
      setUser({ username: 'user', plan: isAnonymous ? 'free' : 'free', is_guest: isAnonymous, persona: null })
    }
  }

  useEffect(() => {
    let cancelled = false
    const sb = supabase!

    const boot = async () => {
      const { data } = await sb.auth.getSession()
      if (cancelled) return
      if (data.session) {
        await hydrate(data.session.access_token, !!data.session.user.is_anonymous)
      } else {
        // No session yet → sign in anonymously to act as a guest.
        await sb.auth.signInAnonymously()
        // onAuthStateChange will hydrate.
      }
      if (!cancelled) setIsLoading(false)
    }
    boot()

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      // User clicked the password-reset link — show the "set new password" UI.
      if (_event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (session) {
        await hydrate(session.access_token, !!session.user.is_anonymous)
      } else {
        setAuthToken(null)
        setToken(null)
        setUser(null)
      }
    })

    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const register = async (email: string, password: string, profile: UserProfile) => {
    const { data, error } = await supabase!.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    track('signup_submitted', { method: 'email' })
    if (!data.session) {
      // Email confirmation is enabled — no session yet. Stash the profile so it's
      // saved once the user clicks the verification link and signs in.
      localStorage.setItem('ttf_pending_profile', JSON.stringify({ ...profile, email }))
      throw new Error('Account created — check your email to confirm, then sign in.')
    }
    await hydrate(data.session.access_token, false)
    await authApi.updateProfile({ ...profile, email })
    const me = await authApi.me()
    setUser({
      username: me.data.username, plan: me.data.plan, is_guest: me.data.is_guest,
      persona: me.data.persona, profile: me.data.profile,
    })
  }

  const logout = async () => {
    resetAnalytics()
    await supabase!.auth.signOut()
    await supabase!.auth.signInAnonymously()
  }

  const setPersona = (persona: string | null) =>
    setUser((prev) => (prev ? { ...prev, persona } : prev))

  const resetPassword = async (email: string) => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) throw new Error(error.message)
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    setRecoveryMode(false)
  }

  const clearRecovery = () => setRecoveryMode(false)

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, setPersona, isLoading, resetPassword, updatePassword, recoveryMode, clearRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

/* ------------------------------ Legacy mode ------------------------------ */

function LegacyAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true)

  const applyToken = (accessToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setAuthToken(accessToken)
    setToken(accessToken)
  }

  useEffect(() => {
    let cancelled = false

    const startGuest = async () => {
      try {
        const res = await authApi.guest()
        if (cancelled) return
        applyToken(res.data.access_token)
        setUser({ username: res.data.username, plan: res.data.plan, is_guest: res.data.is_guest, persona: null })
      } catch { /* surfaced as a retryable error in the UI */ }
    }

    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      setAuthToken(stored)
      authApi.me()
        .then((res) => {
          if (cancelled) return
          setUser({
            username: res.data.username, plan: res.data.plan, is_guest: res.data.is_guest,
            persona: res.data.persona, profile: res.data.profile,
          })
        })
        .catch(async () => {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          await startGuest()
        })
        .finally(() => !cancelled && setIsLoading(false))
    } else {
      startGuest().finally(() => !cancelled && setIsLoading(false))
    }

    return () => { cancelled = true }
  }, [])

  const hydrateUser = async () => {
    const me = await authApi.me()
    setUser({
      username: me.data.username, plan: me.data.plan, is_guest: me.data.is_guest,
      persona: me.data.persona, profile: me.data.profile,
    })
  }

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    applyToken(res.data.access_token)
    await hydrateUser()
  }

  const register = async (username: string, password: string, profile: UserProfile) => {
    const res = await authApi.register(username, password, profile)
    applyToken(res.data.access_token)
    await hydrateUser()
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
    setToken(null)
    setUser(null)
    authApi.guest().then((res) => {
      applyToken(res.data.access_token)
      setUser({ username: res.data.username, plan: res.data.plan, is_guest: res.data.is_guest, persona: null })
    }).catch(() => {})
  }

  const setPersona = (persona: string | null) =>
    setUser((prev) => (prev ? { ...prev, persona } : prev))

  // Password reset isn't available in legacy (non-Supabase) mode.
  const resetPassword = async () => { throw new Error('Password reset isn’t available in this mode.') }
  const updatePassword = async () => { throw new Error('Password reset isn’t available in this mode.') }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, setPersona, isLoading, resetPassword, updatePassword, recoveryMode: false, clearRecovery: () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
