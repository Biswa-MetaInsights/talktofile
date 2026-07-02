import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { authApi, setAuthToken, setUnauthorizedHandler } from '../api/client'
import { supabase, SUPABASE_ENABLED } from '../lib/supabase'
import { identifyUser, track, resetAnalytics } from '../lib/analytics'
import type { User, UserProfile } from '../types'

// Supabase provider ids. 'azure' is Microsoft's provider id in Supabase.
export type OAuthProvider = 'google' | 'azure'

interface AuthContextValue {
  user: User | null
  token: string | null
  // identifier = username (legacy) or email (Supabase)
  login: (identifier: string, password: string) => Promise<void>
  register: (identifier: string, password: string, profile: UserProfile) => Promise<void>
  // Social sign-in via an OAuth provider (Supabase mode only). Redirects the
  // browser to the provider; on return, onAuthStateChange hydrates the session.
  // Throws in legacy mode (no OAuth identity provider configured).
  signInWithProvider: (provider: OAuthProvider) => Promise<void>
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
  // Save editable profile details (everything except email/username).
  saveProfile: (profile: UserProfile) => Promise<void>
  // True when an authenticated request 401'd (the session expired). The app
  // re-bootstraps a guest under the hood and uses this to prompt a fresh sign in.
  sessionExpired: boolean
  clearSessionExpired: () => void
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
  const [sessionExpired, setSessionExpired] = useState(false)

  // Latest user, readable from the (render-independent) 401 handler below.
  const userRef = useRef<User | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  // Graceful handling of an expired/invalid session (a 401 on an authed request).
  // Supabase normally auto-refreshes its token, so this is a safety net: re-sync to
  // a guest session and, if the user was actually signed in, prompt a fresh sign in.
  useEffect(() => {
    const handlingRef = { current: false }
    setUnauthorizedHandler(() => {
      if (handlingRef.current) return
      handlingRef.current = true
      if (userRef.current && !userRef.current.is_guest) setSessionExpired(true)
      supabase!.auth.signOut()
        .then(() => supabase!.auth.signInAnonymously())
        .catch(() => {})
        .finally(() => { handlingRef.current = false })
    })
    return () => setUnauthorizedHandler(null)
  }, [])

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

  const signInWithProvider = async (provider: OAuthProvider) => {
    track('signin_submitted', { method: provider })
    const { error } = await supabase!.auth.signInWithOAuth({
      provider,
      options: {
        // Return to the app; onAuthStateChange picks up the new session.
        redirectTo: window.location.origin,
        // Microsoft/Azure needs an explicit scope to return the email claim.
        ...(provider === 'azure' ? { scopes: 'email openid profile' } : {}),
      },
    })
    if (error) throw new Error(error.message)
    // On success the browser is redirecting — nothing else to do here.
  }

  const register = async (email: string, password: string, profile: UserProfile) => {
    const { data, error } = await supabase!.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    track('signup_submitted', { method: 'email' })
    if (!data.session) {
      // Email confirmation is enabled — no session yet. Stash the profile so it's
      // saved once the user clicks the verification link and signs in.
      localStorage.setItem('ttf_pending_profile', JSON.stringify({ ...profile, email }))
      throw new Error('Account created. Check your email to confirm, then sign in.')
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

  const saveProfile = async (profile: UserProfile) => {
    const me = await authApi.updateProfile(profile)
    setUser((prev) => prev ? {
      ...prev, plan: me.data.plan, is_guest: me.data.is_guest,
      persona: me.data.persona, profile: me.data.profile,
    } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, signInWithProvider, logout, setPersona, isLoading, resetPassword, updatePassword, recoveryMode, clearRecovery, saveProfile, sessionExpired, clearSessionExpired: () => setSessionExpired(false) }}>
      {children}
    </AuthContext.Provider>
  )
}

/* ------------------------------ Legacy mode ------------------------------ */

// The reset link is `${origin}/reset-password?token=...`. Pull it out of the URL
// (regardless of path) so we can show the "set a new password" form on load.
function readResetToken(): string | null {
  try { return new URLSearchParams(window.location.search).get('token') } catch { return null }
}

function LegacyAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true)
  // Reset token carried in from the email link → drives recoveryMode.
  const [resetToken, setResetToken] = useState<string | null>(() => readResetToken())
  const [sessionExpired, setSessionExpired] = useState(false)

  // Latest user, readable from the (render-independent) 401 handler below.
  const userRef = useRef<User | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  const applyToken = (accessToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setAuthToken(accessToken)
    setToken(accessToken)
  }

  // Graceful handling of an expired/invalid token (a 401 on an authed request).
  // Instead of a jarring full-page reload, transparently re-bootstrap a guest so
  // the app stays usable, and — if the user had actually been signed in — flip
  // `sessionExpired` so the app can invite them to sign in again (their unsaved
  // edits stay on screen rather than vanishing on reload).
  useEffect(() => {
    const handlingRef = { current: false }
    setUnauthorizedHandler(() => {
      if (handlingRef.current) return
      handlingRef.current = true
      const wasSignedIn = !!userRef.current && !userRef.current.is_guest
      localStorage.removeItem(TOKEN_KEY)
      setAuthToken(null)
      setToken(null)
      authApi.guest()
        .then((res) => {
          applyToken(res.data.access_token)
          setUser({ username: res.data.username, plan: res.data.plan, is_guest: res.data.is_guest, persona: null })
        })
        .catch(() => {})
        .finally(() => { handlingRef.current = false })
      if (wasSignedIn) setSessionExpired(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // While signed in, slide the token's expiry forward periodically so a long-lived
  // tab never expires mid-use. Guests are ephemeral by design, so skip them.
  useEffect(() => {
    if (!user || user.is_guest) return
    const id = window.setInterval(() => {
      authApi.refresh().then((res) => applyToken(res.data.access_token)).catch(() => {})
    }, 6 * 60 * 60 * 1000) // every 6 hours
    return () => window.clearInterval(id)
  }, [user?.is_guest, user?.username])

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

  // OAuth needs an identity provider, which only Supabase mode wires up. In legacy
  // mode there's nothing to redirect to, so fail loudly rather than silently.
  const signInWithProvider = async (_provider: OAuthProvider) => {
    throw new Error("Social sign-in isn't available on this deployment. Please sign in with email and password.")
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

  // Strip the ?token= param from the URL so a refresh doesn't re-trigger recovery.
  const stripResetTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
    } catch { /* no-op */ }
  }

  // Step 1: email the reset link. Backend always responds generically (no
  // account enumeration), so this resolves even for unknown addresses.
  const resetPassword = async (email: string) => {
    await authApi.forgotPassword(email)
  }

  // Step 2: the user followed the link (?token=...) and chose a new password.
  // On success the backend signs them in, so apply the returned token.
  const updatePassword = async (password: string) => {
    if (!resetToken) throw new Error('This reset link is invalid or has expired. Please request a new one.')
    const res = await authApi.resetPassword(resetToken, password)
    applyToken(res.data.access_token)
    await hydrateUser()
    setResetToken(null)
    stripResetTokenFromUrl()
  }

  const clearRecovery = () => { setResetToken(null); stripResetTokenFromUrl() }

  const saveProfile = async (profile: UserProfile) => {
    const me = await authApi.updateProfile(profile)
    setUser((prev) => prev ? {
      ...prev, plan: me.data.plan, is_guest: me.data.is_guest,
      persona: me.data.persona, profile: me.data.profile,
    } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, signInWithProvider, logout, setPersona, isLoading, resetPassword, updatePassword, recoveryMode: !!resetToken, clearRecovery, saveProfile, sessionExpired, clearSessionExpired: () => setSessionExpired(false) }}>

      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
