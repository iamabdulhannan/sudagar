import type { InvoiceDue } from '../../lib/ledger'
import { round2, round3 } from '../../lib/format'
import { HAS_STATUS, TXN_META, TxnError, baseQty, blankTxn, calcTotals, priceFor } from '../../lib/txn'
import type { Features, ID, Item, Party, Settings, Txn, TxnLine, TxnType } from '../../lib/types'

/**
 * Pure helpers of the transactions module (no React), shared by the list, form, view and print.
 * Kept free of UI imports so tests can run them in node.
 */

export type PayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue'
export type DocStatus = PayStatus | 'open' | 'converted' | 'cancelled'

/** types whose open amount is tracked per invoice in books.dues */
export const isInvoice = (type: TxnType) => type === 'sale' || type === 'purchase'
export const isReturn = (type: TxnType) => type === 'sale_return' || type === 'purchase_return'
/** estimates, orders and challans: no effect on books, open until converted */
export const isDraftDoc = (type: TxnType) => HAS_STATUS.includes(type)
/** stock transfers and manufacturing entries */
export const isStockDoc = (type: TxnType) => TXN_META[type].side === 'stock'
/** owner's money: capital put in, drawings taken out */
export const isOwnerMoney = (type: TxnType) => type === 'capital_in' || type === 'drawing'
/** item documents (have a lines grid); expense has its own form */
export const isItemDoc = (type: TxnType) => TXN_META[type].lines && type !== 'expense'

/** ItemSearch / PartyPicker side for a type */
export const itemSide = (type: TxnType): 'sale' | 'purchase' => (TXN_META[type].side === 'sale' ? 'sale' : 'purchase')
export const partySide = (type: TxnType): 'sale' | 'purchase' | 'money' =>
  type === 'payment_in' ? 'sale' : type === 'payment_out' || type === 'expense' ? 'purchase' : TXN_META[type].side === 'stock' ? 'money' : TXN_META[type].side

/** current status of a document (undefined for payments, income and transfers that are not cancelled) */
export function docStatus(t: Txn, dues: Map<ID, InvoiceDue>, todayStr: string): DocStatus | undefined {
  if (t.cancelled) return 'cancelled'
  if (isInvoice(t.type)) {
    const d = dues.get(t.id)
    const due = d ? d.due : round2(t.total - t.received)
    if (due <= 0.001) return 'paid'
    if (t.dueDate && t.dueDate < todayStr) return 'overdue'
    if (d) return d.status
    return t.received > 0 ? 'partial' : 'unpaid'
  }
  if (isDraftDoc(t.type)) return t.status ?? 'open'
  return undefined
}

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'brand'
export const STATUS_TONE: Record<DocStatus, Tone> = {
  paid: 'good', partial: 'warn', unpaid: 'bad', overdue: 'bad', open: 'info', converted: 'good', cancelled: 'neutral',
}
/** i18n key for a status */
export const statusKey = (s: DocStatus) => (s === 'partial' ? 'partial' : s)

/** what is still open on a document (invoice due, unsettled part of a return or credit expense) */
export function balanceDue(t: Txn, dues: Map<ID, InvoiceDue>): number {
  if (t.cancelled) return 0
  if (isInvoice(t.type)) return dues.get(t.id)?.due ?? round2(t.total - t.received)
  if (isReturn(t.type) || t.type === 'expense') return round2(t.total - t.received)
  return 0
}

/** amount settled so far */
export function amountPaid(t: Txn, dues: Map<ID, InvoiceDue>): number {
  if (isInvoice(t.type)) return dues.get(t.id)?.paid ?? t.received
  return t.received
}

/** case-insensitive search over number, party, items, ref no and notes */
export function matchesSearch(t: Txn, q: string, partyName?: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const hay = [t.number, partyName, t.partyName, t.partyPhone, t.refNo, t.notes, ...t.lines.map((l) => l.name)]
  return hay.some((h) => !!h && h.toLowerCase().includes(s))
}

/**
 * phone number for wa.me: digits only, Pakistani local numbers to international.
 * 0300-1234567 → 923001234567, +92 300 1234567 → 923001234567, 3001234567 → 923001234567
 */
export function normalizePkPhone(phone?: string): string {
  let d = (phone ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0092')) d = d.slice(2)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('03') && d.length === 11) d = '92' + d.slice(1)
  else if (d.startsWith('3') && d.length === 10) d = '92' + d
  return d
}

/** i18n key of the printed document title */
export function docTitleKey(type: TxnType, f: Pick<Features, 'tax'>): string {
  if (type === 'sale') return f.tax ? 'dt_taxInvoice' : 'dt_sale'
  return 'dt_' + type
}

/** add an item line, or add its quantity to an existing line of the same item and unit */
export function addOrIncrement(lines: TxnLine[], line: TxnLine): TxnLine[] {
  const i = lines.findIndex((l) => l.itemId && l.itemId === line.itemId && (l.factor || 1) === (line.factor || 1) && !l.serial && !l.batch)
  if (i < 0) return [...lines, line]
  const next = [...lines]
  next[i] = { ...next[i], qty: round3(next[i].qty + line.qty) }
  return next
}

/** the automatic price of a line (party tier, wholesale quantity, unit factor) */
export function autoRate(item: Item, type: TxnType, party: Party | undefined, l: Pick<TxnLine, 'qty' | 'factor'>, s: Settings) {
  const f = l.factor || 1
  return round2(priceFor(item, itemSide(type), party, l.qty * f, s) * f)
}

/** lines and party before / after a change, for re-pricing */
interface PricingCtx { lines: TxnLine[]; party?: Party }

/**
 * re-price lines after a party or quantity change, but only lines whose rate is still the
 * automatic one (a rate the user typed is kept).
 */
export function repriceLines(lines: TxnLine[], prev: PricingCtx, next: PricingCtx, items: Map<ID, Item>, type: TxnType, s: Settings): TxnLine[] {
  return lines.map((l, i) => {
    const item = l.itemId ? items.get(l.itemId) : undefined
    if (!item) return l
    const before = prev.lines[i] ?? l
    const was = autoRate(item, type, prev.party, before, s)
    if (Math.abs(was - l.rate) > 0.001) return l
    return { ...l, rate: autoRate(item, type, next.party, l, s) }
  })
}

/** switch a line to another unit of its item, scaling the rate */
export function changeUnit(l: TxnLine, item: Item | undefined, unit: string): TxnLine {
  if (!item) return { ...l, unit }
  const factor = unit === item.altUnit && item.altFactor ? item.altFactor : 1
  const old = l.factor || 1
  return { ...l, unit, factor, rate: round2((l.rate / old) * factor) }
}

/** a fresh copy of a document: new id, no number, today, open */
export function duplicateDraft(src: Txn, s: Settings): Txn {
  const base = blankTxn(src.type, s)
  return calcTotals({
    ...src,
    id: base.id, number: '', date: base.date, createdAt: base.createdAt, updatedAt: base.updatedAt,
    dueDate: base.dueDate, status: base.status, cancelled: undefined, sourceId: undefined, againstId: undefined,
    pos: undefined, received: 0, lines: src.lines.map((l) => ({ ...l, serial: undefined })),
  }, s)
}

export interface StockShort { itemId: ID; name: string; need: number; inStock: number }

/**
 * items on a stock-reducing document that need more than is on hand. When editing,
 * the original document's quantities are added back first.
 */
export function stockShortages(t: Txn, qty: Map<ID, number>, items: Map<ID, Item>, original?: Txn): StockShort[] {
  if (TXN_META[t.type].stock !== -1) return []
  const need = new Map<ID, number>()
  for (const l of t.lines) {
    const item = l.itemId ? items.get(l.itemId) : undefined
    if (!item || item.kind !== 'product') continue
    need.set(item.id, (need.get(item.id) ?? 0) + baseQty(l))
  }
  const back = new Map<ID, number>()
  if (original && !original.cancelled && TXN_META[original.type].stock === -1) {
    for (const l of original.lines) if (l.itemId) back.set(l.itemId, (back.get(l.itemId) ?? 0) + baseQty(l))
  }
  const out: StockShort[] = []
  for (const [id, n] of need) {
    const have = round3((qty.get(id) ?? 0) + (back.get(id) ?? 0))
    if (n > have + 0.0005) out.push({ itemId: id, name: items.get(id)!.name, need: round3(n), inStock: have })
  }
  return out
}

/** documents linked to this one */
export function linkedDocs(t: Txn, txns: Txn[]) {
  return {
    source: t.sourceId ? txns.find((x) => x.id === t.sourceId) : undefined,
    against: t.againstId ? txns.find((x) => x.id === t.againstId) : undefined,
    conversions: txns.filter((x) => x.sourceId === t.id),
    returns: txns.filter((x) => x.againstId === t.id),
  }
}

/** conversion targets for a document, respecting the turned-on features */
export function convertTargets(t: Txn, f: Features): TxnType[] {
  if (t.cancelled) return []
  if (isDraftDoc(t.type) && t.status === 'converted') return []
  return TXN_META[t.type].convertTo.filter((to) =>
    (to !== 'delivery_challan' || f.challans) && (to !== 'sale_order' || f.orders) && (to !== 'purchase_order' || f.orders) && (to !== 'estimate' || f.estimates))
}

/** query string to start a conversion (returns use against=, the rest from=) */
export const convertQuery = (from: Txn, to: TxnType) => (isReturn(to) ? 'against=' : 'from=') + from.id

/** the number a new document will get */
export const previewNumber = (type: TxnType, s: Settings) => (s.prefixes[type] ?? '') + String(s.nextNo[type] ?? 1).padStart(4, '0')

/** label key of "paid now" for a type */
export function paidNowKey(type: TxnType) {
  switch (type) {
    case 'sale': return 'txReceivedNow'
    case 'sale_return': return 'txRefundedNow'
    case 'purchase_return': return 'txRefundReceived'
    default: return 'txPaidNow'
  }
}

/** message for a failed save / cancel / delete: the TxnError's i18n key (with its vars), or a generic one */
export function txnErrorText(e: unknown, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (e instanceof TxnError) return t(e.problem.key, e.problem.vars)
  console.error(e)
  return t('somethingWrong')
}
