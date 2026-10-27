import type { Party, PartyKind } from '../../lib/types'

/**
 * Pure helpers for the parties module: phone numbers, WhatsApp links,
 * balance direction, duplicate checks and CSV import validation.
 * No React and no database here, so they are easy to test.
 */

/** digits only */
export const digits = (s?: string) => (s ?? '').replace(/\D/g, '')

/**
 * Phone number in international form for WhatsApp, without the plus.
 * Pakistani numbers: 0300 1234567, 300-1234567, +92 300 1234567 and 0092... all become 923001234567.
 * Returns undefined when it does not look like a phone number.
 */
export function normalizePkPhone(phone?: string): string | undefined {
  let d = digits(phone)
  if (!d) return undefined
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = '92' + d.slice(1)
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d
  if (d.length < 10 || d.length > 15) return undefined
  return d
}

/** wa.me link that opens WhatsApp with the message typed in */
export function waLink(phone: string | undefined, text: string): string | undefined {
  const n = normalizePkPhone(phone)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : undefined
}

export type BalanceDir = 'receive' | 'pay' | 'settled'

/** positive = they owe us (to receive), negative = we owe them (to pay) */
export function balanceDir(n: number): BalanceDir {
  if (n > 0.004) return 'receive'
  if (n < -0.004) return 'pay'
  return 'settled'
}

/** opening balance as stored: + they owe me, - I owe them */
export const signedOpening = (amount: number, dir: 'receive' | 'pay') => (dir === 'pay' ? -Math.abs(amount) : Math.abs(amount))

/** does a party of this kind belong to the customers / suppliers tab */
export const isCustomer = (k: PartyKind) => k === 'customer' || k === 'both'
export const isSupplier = (k: PartyKind) => k === 'supplier' || k === 'both'

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
/** the last 10 digits identify a Pakistani mobile in any format */
const phoneKey = (s?: string) => digits(s).slice(-10)

/** other parties with the same name or phone (for warnings in the form) */
export function findDuplicates(parties: Party[], draft: { id?: string; name: string; phone?: string }) {
  const name = normName(draft.name)
  const phone = phoneKey(draft.phone)
  const others = parties.filter((p) => p.id !== draft.id)
  return {
    byName: name ? others.find((p) => normName(p.name) === name) : undefined,
    byPhone: phone.length >= 7 ? others.find((p) => phoneKey(p.phone) === phone) : undefined,
  }
}

/** case-insensitive search on name, phone and city */
export function matchParty(p: Party, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  if (p.name.toLowerCase().includes(s) || (p.city ?? '').toLowerCase().includes(s)) return true
  const d = digits(s)
  return d.length >= 2 && digits(p.phone).includes(d)
}

// ---------- CSV import ----------

export const PARTY_CSV_HEADER = [
  'name', 'type', 'phone', 'email', 'address', 'city', 'ntn', 'group', 'opening_balance', 'opening_date', 'credit_limit', 'notes',
]

/** example rows for the downloadable template */
export const PARTY_CSV_SAMPLE = [
  ['Ali Traders', 'customer', '0300 1234567', '', 'Shop 12, Main Bazar', 'Lahore', '', 'Retailers', '15000', '2026-07-01', '50000', 'Pays monthly'],
  ['Hamza Distributors', 'supplier', '0321 7654321', 'hamza@example.com', '', 'Faisalabad', '1234567-8', '', '-42000', '2026-07-01', '', ''],
]

const ALIASES: Record<string, string> = {
  name: 'name', party: 'name', party_name: 'name',
  type: 'type', kind: 'type', party_type: 'type',
  phone: 'phone', mobile: 'phone', contact: 'phone', phone_no: 'phone',
  email: 'email', address: 'address', city: 'city', ntn: 'ntn',
  group: 'group', party_group: 'group',
  opening_balance: 'opening_balance', opening: 'opening_balance', balance: 'opening_balance',
  opening_date: 'opening_date', date: 'opening_date', as_of: 'opening_date',
  credit_limit: 'credit_limit', limit: 'credit_limit',
  notes: 'notes', note: 'notes',
}

export interface PartyCsvRow {
  /** line number in the file (1 = header) */
  line: number
  name: string
  kind: PartyKind
  phone?: string
  email?: string
  address?: string
  city?: string
  ntn?: string
  group?: string
  openingBalance: number
  openingDate: string
  creditLimit?: number
  notes?: string
  /** i18n keys; a row with errors is not imported */
  errors: string[]
  /** i18n keys; imported anyway */
  warnings: string[]
}

function parseKind(s: string): PartyKind | undefined {
  const v = s.trim().toLowerCase()
  if (!v || v === 'customer' || v === 'c' || v === 'buyer') return 'customer'
  if (v === 'supplier' || v === 's' || v === 'vendor') return 'supplier'
  if (v === 'both' || v === 'b') return 'both'
  return undefined
}

function parseAmount(s: string): number | undefined {
  const v = s.trim().replace(/,/g, '').replace(/^rs\.?\s*/i, '')
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

/** YYYY-MM-DD, or DD/MM/YYYY and DD-MM-YYYY as Excel often saves them */
export function parseDate(s: string, fallback: string): string | undefined {
  const v = s.trim()
  if (!v) return fallback
  let y: number, m: number, d: number
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  if (r) { y = +r[1]; m = +r[2]; d = +r[3] } else {
    r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v)
    if (!r) return undefined
    d = +r[1]; m = +r[2]; y = +r[3]
  }
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Check the rows of an imported CSV. The first row must be the header
 * (column names as in PARTY_CSV_HEADER, a few aliases allowed, any order).
 */
export function parsePartyCsv(rows: string[][], ctx: { existing: Party[]; today: string }): { error?: string; rows: PartyCsvRow[] } {
  if (rows.length === 0) return { error: 'pt_csvEmpty', rows: [] }
  const cols = rows[0].map((h) => ALIASES[h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')])
  if (!cols.includes('name')) return { error: 'pt_csvNoHeader', rows: [] }
  if (rows.length === 1) return { error: 'pt_csvEmpty', rows: [] }

  const existingNames = new Set(ctx.existing.map((p) => normName(p.name)))
  const existingPhones = new Set(ctx.existing.map((p) => phoneKey(p.phone)).filter((x) => x.length >= 7))
  const seenNames = new Set<string>()
  const seenPhones = new Set<string>()
  const out: PartyCsvRow[] = []

  rows.slice(1).forEach((r, i) => {
    const get = (k: string) => {
      const idx = cols.indexOf(k)
      return idx >= 0 ? (r[idx] ?? '').trim() : ''
    }
    const errors: string[] = []
    const warnings: string[] = []
    const name = get('name').replace(/\s+/g, ' ')
    if (!name) errors.push('pt_csvNoName')
    const kind = parseKind(get('type'))
    if (!kind) errors.push('pt_csvBadType')
    const opening = parseAmount(get('opening_balance'))
    if (opening === undefined) errors.push('pt_csvBadAmount')
    const limitRaw = get('credit_limit')
    const limit = limitRaw ? parseAmount(limitRaw) : undefined
    if (limitRaw && (limit === undefined || limit < 0)) errors.push('pt_csvBadLimit')
    const date = parseDate(get('opening_date'), ctx.today)
    if (!date) errors.push('pt_csvBadDate')
    const email = get('email')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push('pt_csvBadEmail')

    const nk = normName(name)
    if (name && existingNames.has(nk)) errors.push('pt_csvExists')
    else if (name && seenNames.has(nk)) errors.push('pt_csvRepeated')
    const pk = phoneKey(get('phone'))
    if (pk.length >= 7 && (existingPhones.has(pk) || seenPhones.has(pk))) warnings.push('pt_csvPhoneDup')
    if (name) seenNames.add(nk)
    if (pk.length >= 7) seenPhones.add(pk)

    out.push({
      line: i + 2,
      name,
      kind: kind ?? 'customer',
      phone: get('phone') || undefined,
      email: email || undefined,
      address: get('address') || undefined,
      city: get('city') || undefined,
      ntn: get('ntn') || undefined,
      group: get('group') || undefined,
      openingBalance: opening ?? 0,
      openingDate: date ?? ctx.today,
      creditLimit: limit && limit > 0 ? limit : undefined,
      notes: get('notes') || undefined,
      errors,
      warnings,
    })
  })
  return { rows: out }
}
