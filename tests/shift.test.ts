import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { FirmDB, seedFirm, uid } from '../src/lib/db'
import { computeBooks } from '../src/lib/ledger'
import { addCashMove, closeShift, countTotal, openShift, summarizeShift } from '../src/lib/shift'
import { blankTxn, calcTotals, lineFor, saveTxn } from '../src/lib/txn'
import type { Item } from '../src/lib/types'

const pause = () => new Promise((r) => setTimeout(r, 3))

test('a cash shift: float, sales, pay in / out, drop, count and over / short', async () => {
  const db = new FirmDB('shift-test-' + Date.now())
  await seedFirm(db, 'retail')
  const s = (await db.settings.get('settings'))!
  s.features.roundOff = false
  await db.settings.put(s)
  const cash = s.defaultAccountId!
  const bank = uid()
  await db.accounts.add({ id: bank, kind: 'bank', name: 'Bank', openingBalance: 0, openingDate: '2026-01-01', active: true, createdAt: 0 })
  const soap: Item = { id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', salePrice: 100, purchasePrice: 60, taxRate: 0, priceIncludesTax: false, openingStock: 100, openingDate: '2026-01-01', active: true, createdAt: 0 }
  await db.items.add(soap)
  const balance = async () => {
    const [items, parties, accounts, txns, adjustments] = await Promise.all([db.items.toArray(), db.parties.toArray(), db.accounts.toArray(), db.txns.toArray(), db.adjustments.toArray()])
    return computeBooks({ items, parties, accounts, txns, adjustments }).balances.get(`acc:${cash}`) ?? 0
  }

  // books say 0 in the drawer, the cashier counts a 5,000 float: the gap is posted as cash excess
  assert.equal(countTotal({ 1000: 4, 500: 2 }), 5000)
  let shift = await openShift(db, { accountId: cash, float: 5000, count: { 1000: 4, 500: 2 }, by: 'Ali', bookBalance: await balance() })
  assert.equal(await balance(), 5000)
  await pause()

  // cash sale 300, card sale 200, split sale 100 cash + 100 card
  const sale = (qty: number) => calcTotals({ ...blankTxn('sale', s), lines: [lineFor(soap, 'sale', undefined, s, qty)] }, s)
  await saveTxn(db, { ...sale(3), received: 300, accountId: cash })
  await saveTxn(db, { ...sale(2), received: 200, accountId: bank, paymentMode: 'card' })
  await saveTxn(db, { ...sale(2), received: 200, payments: [{ accountId: cash, mode: 'cash', amount: 100 }, { accountId: bank, mode: 'card', amount: 100 }] })
  // refund 100 in cash
  await saveTxn(db, { ...calcTotals({ ...blankTxn('sale_return', s), lines: [lineFor(soap, 'sale', undefined, s, 1)] }, s), received: 100, accountId: cash })

  // pay in 1,000 from the owner, pay out 250 for tea, drop 2,000 to the bank, open drawer once
  const tea = (await db.moneyCategories.toArray()).find((c) => c.name === 'Tea & refreshments')!.id
  shift = await addCashMove(db, shift, { type: 'pay_in', amount: 1000, by: 'Ali', target: 'capital', reason: 'Change' })
  shift = await addCashMove(db, shift, { type: 'pay_out', amount: 250, by: 'Ali', target: tea, reason: 'Tea' })
  shift = await addCashMove(db, shift, { type: 'drop', amount: 2000, by: 'Ali', target: bank })
  shift = await addCashMove(db, shift, { type: 'no_sale', amount: 0, by: 'Ali', reason: 'Change for customer' })

  const sum = summarizeShift(shift, await db.txns.toArray())
  assert.equal(sum.saleCount, 3)
  assert.equal(sum.saleTotal, 700)
  assert.equal(sum.byMode.cash, 400)
  assert.equal(sum.byMode.card, 300)
  assert.equal(sum.cash.sales, 400)
  assert.equal(sum.cash.refunds, -100)
  // 5000 + 400 - 100 + 1000 - 250 - 2000
  assert.equal(sum.expected, 4050)
  assert.equal(await balance(), 4050, 'the books agree with the expected drawer cash')

  // counted 4,000: 50 short, posted as cash short; the cash account now matches the drawer
  const closed = await closeShift(db, shift, { counted: 4000, by: 'Ali' })
  assert.equal(closed.expectedCash, 4050)
  assert.equal(closed.difference, -50)
  assert.equal(closed.status, 'closed')
  assert.equal(await balance(), 4000)
  const short = (await db.moneyCategories.toArray()).find((c) => c.name === 'Cash short')!
  assert.ok((await db.txns.toArray()).some((t) => t.type === 'expense' && t.categoryId === short.id && t.total === 50))
})
