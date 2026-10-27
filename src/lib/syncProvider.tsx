import Dexie from 'dexie'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { createCloudBusiness, profileOf, supabaseRemote, updateCloudProfile } from './cloud'
import { useFirmCtx } from './data'
import { firmDb, firmDbName } from './db'
import { supabase } from './supabase'
import { applyingRemote, hashRow, pendingChanges, syncBusiness } from './sync'

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

interface SyncCtx {
  state: SyncState
  lastSync: number | null
  pending: number
  error: string
  syncNow: () => void
}

const Ctx = createContext<SyncCtx>({ state: 'local', lastSync: null, pending: 0, error: '', syncNow: () => {} })
export const useSync = () => useContext(Ctx)

const EVERY_MS = 30000
const AFTER_CHANGE_MS = 1500

/** keeps the open business in sync with the cloud while the app is open */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { firm } = useFirmCtx()
  const { session } = useAuth()
  const cloud = !!supabase && !!session && !!firm?.accountId && firm.accountId === session.user.id
  const [state, setState] = useState<SyncState>(cloud ? 'syncing' : 'local')
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const running = useRef(false)
  const again = useRef(false)
  const timer = useRef<number>(0)

  const run = useCallback(async () => {
    if (!cloud || !firm) return
    if (running.current) { again.current = true; return }
    if (!navigator.onLine) { setState('offline'); setPending(await pendingChanges(firmDb(firm.id))); return }
    running.current = true
    setState('syncing')
    try {
      const db = firmDb(firm.id)
      // a business created offline is registered in the cloud on its first sync
      if (firm.role === 'owner' && !(await db.syncMeta.get('registered'))) {
        await createCloudBusiness(firm)
        await db.syncMeta.put({ key: 'registered', value: true })
      }
      await syncBusiness(db, firm.id, supabaseRemote)
      // the business profile (name, address, logo) lives on the businesses row; owners send changes
      if (firm.role === 'owner') {
        const h = hashRow(profileOf(firm))
        if ((await db.syncMeta.get('profileHash'))?.value !== h) {
          await updateCloudProfile(firm)
          await db.syncMeta.put({ key: 'profileHash', value: h })
        }
      }
      setLastSync(Date.now())
      setPending(await pendingChanges(db))
      setError('')
      setState('synced')
    } catch (e) {
      setError((e as Error).message)
      setState(navigator.onLine ? 'error' : 'offline')
    } finally {
      running.current = false
      if (again.current) { again.current = false; void run() }
    }
  }, [cloud, firm])

  const schedule = useCallback((ms = AFTER_CHANGE_MS) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void run(), ms)
  }, [run])

  useEffect(() => {
    if (!cloud || !firm) { setState('local'); return }
    void run()
    const name = firmDbName(firm.id)
    // any write to this business's database (except sync's own) schedules a sync
    const onMutated = (parts: Record<string, unknown>) => {
      if (applyingRemote) return
      if (Object.keys(parts).some((k) => k.startsWith(`idb://${name}/`) && !k.includes('/sync'))) schedule()
    }
    const sub = (Dexie.on as unknown as { storagemutated: { subscribe: (f: typeof onMutated) => void; unsubscribe: (f: typeof onMutated) => void } }).storagemutated
    sub.subscribe(onMutated)
    const every = window.setInterval(() => void run(), EVERY_MS)
    const online = () => schedule(300)
    const offline = () => setState('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    // another device changed something: pull it now
    const channel = supabase!.channel(`records-${firm.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `business_id=eq.${firm.id}` }, () => schedule(500))
      .subscribe()
    return () => {
      sub.unsubscribe(onMutated)
      window.clearInterval(every)
      window.clearTimeout(timer.current)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      void supabase!.removeChannel(channel)
    }
  }, [cloud, firm, run, schedule])

  const value = useMemo(() => ({ state, lastSync, pending, error, syncNow: () => void run() }), [state, lastSync, pending, error, run])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
