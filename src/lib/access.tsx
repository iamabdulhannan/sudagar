import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LockScreen } from '../components/security/LockScreen'
import { useAuth } from './auth'
import { useData } from './data'
import type { AppUser, ID } from './types'
import { canSignIn, lockEnabled, userCan, type Perm } from './users'

export { PERMS, ROLE_PERMS, lockEnabled, userCan } from './users'
export type { Perm } from './users'

export interface Access {
  /** the signed-in user, or null when app lock is off (everything allowed) */
  user: AppUser | null
  can: (p: Perm) => boolean
  /** show the lock screen now */
  lock: () => void
  /** app lock is on and users exist */
  locking: boolean
  /** sign in as a user whose PIN was just checked (lock screen, turning app lock on) */
  enter: (userId: ID) => void
}

const fallback: Access = { user: null, can: () => true, lock: () => {}, locking: false, enter: () => {} }
const AccessCtx = createContext<Access>(fallback)

export function useAccess(): Access {
  return useContext(AccessCtx)
}

// ---------- the session in this tab ----------

interface Session { userId: ID; at: number }
const sessionKey = (firmId: string) => `saudagar.session.${firmId}`

function readSession(firmId: string): Session | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(firmId))
    const s = raw ? (JSON.parse(raw) as Session) : null
    return s && typeof s.userId === 'string' && typeof s.at === 'number' ? s : null
  } catch { return null }
}

function writeSession(firmId: string, s: Session | null) {
  try {
    if (s) sessionStorage.setItem(sessionKey(firmId), JSON.stringify(s))
    else sessionStorage.removeItem(sessionKey(firmId))
  } catch { /* private mode: stays in memory only */ }
}

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const

/** wraps the open business: asks for the PIN when app lock is on, and provides useAccess() */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { firm, settings, users } = useData()
  const auth = useAuth()
  // the account's role in this business (staff who joined with an invite); owners have no limits
  const account = useMemo<AppUser | null>(() => (firm.role && firm.role !== 'owner' && auth.user
    ? { id: auth.user.id, name: auth.name, role: firm.role, pinHash: '', active: true, createdAt: 0 }
    : null), [firm.role, auth.user, auth.name])
  const locking = lockEnabled(settings.appLock, users)
  const idleMs = Math.max(0, settings.autoLockMinutes || 0) * 60000

  const [session, setSession] = useState<Session | null>(() => {
    const s = readSession(firm.id)
    // a reload after a long idle time does not unlock
    if (s && idleMs && Date.now() - s.at > idleMs) { writeSession(firm.id, null); return null }
    return s
  })
  // another business opened in this tab
  const firmRef = useRef(firm.id)
  useEffect(() => {
    if (firmRef.current !== firm.id) { firmRef.current = firm.id; setSession(readSession(firm.id)) }
  }, [firm.id])

  const user = useMemo(() => {
    if (!locking || !session) return null
    const u = users.find((x) => x.id === session.userId)
    return u && canSignIn(u) ? u : null
  }, [locking, session, users])
  const locked = locking && !user

  const lock = useCallback(() => { writeSession(firm.id, null); setSession(null) }, [firm.id])
  const enter = useCallback((userId: ID) => {
    const s = { userId, at: Date.now() }
    writeSession(firm.id, s)
    setSession(s)
  }, [firm.id])

  // auto lock after idle minutes; activity is noted at most every 5 s
  const last = useRef(Date.now())
  useEffect(() => {
    if (!locking || locked) return
    last.current = Date.now()
    let saved = 0
    const onActivity = () => {
      const now = Date.now()
      last.current = now
      if (now - saved > 5000 && session) { saved = now; writeSession(firm.id, { ...session, at: now }) }
    }
    for (const ev of ACTIVITY) window.addEventListener(ev, onActivity, { passive: true })
    const timer = idleMs ? window.setInterval(() => { if (Date.now() - last.current >= idleMs) lock() }, 10000) : 0
    return () => {
      for (const ev of ACTIVITY) window.removeEventListener(ev, onActivity)
      if (timer) window.clearInterval(timer)
    }
  }, [locking, locked, idleMs, lock, session, firm.id])

  const value = useMemo<Access>(() => ({
    user: locking ? user : account,
    // both the device PIN user and the account role must allow it
    can: (p: Perm) => (!locking || userCan(user, p)) && userCan(account, p),
    lock,
    locking,
    enter,
  }), [locking, user, account, lock, enter])

  if (locked) return <LockScreen onUnlock={enter} />
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>
}
