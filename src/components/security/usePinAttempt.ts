import { useCallback, useEffect, useState } from 'react'
import type { AppUser } from '../../lib/types'
import { checkPin } from '../../lib/users'

/** wrong tries allowed before a wait */
export const MAX_TRIES = 5
/** the wait after too many wrong tries */
export const WAIT_MS = 30000

interface Lockout { fails: number; until: number }
const key = (firmId: string) => `saudagar.lockout.${firmId}`

function read(firmId: string): Lockout {
  try {
    const v = JSON.parse(sessionStorage.getItem(key(firmId)) ?? 'null') as Lockout | null
    if (v && typeof v.fails === 'number' && typeof v.until === 'number') return v
  } catch { /* ignore */ }
  return { fails: 0, until: 0 }
}

function write(firmId: string, v: Lockout) {
  try { sessionStorage.setItem(key(firmId), JSON.stringify(v)) } catch { /* private mode */ }
}

/**
 * Checks PINs and counts wrong tries (kept for this tab, so a reload does not reset it).
 * After MAX_TRIES wrong PINs the pad waits WAIT_MS before the next try.
 */
export function usePinAttempt(firmId: string) {
  const [state, setState] = useState<Lockout>(() => read(firmId))
  const [now, setNow] = useState(Date.now())
  const waiting = state.until > now

  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [waiting])

  const save = useCallback((v: Lockout) => { write(firmId, v); setState(v); setNow(Date.now()) }, [firmId])

  /** true when the PIN is right; wrong PINs count towards the wait */
  const verify = useCallback(async (user: AppUser, pin: string) => {
    if (read(firmId).until > Date.now()) return false
    const ok = await checkPin(firmId, user, pin)
    if (ok) { save({ fails: 0, until: 0 }); return true }
    const fails = read(firmId).fails + 1
    save(fails >= MAX_TRIES ? { fails: 0, until: Date.now() + WAIT_MS } : { fails, until: 0 })
    return false
  }, [firmId, save])

  return {
    verify,
    fails: state.fails,
    triesLeft: MAX_TRIES - state.fails,
    waiting,
    waitSeconds: waiting ? Math.ceil((state.until - now) / 1000) : 0,
  }
}
