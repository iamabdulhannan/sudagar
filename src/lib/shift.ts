import { SHIFT_PREFIX, uid, type FirmDB } from './db'
import { round2 } from './format'
import { blankTxn, moneySplits, saveTxn } from './txn'
import type { CashMove, CashMoveType, Denoms, ID, PaymentMode, Settings, Shift, Txn } from './types'

/**
 * Cash shifts, like a shop POS: the cashier opens the drawer with a counted float, every sale,
 * refund and payment through the drawer's cash account is tracked, cash put in or taken out is
 * recorded (pay in, pay out, drop to the safe or bank), and at closing the cash is counted note by
 * note. The gap between counted and expected cash is posted to the books as cash short or excess,
 * so the cash account always matches the money in the drawer.
 */

// ---------- this device ----------

const DEVICE_KEY = 'saudagar.deviceId'
const REGISTER_KEY = 'saudagar.register'

/** a stable id for this browser, so a shift continues only on the device that opened it */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = uid(); localStorage.setItem(DEVICE_KEY, id) }
    return id
  } catch { return 'device' }
}

export function registerName(): string {
  try { return localStorage.getItem(REGISTER_KEY) || 'Counter 1' } catch { return 'Counter 1' }
}

export function setRegisterName(name: string) {
  try { localStorage.setItem(REGISTER_KEY, name.trim() || 'Counter 1') } catch { /* private mode */ }
}

export const openShiftOf = (shifts: Shift[], device = deviceId()) => shifts.find((s) => s.status === 'open' && s.deviceId === device)

// ---------- counting ----------

export const countTotal = (count: Denoms | undefined) =>
  round2(Object.entries(count ?? {}).reduce((a, [d, n]) => a + Number(d) * (Number(n) || 0), 0))

// ---------- what went through the drawer ----------

export interface ShiftSummary {
  /** bills (sales) in the shift and their total */
  saleCount: number
  saleTotal: number
  returnCount: number
  returnTotal: number
  discountTotal: number
  taxTotal: number
  /** sales left on credit (udhaar) */
  creditSales: number
  /** money received by payment mode across all accounts: cash, card, wallet ... */
  byMode: Partial<Record<PaymentMode, number>>
  /** cash movements of the drawer account */
  cash: {
    sales: number
    refunds: number
    receipts: number
    payments: number
    other: number
    payIns: number
    payOuts: number
    drops: number
  }
  expected: number
}

const inWindow = (t: Txn, s: Shift, until: number) => !t.cancelled && t.createdAt >= s.openedAt && t.createdAt <= until

/** everything the shift did, from the transactions created while it was open */
export function summarizeShift(s: Shift, txns: Txn[], until = s.closedAt ?? Date.now()): ShiftSummary {
  const moveTxn = new Set(s.moves.map((m) => m.txnId).filter(Boolean) as string[])
  for (const id of s.adjustTxnIds ?? []) moveTxn.add(id)
  const sum: ShiftSummary = {
    saleCount: 0, saleTotal: 0, returnCount: 0, returnTotal: 0, discountTotal: 0, taxTotal: 0, creditSales: 0, byMode: {},
    cash: { sales: 0, refunds: 0, receipts: 0, payments: 0, other: 0, payIns: 0, payOuts: 0, drops: 0 },
    expected: 0,
  }
  for (const t of txns) {
    if (!inWindow(t, s, until)) continue
    if (t.type === 'sale') {
      sum.saleCount++
      sum.saleTotal += t.total
      sum.discountTotal += t.discount + t.lines.reduce((a, l) => a + (l.discount || 0), 0)
      sum.taxTotal += t.taxTotal
      sum.creditSales += t.total - t.received
    }
    if (t.type === 'sale_return') { sum.returnCount++; sum.returnTotal += t.total }
    for (const p of moneySplits(t)) {
      if (t.type === 'sale' || t.type === 'payment_in') sum.byMode[p.mode] = (sum.byMode[p.mode] ?? 0) + p.amount
    }
    if (moveTxn.has(t.id)) continue
    // cash in and out of the drawer account
    let delta = 0
    if (t.type === 'transfer') {
      if (t.toAccountId === s.accountId) delta += t.total
      if (t.accountId === s.accountId) delta -= t.total
    } else if (t.type === 'payment_in' || t.type === 'payment_out') {
      // a cheque does not go into the drawer
      if (t.accountId === s.accountId && t.paymentMode !== 'cheque') delta = t.type === 'payment_in' ? t.total : -t.total
    } else {
      const inflow = t.type === 'sale' || t.type === 'purchase_return' || t.type === 'other_income' || t.type === 'capital_in'
      for (const p of moneySplits(t)) if (p.accountId === s.accountId) delta += inflow ? p.amount : -p.amount
    }
    if (!delta) continue
    if (t.type === 'sale') sum.cash.sales += delta
    else if (t.type === 'sale_return') sum.cash.refunds += delta
    else if (t.type === 'payment_in') sum.cash.receipts += delta
    else if (t.type === 'payment_out' || t.type === 'purchase') sum.cash.payments += delta
    else sum.cash.other += delta
  }
  for (const m of s.moves) {
    if (m.type === 'pay_in') sum.cash.payIns += m.amount
    if (m.type === 'pay_out') sum.cash.payOuts -= m.amount
    if (m.type === 'drop') sum.cash.drops -= m.amount
  }
  const c = sum.cash
  for (const k of Object.keys(c) as (keyof typeof c)[]) c[k] = round2(c[k])
  for (const k of Object.keys(sum.byMode) as PaymentMode[]) sum.byMode[k] = round2(sum.byMode[k]!)
  sum.saleTotal = round2(sum.saleTotal)
  sum.returnTotal = round2(sum.returnTotal)
  sum.discountTotal = round2(sum.discountTotal)
  sum.taxTotal = round2(sum.taxTotal)
  sum.creditSales = round2(sum.creditSales)
  sum.expected = round2(s.openingFloat + c.sales + c.refunds + c.receipts + c.payments + c.other + c.payIns + c.payOuts + c.drops)
  return sum
}

// ---------- actions ----------

async function headId(db: FirmDB, kind: 'expense' | 'income', name: string): Promise<ID> {
  const found = (await db.moneyCategories.where('kind').equals(kind).toArray()).find((c) => c.name === name)
  if (found) return found.id
  const id = uid()
  await db.moneyCategories.add({ id, kind, name })
  return id
}

/** post an over / short as cash excess (income) or cash short (expense) */
async function postDifference(db: FirmDB, s: Settings, accountId: ID, diff: number, note: string): Promise<ID | undefined> {
  const amount = round2(Math.abs(diff))
  if (amount < 0.005) return undefined
  const type = diff > 0 ? 'other_income' : 'expense'
  const categoryId = await headId(db, diff > 0 ? 'income' : 'expense', diff > 0 ? 'Cash excess' : 'Cash short')
  const t = await saveTxn(db, { ...blankTxn(type, s), total: amount, received: amount, accountId, categoryId, notes: note })
  return t.id
}

export async function nextShiftNumber(db: FirmDB): Promise<string> {
  const n = (await db.shifts.count()) + 1
  return SHIFT_PREFIX + String(n).padStart(4, '0')
}

/**
 * Open a shift on this device. If the counted float differs from what the books say is in the
 * drawer account, the gap is posted now so the shift starts from the real cash.
 */
export async function openShift(db: FirmDB, input: {
  accountId: ID; float: number; count?: Denoms; by: string; bookBalance: number; register?: string
}): Promise<Shift> {
  const s = (await db.settings.get('settings'))!
  const diff = round2(input.float - input.bookBalance)
  const adj = await postDifference(db, s, input.accountId, diff, 'Opening count')
  // the shift starts after its own opening adjustment
  const openedAt = Date.now()
  const shift: Shift = {
    id: uid(), number: await nextShiftNumber(db), register: input.register ?? registerName(), deviceId: deviceId(),
    accountId: input.accountId, status: 'open', openedAt, openedBy: input.by,
    openingFloat: round2(input.float), openingCount: input.count, bookAtOpen: round2(input.bookBalance), moves: [],
    adjustTxnIds: adj ? [adj] : [],
  }
  await db.shifts.add(shift)
  await db.audit.add({ at: Date.now(), action: 'create', entity: 'settings', entityId: shift.id, summary: `shift ${shift.number} opened ${shift.openingFloat}` })
  return shift
}

export interface MoveInput {
  type: CashMoveType
  amount: number
  reason?: string
  by: string
  /** pay out: expense head (or 'drawing' for the owner); pay in: 'capital' or an account id; drop: account id */
  target?: string
}

/** cash in / out of the drawer during a shift; each posts its transaction */
export async function addCashMove(db: FirmDB, shift: Shift, m: MoveInput): Promise<Shift> {
  const s = (await db.settings.get('settings'))!
  const amount = round2(m.amount)
  let txnId: ID | undefined
  const base = { received: amount, total: amount, notes: [m.reason, shift.number].filter(Boolean).join(' · ') }
  if (m.type === 'pay_in') {
    const t = !m.target || m.target === 'capital'
      ? await saveTxn(db, { ...blankTxn('capital_in', s), ...base, accountId: shift.accountId })
      : await saveTxn(db, { ...blankTxn('transfer', s), ...base, accountId: m.target, toAccountId: shift.accountId })
    txnId = t.id
  } else if (m.type === 'pay_out') {
    const t = m.target === 'drawing'
      ? await saveTxn(db, { ...blankTxn('drawing', s), ...base, accountId: shift.accountId })
      : await saveTxn(db, { ...blankTxn('expense', s), ...base, accountId: shift.accountId, categoryId: m.target })
    txnId = t.id
  } else if (m.type === 'drop') {
    if (!m.target) throw new Error('drop needs a destination account')
    const t = await saveTxn(db, { ...blankTxn('transfer', s), ...base, accountId: shift.accountId, toAccountId: m.target })
    txnId = t.id
  }
  const move: CashMove = { id: uid(), at: Date.now(), type: m.type, amount: m.type === 'no_sale' ? 0 : amount, reason: m.reason, by: m.by, txnId }
  const next = { ...shift, moves: [...shift.moves, move] }
  await db.shifts.put(next)
  return next
}

/** close with the counted cash; the over / short is posted to the books */
export async function closeShift(db: FirmDB, shift: Shift, input: { count?: Denoms; counted: number; by: string; notes?: string }): Promise<Shift> {
  const s = (await db.settings.get('settings'))!
  const closedAt = Date.now()
  const txns = await db.txns.toArray()
  const sum = summarizeShift(shift, txns, closedAt)
  const counted = round2(input.counted)
  const difference = round2(counted - sum.expected)
  const adj = await postDifference(db, s, shift.accountId, difference, `Closing count ${shift.number}`)
  const closed: Shift = {
    ...shift, status: 'closed', closedAt, closedBy: input.by, countedCash: counted, closingCount: input.count,
    expectedCash: sum.expected, difference, notes: input.notes,
    adjustTxnIds: [...(shift.adjustTxnIds ?? []), ...(adj ? [adj] : [])],
  }
  await db.shifts.put(closed)
  await db.audit.add({ at: Date.now(), action: 'update', entity: 'settings', entityId: shift.id, summary: `shift ${shift.number} closed ${counted} (${difference >= 0 ? '+' : ''}${difference})` })
  return closed
}
