import { round2 } from '../../lib/format'
import { pointsValue } from '../../lib/loyalty'
import type { Account, ID, PaymentMode, PaymentSplit, Settings, Txn } from '../../lib/types'

/**
 * Pure helpers for payments on documents: split payments, change for cash handed over,
 * cheque defaults, the last rate a party paid, and loyalty points as a discount.
 * No React, so tests run them in node.
 */

// ---------- split payments ----------

export const splitSum = (ps: PaymentSplit[] | undefined) => round2((ps ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0))

/** what is still to be allocated to a payment row (negative when rows add up to more than the total) */
export const splitRemaining = (total: number, ps: PaymentSplit[] | undefined) => round2(total - splitSum(ps))

const modeOf = (k?: Account['kind']): PaymentMode => (k === 'bank' ? 'bank' : k === 'wallet' ? 'wallet' : 'cash')

/** turn a single payment into split rows: the current account first, a second account for the rest */
export function startSplit(t: Txn, accounts: Account[]): PaymentSplit[] {
  const usable = accounts.filter((a) => a.active && a.kind !== 'loan')
  const first = t.accountId ?? usable[0]?.id ?? ''
  const other = usable.find((a) => a.id !== first)
  const paid = t.received > 0 ? t.received : t.total
  return [
    { accountId: first, mode: t.paymentMode ?? 'cash', amount: round2(paid) },
    { accountId: other?.id ?? first, mode: other ? modeOf(other.kind) : 'card', amount: 0 },
  ]
}

/** back to one account: keep what was allocated, on the first row's account */
export function endSplit(t: Txn): Partial<Txn> {
  const rows = (t.payments ?? []).filter((p) => p.amount > 0)
  const first = rows[0] ?? t.payments?.[0]
  return { payments: undefined, received: splitSum(rows), accountId: first?.accountId || t.accountId, paymentMode: first?.mode ?? t.paymentMode }
}

/** true when a saved document was paid in more than one way */
export const isSplit = (t: Txn) => (t.payments?.filter((p) => p.amount > 0).length ?? 0) > 1

/** change handed back when the customer gave more cash than the total */
export const changeDue = (t: Pick<Txn, 'tendered' | 'total'>) =>
  t.tendered && t.tendered > t.total + 0.001 ? round2(t.tendered - t.total) : 0

// ---------- cheques ----------

/**
 * Cheque fields follow the payment mode: a new cheque payment starts "in hand / issued",
 * and other modes carry no cheque state. Saved cheques without a status (made before
 * cheque tracking) are left as they are so their effect on the books does not change.
 */
export function chequeDefaults(t: Txn): Txn {
  if (t.type !== 'payment_in' && t.type !== 'payment_out') return t
  if (t.paymentMode !== 'cheque') {
    if (t.chequeStatus === undefined && t.chequeDate === undefined && t.clearedOn === undefined) return t
    return { ...t, chequeStatus: undefined, chequeDate: undefined, clearedOn: undefined }
  }
  if (!t.chequeStatus && !t.number) return { ...t, chequeStatus: 'open', chequeDate: t.chequeDate ?? t.date }
  if (t.chequeStatus !== 'cleared' && t.clearedOn) return { ...t, clearedOn: undefined }
  return t
}

// ---------- last rate for a party ----------

export interface LastRate {
  /** rate on the line, per its unit */
  rate: number
  unit: string
  factor: number
  date: string
  number: string
  txnId: ID
}

/** the latest rate of each item on this party's sale invoices (or purchase bills) */
export function lastRates(txns: Txn[], partyId: ID | undefined, type: 'sale' | 'purchase', excludeId?: ID): Map<ID, LastRate> {
  const out = new Map<ID, LastRate & { createdAt: number }>()
  if (!partyId) return out
  for (const t of txns) {
    if (t.type !== type || t.partyId !== partyId || t.cancelled || t.id === excludeId) continue
    for (const l of t.lines) {
      if (!l.itemId || !(l.rate > 0)) continue
      const cur = out.get(l.itemId)
      if (cur && (cur.date > t.date || (cur.date === t.date && cur.createdAt >= t.createdAt))) continue
      out.set(l.itemId, { rate: l.rate, unit: l.unit, factor: l.factor || 1, date: t.date, number: t.number, txnId: t.id, createdAt: t.createdAt })
    }
  }
  return out
}

/** a last rate converted to a line's unit (box vs piece) */
export const rateForFactor = (last: Pick<LastRate, 'rate' | 'factor'>, factor: number) => round2((last.rate / (last.factor || 1)) * (factor || 1))

// ---------- loyalty points ----------

/** the part of a draft's discount the user gave (without the value of redeemed points) */
export function manualDiscount(t: Txn, s: Settings): number {
  if (t.discountPct > 0) return round2((t.subtotal * t.discountPct) / 100)
  return Math.max(0, round2((t.discount || 0) - pointsValue(t.pointsRedeemed || 0, s)))
}

/** most points that can be spent: what the customer has, and no more than the bill */
export function maxRedeemable(available: number, payable: number, s: Settings): number {
  if (!(s.loyalty.pointValue > 0) || payable <= 0) return 0
  return Math.max(0, Math.min(Math.floor(available), Math.floor(round2(payable) / s.loyalty.pointValue + 1e-9)))
}

/** the bill amount points can pay for: subtotal less the user's discount plus charges */
export const pointsPayable = (t: Txn, s: Settings) => round2(t.subtotal - manualDiscount(t, s) + (t.charges || 0))

/**
 * patch for redeeming `points`: their value joins the invoice discount (as an amount, so a
 * percentage discount is turned into its amount first).
 */
export function redeemPatch(t: Txn, points: number, s: Settings): Partial<Txn> {
  const n = Math.max(0, Math.floor(points || 0))
  if (n === 0 && !t.pointsRedeemed) return {}
  const manual = manualDiscount(t, s)
  return { pointsRedeemed: n || undefined, discountPct: 0, discount: round2(manual + pointsValue(n, s)) }
}
