import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase (PostgreSQL + Auth) is the backend: accounts, businesses, team members and a
 * synced copy of every business's data. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * (Supabase dashboard → Project Settings → API). The anon key is public; security comes from the
 * row level security rules in supabase/migrations.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = !!url && !!key

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'saudagar.auth' } })
  : null

/** the client, or an error explaining the missing setup */
export function sb(): SupabaseClient {
  if (!supabase) throw new Error('CLOUD_NOT_CONFIGURED')
  return supabase
}
