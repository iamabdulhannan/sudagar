import { uid } from '../../lib/db'
import { round2 } from '../../lib/format'
import { pointsValue } from '../../lib/loyalty'
import { blankTxn, calcLine, calcTotals, lineFor, priceFor } from '../../lib/txn'
import type { ID, Item, Party, Settings, Txn, TxnLine } from '../../lib/types'

/** a bill line on the POS screen: a TxnLine plus a key and whether the cashier typed the rate */
export interface CartLine extends TxnLine {
  key: string
  manualRate?: boolean
}

/** the bill being rung up */
export interface PosDraft {
  id: ID
  lines: CartLine[]
  partyId?: ID
  /** bill discount entered as a percent or an amount */
  discountMode: 'pct' | 'amt'
  discountPct: number
  discount: number
  /** loyalty points the customer wants to spend on this bill */
  pointsRedeemed?: number
}

export interface HeldBill {
  id: ID
  at: number
  draft: PosDraft
  total: number
  /** party name or empty for walk-in */
  label: string
}

export const newDraft = (): PosDraft => ({ id: uid(), lines: [], discountMode: 'pct', discountPct: 0, discount: 0 })

/** new cart line for an item */
export function cartLine(item: Item, party: Party | undefined, s: Settings): CartLine {
  return { ...lineFor(item, 'sale', party, s, 1), key: uid() }
}

/** rate per line unit from the price list (wholesale applies by party tier or base quantity) */
export function autoRate(l: CartLine, item: Item, party: Party | undefined, s: Settings): number {
  return priceFor(item, 'sale', party, l.qty * (l.factor || 1), s) * (l.factor || 1)
}

/** recompute a line after a change; reprices it unless the cashier typed the rate */
export function refresh(l: CartLine, item: Item | undefined, party: Party | undefined, s: Settings): CartLine {
  const rate = item && !l.manualRate ? autoRate(l, item, party, s) : l.rate
  return { ...calcLine({ ...l, rate }, s.features.tax), key: l.key, manualRate: l.manualRate }
}

/**
 * most points that can be spent on a bill: not more than the customer has, and not more than
 * the bill (after the normal discount) is worth
 */
export function maxRedeemable(available: number, payable: number, pointValue: number): number {
  if (!(pointValue > 0) || !(available > 0) || !(payable > 0)) return 0
  return Math.max(0, Math.floor(Math.min(available, payable / pointValue + 1e-9)))
}

/**
 * the sale invoice the draft becomes (totals calculated, POS-only fields removed).
 * Points to redeem are capped by `availablePoints` and the bill, and their value is added to the discount.
 */
export function draftToTxn(d: PosDraft, s: Settings, availablePoints = 0): Txn {
  const lines: TxnLine[] = d.lines.map(({ key: _k, manualRate: _m, ...l }) => l)
  const base = calcTotals({
    ...blankTxn('sale', s),
    id: d.id, lines, partyId: d.partyId, pos: true,
    discountPct: d.discountMode === 'pct' ? d.discountPct : 0,
    discount: d.discountMode === 'amt' ? d.discount : 0,
  }, s)
  const want = Math.floor(d.pointsRedeemed ?? 0)
  if (!s.features.loyalty || !d.partyId || want <= 0) return base
  const payable = base.subtotal - base.discount + base.charges
  const points = Math.min(want, maxRedeemable(availablePoints, payable, s.loyalty.pointValue))
  if (points <= 0) return base
  return calcTotals({ ...base, discountPct: 0, discount: round2(base.discount + pointsValue(points, s)), pointsRedeemed: points }, s)
}

/** base units of an item already in the cart, optionally leaving out one line */
export function cartQty(lines: CartLine[], itemId: ID, exceptKey?: string): number {
  return lines.reduce((a, l) => (l.itemId === itemId && l.key !== exceptKey ? a + l.qty * (l.factor || 1) : a), 0)
}

// ---------- held bills and last sale (per business, in localStorage) ----------

const heldKey = (firmId: string) => `saudagar.pos.held.${firmId}`
const godownKey = (firmId: string) => `saudagar.pos.godown.${firmId}`
const lastKey = (firmId: string) => `saudagar.pos.last.${firmId}`

export function loadHeld(firmId: string): HeldBill[] {
  try {
    const raw = localStorage.getItem(heldKey(firmId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((b) => b && b.draft && Array.isArray(b.draft.lines)) : []
  } catch {
    return []
  }
}

export function saveHeld(firmId: string, list: HeldBill[]) {
  try { localStorage.setItem(heldKey(firmId), JSON.stringify(list)) } catch { /* storage full or blocked */ }
}

export function loadLastSale(firmId: string): ID | null {
  try { return localStorage.getItem(lastKey(firmId)) } catch { return null }
}

export function saveLastSale(firmId: string, id: ID) {
  try { localStorage.setItem(lastKey(firmId), id) } catch { /* ignore */ }
}

/** the godown this POS counter sells from */
export function loadPosGodown(firmId: string): ID | null {
  try { return localStorage.getItem(godownKey(firmId)) } catch { return null }
}

export function savePosGodown(firmId: string, id: ID) {
  try { localStorage.setItem(godownKey(firmId), id) } catch { /* ignore */ }
}

/** quick cash amounts: exact, then the next round 100 / 500 / 1000 / 5000 above the total */
export function quickAmounts(total: number): number[] {
  const out = [total]
  for (const step of [100, 500, 1000, 5000]) {
    const v = Math.ceil(total / step) * step
    if (v > total) out.push(v)
  }
  return [...new Set(out)].filter((v) => v > 0)
}

/** sum of split payment rows and what is still left to pay */
export function splitTotals(rows: { amount: number }[], total: number) {
  const paid = round2(rows.reduce((a, r) => a + (Number(r.amount) || 0), 0))
  return { paid, remaining: round2(total - paid) }
}
