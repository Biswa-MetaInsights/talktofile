import type { User } from '../types'

/**
 * `user.username` is an email address in Supabase mode (and legacy sign-ups now
 * require one too), so rendering it raw puts "someone@gmail.com" in the UI.
 * These helpers pick the closest thing to a real name we actually know.
 */

/** The part of an email before the "@" — returned unchanged if there's no "@". */
export function emailLocalPart(identifier: string): string {
  const at = identifier.indexOf('@')
  // at === 0 would leave nothing to show, so keep the original in that case.
  return at > 0 ? identifier.slice(0, at) : identifier
}

/** Full name if the user gave us one, otherwise their email's local part. */
export function displayName(user: User | null | undefined): string {
  if (!user) return ''
  const fullName = user.profile?.full_name?.trim()
  return fullName || emailLocalPart(user.username)
}
