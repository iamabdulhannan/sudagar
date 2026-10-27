import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../src/lib/db'
import { blankTxn, calcTotals, lineFor } from '../src/lib/txn'
import type { Account, Item, Txn } from '../src/lib/types'
import { normalize } from '../src/components/txn/form/useDraft'
import { isDraftDoc, isStockDoc, txnErrorText } from '../src/components/txn/logic'
import { TxnError } from '../src/lib/txn'
import {
  changeDue, chequeDefaults, endSplit, isSplit, lastRates, manualDiscount, maxRedeemable, pointsPayable, rateForFactor,
  redeemPatch, splitRemaining, splitSum, startSplit,
} from '../src/components/txn/payLogic'

const s = defaultSettings('retail')
s.features.tax = false
s.features.roundOff = false
s.features.loyalty = true
s.loyalty = { earnPer: 100, pointValue: 2 }

const soap: Item = {
  id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', altUnit: 'box', altFactor: 12, salePrice: 100, purchasePrice: 70,
  taxRate: 0, priceIncludesTax: false, openingStock: 50, openingDate: '2026-01-01', active: true, createdAt: 0,
}
const acc = (id: string, kind: Account['kind']): Account => ({ id, kind, name: id, openingBalance: 0, openingDate: '2026-01-01', active: true, createdAt: 0 })
const accounts = [acc('cash', 'cash'), acc('loan', 'loan'), acc('bank', 'bank')]
const sale = (over: Partial<Txn> = {}, qty = 10): Txn =>
  calcTotals({ ...blankTxn('sale', s), partyId: 'ali', accountId: 'cash', lines: [lineFor(soap, 'sale', undefined, s, qty)], ...over }, s)

test('split rows: sum, remaining, start and end', () => {
  const t = sale({ received: 600 })
  assert.equal(t.total, 1000)
  const rows = startSplit(t, accounts)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { accountId: 'cash', mode: 'cash', amount: 600 })
  // the second row uses another account, never a loan
  assert.equal(rows[1].accountId, 'bank')
  assert.equal(rows[1].mode, 'bank')
  assert.equal(splitSum(rows), 600)
  assert.equal(splitRemaining(t.total, rows), 400)
  const back = endSplit({ ...t, payments: [{ accountId: 'bank', mode: 'card', amount: 0 }, { accountId: 'cash', mode: 'cash', amount: 250.5 }] })
  assert.equal(back.payments, undefined)
  assert.equal(back.received, 250.5)
  assert.equal(back.accountId, 'cash')
  assert.equal(isSplit({ ...t, payments: [{ accountId: 'a', mode: 'cash', amount: 1 }, { accountId: 'b', mode: 'card', amount: 1 }] }), true)
  assert.equal(isSplit({ ...t, payments: [{ accountId: 'a', mode: 'cash', amount: 1 }, { accountId: 'b', mode: 'card', amount: 0 }] }), false)
})

test('normalize: received is the sum of split rows, even with full payment ticked', () => {
  const t = sale({ payments: [{ accountId: 'cash', mode: 'cash', amount: 300 }, { accountId: 'bank', mode: 'card', amount: 200 }] })
  assert.equal(normalize(t, s, true).received, 500)
  // payments do not apply to documents that settle in full
  const p = normalize({ ...blankTxn('payment_in', s), total: 50, payments: [{ accountId: 'x', mode: 'cash', amount: 1 }] }, s, false)
  assert.equal(p.payments, undefined)
  assert.equal(p.received, 50)
})

test('change for cash handed over', () => {
  assert.equal(changeDue({ total: 1250, tendered: 1500 }), 250)
  assert.equal(changeDue({ total: 1250, tendered: 1250 }), 0)
  assert.equal(changeDue({ total: 1250 }), 0)
})

test('cheque defaults: new cheques start open, other modes carry no cheque state, old ones stay', () => {
  const p = { ...blankTxn('payment_in', s), date: '2026-03-01', paymentMode: 'cheque' as const }
  const d = chequeDefaults(p)
  assert.equal(d.chequeStatus, 'open')
  assert.equal(d.chequeDate, '2026-03-01')
  const cash = chequeDefaults({ ...d, paymentMode: 'cash' })
  assert.equal(cash.chequeStatus, undefined)
  assert.equal(cash.chequeDate, undefined)
  // a saved cheque from before tracking (has a number, no status) is left untracked
  assert.equal(chequeDefaults({ ...p, number: 'PI-0001' }).chequeStatus, undefined)
  // clearedOn only with cleared
  assert.equal(chequeDefaults({ ...d, chequeStatus: 'open', clearedOn: '2026-03-02' }).clearedOn, undefined)
  // not for sales
  const sl = sale({ paymentMode: 'cheque' })
  assert.equal(chequeDefaults(sl), sl)
})

test('last rate per item for a party, newest first, in the line unit', () => {
  const a = sale({ id: 'a', date: '2026-01-05', createdAt: 1, lines: [{ ...lineFor(soap, 'sale', undefined, s, 1), rate: 95 }] })
  const b = sale({ id: 'b', date: '2026-01-07', createdAt: 2, lines: [{ ...lineFor(soap, 'sale', undefined, s, 1), rate: 1080, unit: 'box', factor: 12 }] })
  const other = sale({ id: 'c', date: '2026-02-01', partyId: 'zeb', createdAt: 3, lines: [{ ...lineFor(soap, 'sale', undefined, s, 1), rate: 50 }] })
  const cancelled = sale({ id: 'd', date: '2026-03-01', createdAt: 4, cancelled: true, lines: [{ ...lineFor(soap, 'sale', undefined, s, 1), rate: 10 }] })
  const m = lastRates([a, b, other, cancelled], 'ali', 'sale')
  const last = m.get('soap')!
  assert.equal(last.txnId, 'b')
  assert.equal(rateForFactor(last, 1), 90)
  assert.equal(rateForFactor(last, 12), 1080)
  // editing b: the one before it
  assert.equal(lastRates([a, b], 'ali', 'sale', 'b').get('soap')!.rate, 95)
  assert.equal(lastRates([a, b], undefined, 'sale').size, 0)
  assert.equal(lastRates([a, b], 'ali', 'purchase').size, 0)
})

test('loyalty points join the discount and are capped by points and bill', () => {
  const t = sale({ discount: 100 }) // subtotal 1000, discount 100
  assert.equal(pointsPayable(t, s), 900)
  assert.equal(maxRedeemable(1000, pointsPayable(t, s), s), 450) // Rs 2 each, bill 900
  assert.equal(maxRedeemable(30, 900, s), 30)
  assert.equal(maxRedeemable(30, 0, s), 0)
  const r = calcTotals({ ...t, ...redeemPatch(t, 30, s) }, s)
  assert.equal(r.pointsRedeemed, 30)
  assert.equal(r.discount, 160)
  assert.equal(r.total, 840)
  assert.equal(manualDiscount(r, s), 100)
  // changing the points keeps the user's own discount
  const r2 = calcTotals({ ...r, ...redeemPatch(r, 10, s) }, s)
  assert.equal(r2.discount, 120)
  // a percentage discount becomes its amount
  const pct = sale({ discountPct: 10 })
  const r3 = calcTotals({ ...pct, ...redeemPatch(pct, 5, s) }, s)
  assert.equal(r3.discountPct, 0)
  assert.equal(r3.discount, 110)
  // back to zero removes the points
  const r4 = calcTotals({ ...r3, ...redeemPatch(r3, 0, s) }, s)
  assert.equal(r4.pointsRedeemed, undefined)
  assert.equal(r4.discount, 100)
  assert.deepEqual(redeemPatch(pct, 0, s), {})
})

test('document kinds and error text', () => {
  assert.equal(isDraftDoc('estimate'), true)
  assert.equal(isDraftDoc('stock_transfer'), false)
  assert.equal(isStockDoc('manufacture'), true)
  const tr = (k: string, v?: Record<string, string | number>) => k + (v ? JSON.stringify(v) : '')
  assert.equal(txnErrorText(new TxnError({ key: 'errLocked', vars: { date: '2026-01-31' } }), tr), 'errLocked{"date":"2026-01-31"}')
  const orig = console.error
  console.error = () => {}
  assert.equal(txnErrorText(new Error('x'), tr), 'somethingWrong')
  console.error = orig
})
