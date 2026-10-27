import Dexie, { type EntityTable } from 'dexie'
import type {
  Account, AppUser, AuditEntry, BinEntry, Shift, BusinessType, Category, Features, Firm, Godown, Item, MoneyCategory, NumberedType,
  Party, PartyGroup, Settings, StockAdjustment, Txn,
} from './types'

/**
 * Storage is local-first: everything lives in IndexedDB on this device, so the app
 * works with no internet. One database lists the businesses (meta), and each
 * business gets its own database. Backup / restore (backup.ts) moves a whole
 * business database as one JSON file.
 */

// ---------- meta: list of businesses ----------

interface MetaPref { key: string; value: unknown }

class MetaDB extends Dexie {
  firms!: EntityTable<Firm, 'id'>
  prefs!: EntityTable<MetaPref, 'key'>
  constructor() {
    super('saudagar-meta')
    this.version(1).stores({ firms: 'id, name, createdAt', prefs: 'key' })
  }
}

export const meta = new MetaDB()

// ---------- one database per business ----------

export class FirmDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  items!: EntityTable<Item, 'id'>
  categories!: EntityTable<Category, 'id'>
  parties!: EntityTable<Party, 'id'>
  partyGroups!: EntityTable<PartyGroup, 'id'>
  accounts!: EntityTable<Account, 'id'>
  moneyCategories!: EntityTable<MoneyCategory, 'id'>
  txns!: EntityTable<Txn, 'id'>
  adjustments!: EntityTable<StockAdjustment, 'id'>
  audit!: EntityTable<AuditEntry, 'id'>
  godowns!: EntityTable<Godown, 'id'>
  users!: EntityTable<AppUser, 'id'>
  bin!: EntityTable<BinEntry, 'id'>
  shifts!: EntityTable<Shift, 'id'>
  /** hash of each row as last synced, key `${table}/${id}` */
  syncHashes!: EntityTable<{ key: string; hash: string }, 'key'>
  syncMeta!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor(firmId: string) {
    super(firmDbName(firmId))
    this.version(1).stores({
      settings: 'id',
      items: 'id, name, code, barcode, categoryId, kind, active',
      categories: 'id, name',
      parties: 'id, name, kind, phone, groupId, active',
      partyGroups: 'id, name',
      accounts: 'id, kind, name',
      moneyCategories: 'id, kind, name',
      txns: 'id, type, date, number, partyId, accountId, toAccountId, status, sourceId, againstId, categoryId, [type+date]',
      adjustments: 'id, itemId, date',
      audit: '++id, at, entity, entityId',
    })
    // v2: godowns, users with PINs, recycle bin, new settings
    this.version(2).stores({
      txns: 'id, type, date, number, partyId, accountId, toAccountId, status, sourceId, againstId, categoryId, godownId, [type+date]',
      godowns: 'id, name',
      users: 'id, name, role',
      bin: 'id, deletedAt',
    }).upgrade(async (tx) => {
      const s = await tx.table('settings').get('settings')
      if (s) await tx.table('settings').put(withSettingsDefaults(s))
      if (!(await tx.table('godowns').get(MAIN_GODOWN))) await tx.table('godowns').add(mainGodown())
    })
    // v3: cloud sync bookkeeping (what was last sent / received)
    this.version(3).stores({ syncHashes: 'key', syncMeta: 'key' })
    // v4: cash shifts
    this.version(4).stores({ shifts: 'id, status, openedAt, deviceId', txns: 'id, type, date, number, partyId, accountId, toAccountId, status, sourceId, againstId, categoryId, godownId, shiftId, [type+date]' })
  }
}

export const firmDbName = (firmId: string) => `saudagar-firm-${firmId}`

const open = new Map<string, FirmDB>()
export function firmDb(firmId: string): FirmDB {
  let db = open.get(firmId)
  if (!db) { db = new FirmDB(firmId); open.set(firmId, db) }
  return db
}

export function forgetFirmDb(firmId: string) {
  open.get(firmId)?.close()
  open.delete(firmId)
}

// ---------- ids and dates ----------

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

/** today's local date as YYYY-MM-DD */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return today(d)
}

// ---------- defaults ----------

export const DEFAULT_PREFIXES: Record<NumberedType, string> = {
  sale: 'INV-', sale_return: 'CN-', estimate: 'EST-', sale_order: 'SO-', delivery_challan: 'DC-',
  purchase: 'PB-', purchase_return: 'DN-', purchase_order: 'PO-',
  payment_in: 'RCV-', payment_out: 'PAY-', expense: 'EXP-', other_income: 'INC-', transfer: 'TRF-',
  capital_in: 'CAP-', drawing: 'DRW-', stock_transfer: 'ST-', manufacture: 'MFG-',
}

/** shift numbers are kept separately (shifts are not transactions) */
export const SHIFT_PREFIX = 'SH-'

/** the godown every business starts with; stock with no godown belongs here */
export const MAIN_GODOWN = 'main'
export const mainGodown = (): Godown => ({ id: MAIN_GODOWN, name: 'Main shop', active: true, createdAt: 0 })

const BASE_FEATURES: Features = {
  tax: false, batches: false, serials: false, wholesale: false, altUnits: false, lineDiscount: true,
  charges: false, roundOff: true, estimates: true, orders: false, challans: false, dueDates: true, mrp: false,
  godowns: false, manufacturing: false, loyalty: false,
}

/** sensible feature switches per kind of business; all can be changed later in Settings */
export const BUSINESS_PRESETS: Record<BusinessType, Partial<Features>> = {
  retail: {},
  grocery: { altUnits: true, wholesale: true },
  wholesale: { wholesale: true, altUnits: true, orders: true, challans: true, charges: true, godowns: true },
  distributor: { wholesale: true, altUnits: true, orders: true, challans: true, charges: true, batches: true, tax: true, godowns: true },
  manufacturer: { tax: true, orders: true, challans: true, charges: true, altUnits: true, manufacturing: true, godowns: true },
  pharmacy: { batches: true, mrp: true, altUnits: true },
  electronics: { serials: true, tax: true },
  garments: { lineDiscount: true, loyalty: true },
  hardware: { altUnits: true, wholesale: true },
  restaurant: { roundOff: true, estimates: false, loyalty: true },
  services: { tax: true, estimates: true },
  agri: { batches: true, altUnits: true, wholesale: true, dueDates: true },
  other: {},
}

export function defaultSettings(type: BusinessType): Settings {
  const nextNo = Object.fromEntries(Object.keys(DEFAULT_PREFIXES).map((k) => [k, 1])) as Record<NumberedType, number>
  return {
    id: 'settings',
    features: { ...BASE_FEATURES, ...BUSINESS_PRESETS[type] },
    taxLabel: 'GST',
    defaultTaxRate: 18,
    taxRates: [0, 5, 10, 12, 16, 17, 18],
    prefixes: { ...DEFAULT_PREFIXES },
    nextNo,
    printSize: type === 'restaurant' || type === 'grocery' || type === 'retail' ? 'thermal80' : 'a4',
    invoiceColor: '#0f766e',
    invoiceTerms: '',
    invoiceFooter: '',
    signature: true,
    negativeStock: 'warn',
    defaultDueDays: 30,
    posAutoPrint: false,
    invoiceTheme: 'classic',
    loyalty: { earnPer: 100, pointValue: 1 },
    appLock: false,
    autoLockMinutes: 0,
    requireShift: type === 'retail' || type === 'grocery' || type === 'restaurant' || type === 'pharmacy',
    denominations: [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1],
    drawerKick: false,
  }
}

/** fill in settings added after a business was created (and new transaction types' numbering) */
export function withSettingsDefaults(s: Settings): Settings {
  const d = defaultSettings('other')
  return {
    ...d, ...s,
    features: { ...BASE_FEATURES, ...s.features },
    prefixes: { ...DEFAULT_PREFIXES, ...s.prefixes },
    nextNo: { ...d.nextNo, ...s.nextNo },
    loyalty: { ...d.loyalty, ...s.loyalty },
  }
}

export const DEFAULT_EXPENSE_HEADS = [
  'Rent', 'Salaries', 'Electricity', 'Gas', 'Water', 'Internet & phone', 'Fuel & transport',
  'Repairs & maintenance', 'Office supplies', 'Marketing', 'Bank charges', 'Loan interest', 'Tea & refreshments', 'Cash short', 'Other expenses',
]
export const DEFAULT_INCOME_HEADS = ['Commission received', 'Rent received', 'Discount received', 'Cash excess', 'Other income']
export const DEFAULT_UNITS = ['pcs', 'box', 'pack', 'dozen', 'kg', 'g', 'ltr', 'ml', 'mtr', 'ft', 'bag', 'carton', 'bottle', 'set', 'pair', 'hour', 'job']

/** first-time setup of a new business database */
export async function seedFirm(db: FirmDB, type: BusinessType) {
  const now = Date.now()
  const date = today()
  const cashId = uid()
  await db.transaction('rw', [db.settings, db.accounts, db.moneyCategories, db.categories, db.godowns], async () => {
    await db.godowns.put(mainGodown())
    await db.settings.put({ ...defaultSettings(type), defaultAccountId: cashId })
    await db.accounts.add({ id: cashId, kind: 'cash', name: 'Cash in hand', openingBalance: 0, openingDate: date, active: true, createdAt: now })
    await db.moneyCategories.bulkAdd([
      ...DEFAULT_EXPENSE_HEADS.map((name) => ({ id: uid(), kind: 'expense' as const, name })),
      ...DEFAULT_INCOME_HEADS.map((name) => ({ id: uid(), kind: 'income' as const, name })),
    ])
    await db.categories.add({ id: uid(), name: 'General' })
  })
}

export async function createFirm(input: Omit<Firm, 'id' | 'createdAt'>): Promise<Firm> {
  const firm: Firm = { ...input, id: uid(), createdAt: Date.now() }
  await meta.firms.add(firm)
  await seedFirm(firmDb(firm.id), firm.businessType)
  return firm
}

export async function deleteFirm(firmId: string) {
  forgetFirmDb(firmId)
  await Dexie.delete(firmDbName(firmId))
  await meta.firms.delete(firmId)
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const row = await meta.prefs.get(key)
  return row ? (row.value as T) : fallback
}

export async function setPref(key: string, value: unknown) {
  await meta.prefs.put({ key, value })
}
