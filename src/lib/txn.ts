import { addDays, today, uid, type FirmDB } from './db'
import { round2 } from './format'
import type { Item, Party, PaymentSplit, Settings, Txn, TxnLine, TxnType } from './types'

/**
 * Transaction rules: what each type does to stock, party balance and cash,
 * plus the invoice maths and save / convert / cancel / delete.
 * Accounting entries are derived from these in ledger.ts.
 */

export type Side = 'sale' | 'purchase' | 'money' | 'stock'

export interface TxnMeta {
  side: Side
  /** +1 adds stock, -1 removes stock, 0 no stock effect */
  stock: 1 | -1 | 0
  /** has item lines */
  lines: boolean
  /** affects party balance / books (estimates and orders do not) */
  posts: boolean
  /** party is required (otherwise walk-in allowed) */
  partyRequired: boolean
  /** can be converted to these types */
  convertTo: TxnType[]
  /** i18n key of the name */
  label: string
  /** route segment under /txn */
  slug: string
}

export const TXN_META: Record<TxnType, TxnMeta> = {
  sale: { side: 'sale', stock: -1, lines: true, posts: true, partyRequired: false, convertTo: ['sale_return', 'delivery_challan'], label: 'tt_sale', slug: 'sale' },
  sale_return: { side: 'sale', stock: 1, lines: true, posts: true, partyRequired: false, convertTo: [], label: 'tt_sale_return', slug: 'sale-return' },
  estimate: { side: 'sale', stock: 0, lines: true, posts: false, partyRequired: false, convertTo: ['sale', 'sale_order'], label: 'tt_estimate', slug: 'estimate' },
  sale_order: { side: 'sale', stock: 0, lines: true, posts: false, partyRequired: true, convertTo: ['sale', 'delivery_challan'], label: 'tt_sale_order', slug: 'sale-order' },
  delivery_challan: { side: 'sale', stock: 0, lines: true, posts: false, partyRequired: true, convertTo: ['sale'], label: 'tt_delivery_challan', slug: 'challan' },
  purchase: { side: 'purchase', stock: 1, lines: true, posts: true, partyRequired: true, convertTo: ['purchase_return'], label: 'tt_purchase', slug: 'purchase' },
  purchase_return: { side: 'purchase', stock: -1, lines: true, posts: true, partyRequired: true, convertTo: [], label: 'tt_purchase_return', slug: 'purchase-return' },
  purchase_order: { side: 'purchase', stock: 0, lines: true, posts: false, partyRequired: true, convertTo: ['purchase'], label: 'tt_purchase_order', slug: 'purchase-order' },
  payment_in: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: true, convertTo: [], label: 'tt_payment_in', slug: 'payment-in' },
  payment_out: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: true, convertTo: [], label: 'tt_payment_out', slug: 'payment-out' },
  expense: { side: 'money', stock: 0, lines: true, posts: true, partyRequired: false, convertTo: [], label: 'tt_expense', slug: 'expense' },
  other_income: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: false, convertTo: [], label: 'tt_other_income', slug: 'income' },
  transfer: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: false, convertTo: [], label: 'tt_transfer', slug: 'transfer' },
  capital_in: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: false, convertTo: [], label: 'tt_capital_in', slug: 'capital' },
  drawing: { side: 'money', stock: 0, lines: false, posts: true, partyRequired: false, convertTo: [], label: 'tt_drawing', slug: 'drawing' },
  // lines move from godownId to toGodownId; total stock does not change
  stock_transfer: { side: 'stock', stock: 0, lines: true, posts: false, partyRequired: false, convertTo: [], label: 'tt_stock_transfer', slug: 'stock-transfer' },
  // lines are the materials used (stock out); outputItemId x outputQty comes in
  manufacture: { side: 'stock', stock: -1, lines: true, posts: true, partyRequired: false, convertTo: [], label: 'tt_manufacture', slug: 'manufacture' },
}

/** documents that wait to be converted (they have an open / converted status) */
export const HAS_STATUS: TxnType[] = ['estimate', 'sale_order', 'delivery_challan', 'purchase_order']

/** documents whose `received` is money changing hands right now */
const SETTLE_IN_FULL: TxnType[] = ['payment_in', 'payment_out', 'other_income', 'transfer', 'capital_in', 'drawing']

export const typeFromSlug = (slug: string): TxnType | undefined =>
  (Object.keys(TXN_META) as TxnType[]).find((k) => TXN_META[k].slug === slug)

/** money moves IN to our account for these (sale, payment in, income); OUT for the rest */
export const moneyIn = (t: TxnType) => t === 'sale' || t === 'payment_in' || t === 'other_income' || t === 'purchase_return' || t === 'capital_in'

/**
 * Where the money of a transaction went: the split payments, or the single account.
 * Use this instead of reading accountId / received directly.
 */
export function moneySplits(t: Txn): PaymentSplit[] {
  if (t.payments?.length) return t.payments.filter((p) => p.amount)
  if (!t.received || !t.accountId) return []
  return [{ accountId: t.accountId, mode: t.paymentMode ?? 'cash', amount: t.received, refNo: t.refNo }]
}

/** a cheque payment that bounced counts as if it never happened */
export const isBounced = (t: Txn) => t.chequeStatus === 'bounced'

/** the stock effect of one line in base units */
export const baseQty = (l: TxnLine) => l.qty * (l.factor || 1)

// ---------- maths ----------

/** recompute a line's discount, tax and amount from qty, rate and percents */
export function calcLine(l: TxnLine, taxOn: boolean): TxnLine {
  const qty = Number(l.qty) || 0
  const rate = Number(l.rate) || 0
  const gross = qty * rate
  const discount = l.discountPct > 0 ? round2((gross * l.discountPct) / 100) : round2(Math.min(Number(l.discount) || 0, gross))
  const taxRate = taxOn ? Number(l.taxRate) || 0 : 0
  let taxAmount: number
  let amount: number
  if (l.priceIncludesTax) {
    amount = round2(gross - discount)
    taxAmount = round2(amount - amount / (1 + taxRate / 100))
  } else {
    const taxable = gross - discount
    taxAmount = round2((taxable * taxRate) / 100)
    amount = round2(taxable + taxAmount)
  }
  return { ...l, qty, rate, discount, taxRate, taxAmount, amount }
}

/** recompute a whole transaction's totals (lines must already be calculated) */
export function calcTotals(t: Txn, s: Settings): Txn {
  if (t.type === 'stock_transfer' || t.type === 'manufacture') {
    // no selling price: totals are the value of the materials at the rates on the lines
    const lines = t.lines.map((l) => calcLine({ ...l, taxRate: 0, discountPct: 0, discount: 0 }, false))
    const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0))
    const charges = round2(t.charges || 0)
    return { ...t, lines, subtotal, taxTotal: 0, discount: 0, discountPct: 0, roundOff: 0, charges, total: round2(subtotal + charges) }
  }
  if (!TXN_META[t.type].lines || (t.type === 'expense' && t.lines.length === 0)) {
    const total = round2(t.total)
    return { ...t, subtotal: total, taxTotal: 0, discount: 0, discountPct: 0, charges: 0, roundOff: 0, total }
  }
  const lines = t.lines.map((l) => calcLine(l, s.features.tax && t.type !== 'expense'))
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0))
  const taxTotal = round2(lines.reduce((a, l) => a + l.taxAmount, 0))
  const discount = t.discountPct > 0 ? round2((subtotal * t.discountPct) / 100) : round2(Math.min(t.discount || 0, subtotal))
  const charges = s.features.charges ? round2(t.charges || 0) : 0
  const before = subtotal - discount + charges
  const roundOff = s.features.roundOff ? round2(Math.round(before) - before) : 0
  const total = round2(before + roundOff)
  return { ...t, lines, subtotal, taxTotal, discount, charges, roundOff, total }
}

/** price for a party: wholesale price for wholesale customers (from the minimum quantity) */
export function priceFor(item: Item, side: Side, party: Party | undefined, qty: number, s: Settings): number {
  if (side === 'purchase') return item.purchasePrice
  if (s.features.wholesale && item.wholesalePrice && (party?.priceTier === 'wholesale' || (item.wholesaleMinQty && qty >= item.wholesaleMinQty))) {
    return item.wholesalePrice
  }
  return item.salePrice
}

/** a new line for an item */
export function lineFor(item: Item, side: Side, party: Party | undefined, s: Settings, qty = 1): TxnLine {
  return calcLine({
    itemId: item.id, name: item.name, qty, unit: item.unit, factor: 1,
    rate: priceFor(item, side, party, qty, s),
    priceIncludesTax: item.priceIncludesTax,
    discountPct: 0, discount: 0,
    taxRate: s.features.tax ? item.taxRate : 0,
    taxAmount: 0, amount: 0,
    mrp: item.mrp,
  }, s.features.tax)
}

export function blankTxn(type: TxnType, s: Settings): Txn {
  const now = Date.now()
  return {
    id: uid(), type, number: '', date: today(), createdAt: now, updatedAt: now,
    lines: [], subtotal: 0, discountPct: 0, discount: 0, taxTotal: 0, charges: 0, roundOff: 0, total: 0,
    received: 0, accountId: s.defaultAccountId, paymentMode: 'cash',
    status: HAS_STATUS.includes(type) ? 'open' : undefined,
    dueDate: (type === 'sale' || type === 'purchase') && s.features.dueDates ? addDays(today(), s.defaultDueDays) : undefined,
  }
}

/** a draft of `to` filled from `from` (estimate → invoice, invoice → return ...) */
export function convertDraft(from: Txn, to: TxnType, s: Settings): Txn {
  const base = blankTxn(to, s)
  const isReturn = to === 'sale_return' || to === 'purchase_return'
  return calcTotals({
    ...base,
    partyId: from.partyId, partyName: from.partyName, partyPhone: from.partyPhone,
    lines: from.lines.map((l) => ({ ...l })),
    discountPct: from.discountPct, discount: from.discount, charges: from.charges,
    shipTo: from.shipTo,
    sourceId: isReturn ? undefined : from.id,
    againstId: isReturn ? from.id : undefined,
    refNo: isReturn ? from.number : from.refNo,
  }, s)
}

// ---------- validation ----------

export interface TxnProblem { key: string; vars?: Record<string, string | number> }

export function validate(t: Txn, s?: Settings): TxnProblem | null {
  const m = TXN_META[t.type]
  if (!t.date) return { key: 'errDate' }
  if (s?.lockDate && t.date <= s.lockDate) return { key: 'errLocked', vars: { date: s.lockDate } }
  if (m.partyRequired && !t.partyId) return { key: 'errPartyRequired' }
  if (m.lines && t.type !== 'expense' && t.lines.length === 0) return { key: 'errNoLines' }
  if (t.lines.some((l) => !l.name.trim() || !(l.qty > 0))) return { key: 'errBadLine' }
  if (!(t.total > 0) && (SETTLE_IN_FULL.includes(t.type) || t.type === 'expense')) return { key: 'errAmount' }
  if (t.payments?.length) {
    if (t.payments.some((p) => p.amount < 0 || (p.amount > 0 && !p.accountId))) return { key: 'errAccount' }
    if (Math.abs(t.payments.reduce((a, p) => a + p.amount, 0) - t.received) > 0.005) return { key: 'errSplit' }
  }
  if (t.type === 'stock_transfer') {
    if ((t.godownId ?? 'main') === (t.toGodownId ?? 'main')) return { key: 'errGodowns' }
    if (t.lines.some((l) => !l.itemId)) return { key: 'errBadLine' }
    return null
  }
  if (t.type === 'manufacture') {
    if (!t.outputItemId || !(Number(t.outputQty) > 0)) return { key: 'errOutput' }
    if (t.lines.some((l) => !l.itemId || l.itemId === t.outputItemId)) return { key: 'errBadLine' }
    if (t.charges > 0 && !t.accountId) return { key: 'errAccount' }
    return null
  }
  if (t.received < 0 || t.received > t.total + 0.001) return { key: 'errReceived' }
  // without a party there is no account to keep the balance in, so it must be settled now
  if (m.posts && !t.partyId && !SETTLE_IN_FULL.includes(t.type) && Math.abs(t.received - t.total) > 0.001) return { key: 'errWalkinUnpaid' }
  if (((t.received > 0 && !t.payments?.length) || SETTLE_IN_FULL.includes(t.type)) && !t.accountId) return { key: 'errAccount' }
  if (t.chequeStatus === 'cleared' && !t.clearedOn) return { key: 'errDate' }
  if (t.type === 'transfer' && (!t.toAccountId || t.toAccountId === t.accountId)) return { key: 'errTransfer' }
  return null
}

// ---------- persistence ----------

function fmtNumber(prefix: string, n: number) {
  return prefix + String(n).padStart(4, '0')
}

/** save a new or edited transaction. New ones get the next number for their type. */
export async function saveTxn(db: FirmDB, draft: Txn): Promise<Txn> {
  // payments, income and transfers settle in full; split payments add up to what was received
  if (SETTLE_IN_FULL.includes(draft.type)) draft = { ...draft, received: draft.total, payments: undefined }
  else if (draft.payments?.length) {
    const payments = draft.payments.filter((p) => p.amount > 0)
    draft = { ...draft, payments, received: round2(payments.reduce((a, p) => a + p.amount, 0)), accountId: payments[0]?.accountId ?? draft.accountId }
  }
  return db.transaction('rw', [db.txns, db.settings, db.audit], async () => {
    const settings = await db.settings.get('settings')
    const existing = await db.txns.get(draft.id)
    // an entry moved out of a closed period is still locked
    if (existing && settings?.lockDate && existing.date <= settings.lockDate) throw new TxnError({ key: 'errLocked', vars: { date: settings.lockDate } })
    const problem = validate(draft, settings)
    if (problem) throw new TxnError(problem)
    const t: Txn = { ...draft, updatedAt: Date.now() }
    if (!existing) {
      const s = (await db.settings.get('settings'))!
      const n = s.nextNo[t.type] ?? 1
      if (!t.number) t.number = fmtNumber(s.prefixes[t.type] ?? '', n)
      await db.settings.update('settings', { [`nextNo.${t.type}`]: n + 1 })
      t.createdAt = Date.now()
    }
    await db.txns.put(t)
    // estimates, orders and challans close when converted; invoices keep no status
    const source = t.sourceId ? await db.txns.get(t.sourceId) : undefined
    if (source && !TXN_META[source.type].posts) await db.txns.update(source.id, { status: 'converted' })
    await db.audit.add({ at: Date.now(), action: existing ? 'update' : 'create', entity: 'txn', entityId: t.id, summary: `${t.type} ${t.number} ${t.total}` })
    return t
  })
}

async function assertOpen(db: FirmDB, t: Txn) {
  const s = await db.settings.get('settings')
  if (s?.lockDate && t.date <= s.lockDate) throw new TxnError({ key: 'errLocked', vars: { date: s.lockDate } })
}

export async function cancelTxn(db: FirmDB, t: Txn) {
  await assertOpen(db, t)
  await db.transaction('rw', [db.txns, db.audit], async () => {
    await db.txns.update(t.id, { cancelled: true, status: t.status ? 'cancelled' : undefined, updatedAt: Date.now() })
    await db.audit.add({ at: Date.now(), action: 'cancel', entity: 'txn', entityId: t.id, summary: `${t.type} ${t.number}` })
  })
}

/** delete a transaction; it goes to the recycle bin and can be restored */
export async function deleteTxn(db: FirmDB, t: Txn) {
  await assertOpen(db, t)
  await db.transaction('rw', [db.txns, db.audit, db.bin], async () => {
    const current = (await db.txns.get(t.id)) ?? t
    await db.bin.put({ id: t.id, deletedAt: Date.now(), txn: current })
    await db.txns.delete(t.id)
    // an estimate / order whose invoice is deleted becomes open again
    const source = t.sourceId ? await db.txns.get(t.sourceId) : undefined
    if (source && !TXN_META[source.type].posts) {
      const others = await db.txns.where('sourceId').equals(source.id).count()
      if (others === 0) await db.txns.update(source.id, { status: 'open' })
    }
    await db.audit.add({ at: Date.now(), action: 'delete', entity: 'txn', entityId: t.id, summary: `${t.type} ${t.number} ${t.total}` })
  })
}

/** put a deleted transaction back with its old number */
export async function restoreTxn(db: FirmDB, id: string) {
  await db.transaction('rw', [db.txns, db.audit, db.bin, db.settings], async () => {
    const entry = await db.bin.get(id)
    if (!entry) return
    await assertOpen(db, entry.txn)
    await db.txns.put({ ...entry.txn, updatedAt: Date.now() })
    await db.bin.delete(id)
    const source = entry.txn.sourceId ? await db.txns.get(entry.txn.sourceId) : undefined
    if (source && !TXN_META[source.type].posts) await db.txns.update(source.id, { status: 'converted' })
    await db.audit.add({ at: Date.now(), action: 'restore', entity: 'txn', entityId: id, summary: `${entry.txn.type} ${entry.txn.number}` })
  })
}

/** mark a cheque payment as cleared into its account on a date, or bounced */
export async function setChequeStatus(db: FirmDB, t: Txn, status: 'open' | 'cleared' | 'bounced', clearedOn?: string, accountId?: string) {
  await assertOpen(db, t)
  await db.transaction('rw', [db.txns, db.audit], async () => {
    await db.txns.update(t.id, { chequeStatus: status, clearedOn: status === 'cleared' ? clearedOn : undefined, accountId: accountId ?? t.accountId, updatedAt: Date.now() })
    await db.audit.add({ at: Date.now(), action: 'update', entity: 'txn', entityId: t.id, summary: `cheque ${t.number} ${status}` })
  })
}

export class TxnError extends Error {
  problem: TxnProblem
  constructor(problem: TxnProblem) {
    super(problem.key)
    this.problem = problem
  }
}
