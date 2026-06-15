import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// When the env vars aren't set, the app falls back to the legacy custom auth.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const SUPABASE_ENABLED = !!supabase
