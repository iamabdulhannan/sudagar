import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cloudConfigured, sb, supabase } from './supabase'

/**
 * Accounts (Supabase Auth, email + password). The session is kept in localStorage, so a signed-in
 * device opens the app with no internet; tokens refresh when it is back online.
 */

export interface AuthCtx {
  /** false until the stored session has been read */
  ready: boolean
  session: Session | null
  user: User | null
  /** name given at sign-up (or the part of the email before @) */
  name: string
  /** opened from a "reset password" email: ask for a new password */
  recovering: boolean
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirm: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateName: (name: string) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

/** Supabase error messages → i18n keys */
export function authErrorKey(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/CLOUD_NOT_CONFIGURED/.test(m)) return 'au_errNotConfigured'
  if (/invalid login credentials/i.test(m)) return 'au_errBadLogin'
  if (/email not confirmed/i.test(m)) return 'au_errNotConfirmed'
  if (/already registered|already exists/i.test(m)) return 'au_errExists'
  if (/password should be at least|weak password/i.test(m)) return 'au_errWeak'
  if (/rate limit|too many/i.test(m)) return 'au_errRate'
  if (/failed to fetch|network/i.test(m)) return 'au_errOffline'
  if (/invalid.*email|email address.*invalid/i.test(m)) return 'au_errEmail'
  return 'au_errGeneric'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!cloudConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await sb().auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/signin` },
    })
    if (error) throw error
    // Supabase returns a user with no identities when the email is already registered
    if (data.user && data.user.identities?.length === 0) throw new Error('already registered')
    return { needsConfirm: !data.session }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await sb().auth.signOut({ scope: 'local' })
  }, [])

  const sendReset = useCallback(async (email: string) => {
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password` })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await sb().auth.updateUser({ password })
    if (error) throw error
    setRecovering(false)
  }, [])

  const updateName = useCallback(async (name: string) => {
    const { error } = await sb().auth.updateUser({ data: { full_name: name.trim() } })
    if (error) throw error
    await sb().from('profiles').update({ full_name: name.trim() }).eq('id', session!.user.id)
  }, [session])

  const user = session?.user ?? null
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split('@')[0] || ''
  const value = useMemo<AuthCtx>(
    () => ({ ready, session, user, name, recovering, signUp, signIn, signOut, sendReset, updatePassword, updateName }),
    [ready, session, user, name, recovering, signUp, signIn, signOut, sendReset, updatePassword, updateName],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
