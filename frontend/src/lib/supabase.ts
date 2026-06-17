import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// When the env vars aren't set, the app falls back to the legacy custom auth.
// We pin `apikey` into the global headers as well: some auth calls (e.g. the
// password grant) have been observed to drop it, which makes Supabase's gateway
// reject the request with "No API key found in request".
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        global: { headers: { apikey: anonKey } },
      })
    : null

export const SUPABASE_ENABLED = !!supabase
