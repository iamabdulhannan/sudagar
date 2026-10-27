import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { deleteFirm, firmDb, getPref, mainGodown, meta, setPref, withSettingsDefaults, type FirmDB } from './db'
import { cloudConfigured } from './supabase'
import { computeBooks, stockQty, type Books } from './ledger'
import type { Account, AppUser, Category, Firm, Godown, ID, Item, MoneyCategory, Party, PartyGroup, Settings, Shift, StockAdjustment, Txn } from './types'

// ---------- current business ----------

interface FirmCtx {
  /** businesses of the signed-in account on this device */
  firms: Firm[]
  /** businesses on this device that belong to no account (made before sign-in existed) */
  unclaimed: Firm[]
  firm: Firm | null
  db: FirmDB | null
  switchFirm: (id: string | null) => Promise<void>
  updateFirm: (patch: Partial<Firm>) => Promise<void>
}

const FirmContext = createContext<FirmCtx | null>(null)

/** the sample business of older versions is removed from every device once */
async function removeOldDemo() {
  if (await getPref('demoRemoved', false)) return
  for (const f of await meta.firms.toArray()) if (!f.accountId && /\(demo\)\s*$/i.test(f.name)) await deleteFirm(f.id)
  await setPref('demoRemoved', true)
}

export function FirmProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const all = useLiveQuery(() => meta.firms.orderBy('createdAt').toArray(), [])
  const [currentId, setCurrentId] = useState<string | null | undefined>(undefined)

  useEffect(() => { removeOldDemo().then(() => getPref<string | null>('currentFirm', null)).then(setCurrentId) }, [])

  // with accounts on, a device shows only the signed-in account's businesses
  const accountId = session?.user.id
  const firms = useMemo(() => (all ? (cloudConfigured ? all.filter((f) => !!accountId && f.accountId === accountId) : all) : undefined), [all, accountId])
  const unclaimed = useMemo(() => (all && cloudConfigured ? all.filter((f) => !f.accountId) : []), [all])

  const firm = useMemo(() => {
    if (!firms || currentId === undefined) return null
    return firms.find((f) => f.id === currentId) ?? firms[0] ?? null
  }, [firms, currentId])

  const switchFirm = useCallback(async (id: string | null) => {
    await setPref('currentFirm', id)
    setCurrentId(id)
  }, [])

  const updateFirm = useCallback(async (patch: Partial<Firm>) => {
    if (firm) await meta.firms.update(firm.id, patch)
  }, [firm])

  const db = useMemo(() => (firm ? firmDb(firm.id) : null), [firm])

  if (!firms || currentId === undefined || !ready) return <Splash />
  return <FirmContext.Provider value={{ firms, unclaimed, firm, db, switchFirm, updateFirm }}>{children}</FirmContext.Provider>
}

export function useFirmCtx() {
  const c = useContext(FirmContext)
  if (!c) throw new Error('useFirmCtx outside FirmProvider')
  return c
}

// ---------- the open business's data ----------

export interface FirmData {
  firm: Firm
  db: FirmDB
  settings: Settings
  items: Item[]
  categories: Category[]
  parties: Party[]
  partyGroups: PartyGroup[]
  accounts: Account[]
  moneyCategories: MoneyCategory[]
  /** all transactions, newest first */
  txns: Txn[]
  adjustments: StockAdjustment[]
  /** godowns / branches; always includes the main one (id 'main') */
  godowns: Godown[]
  users: AppUser[]
  /** cash shifts, newest first */
  shifts: Shift[]
  /** quick lookups */
  itemById: Map<ID, Item>
  partyById: Map<ID, Party>
  accountById: Map<ID, Account>
  txnById: Map<ID, Txn>
  /** stock on hand per product (base units) */
  qty: Map<ID, number>
}

const DataContext = createContext<FirmData | null>(null)
const BooksContext = createContext<{ get: () => Books } | null>(null)

/** loads every table of the open business once; pages read from it with useData() */
export function DataProvider({ children }: { children: ReactNode }) {
  const { firm, db } = useFirmCtx()
  const raw = useLiveQuery(async () => {
    if (!db) return null
    const [settings, items, categories, parties, partyGroups, accounts, moneyCategories, txns, adjustments, godowns, users, shifts] = await Promise.all([
      db.settings.get('settings'), db.items.toArray(), db.categories.toArray(), db.parties.toArray(), db.partyGroups.toArray(),
      db.accounts.toArray(), db.moneyCategories.toArray(), db.txns.toArray(), db.adjustments.toArray(), db.godowns.toArray(), db.users.toArray(), db.shifts.toArray(),
    ])
    return { settings, items, categories, parties, partyGroups, accounts, moneyCategories, txns, adjustments, godowns, users, shifts }
  }, [db])

  const data = useMemo<FirmData | null>(() => {
    if (!raw || !raw.settings || !firm || !db) return null
    const byName = <T extends { name: string }>(a: T[]) => [...a].sort((x, y) => x.name.localeCompare(y.name))
    const txns = [...raw.txns].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    return {
      firm, db, settings: withSettingsDefaults(raw.settings),
      items: byName(raw.items), categories: byName(raw.categories), parties: byName(raw.parties), partyGroups: byName(raw.partyGroups),
      accounts: [...raw.accounts].sort((a, b) => a.createdAt - b.createdAt), moneyCategories: byName(raw.moneyCategories),
      txns, adjustments: raw.adjustments,
      godowns: raw.godowns.some((g) => g.id === 'main') ? [...raw.godowns].sort((a, b) => a.createdAt - b.createdAt) : [mainGodown(), ...raw.godowns],
      users: raw.users,
      shifts: [...raw.shifts].sort((a, b) => b.openedAt - a.openedAt),
      itemById: new Map(raw.items.map((i) => [i.id, i])),
      partyById: new Map(raw.parties.map((p) => [p.id, p])),
      accountById: new Map(raw.accounts.map((a) => [a.id, a])),
      txnById: new Map(raw.txns.map((t) => [t.id, t])),
      qty: stockQty(raw.items, raw.txns, raw.adjustments),
    }
  }, [raw, firm, db])

  // the books are only built when a page asks for them, and rebuilt when data changes
  const books = useMemo(() => {
    let cache: Books | null = null
    return {
      get: () => {
        if (!cache && data) cache = computeBooks(data)
        return cache!
      },
    }
  }, [data])

  if (!data) return <Splash />
  return (
    <DataContext.Provider value={data}>
      <BooksContext.Provider value={books}>{children}</BooksContext.Provider>
    </DataContext.Provider>
  )
}

export function useData(): FirmData {
  const c = useContext(DataContext)
  if (!c) throw new Error('useData outside DataProvider')
  return c
}

/** double-entry books, stock valuation and invoice dues (see ledger.ts) */
export function useBooks(): Books {
  const c = useContext(BooksContext)
  if (!c) throw new Error('useBooks outside DataProvider')
  return c.get()
}

export async function updateSettings(db: FirmDB, patch: Partial<Settings>) {
  await db.settings.update('settings', patch)
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="size-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
    </div>
  )
}
