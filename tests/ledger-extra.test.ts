import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { defaultSettings, firmDb, seedFirm } from '../src/lib/db'
import { balanceSheet, computeBooks, godownStock, profitLoss, stockQty, trialBalance } from '../src/lib/ledger'
import { blankTxn, calcTotals, deleteTxn, lineFor, restoreTxn, saveTxn, TxnError, validate } from '../src/lib/txn'
import type { Account, Item, Party, Txn, TxnType } from '../src/lib/types'

const s = defaultSettings('manufacturer')
s.features.roundOff = false
s.features.tax = false

const acc = (id: string, kind: Account['kind'], opening = 0): Account => ({ id, kind, name: id, openingBalance: opening, openingDate: '2026-01-01', active: true, createdAt: 0 })
const cash = acc('cash', 'cash', 50000)
const bank = acc('bank', 'bank', 0)
const loan = acc('loan', 'loan', 0)
const item = (id: string, sell: number, buy: number, open: number): Item => ({
  id, kind: 'product', name: id, unit: 'pcs', salePrice: sell, purchasePrice: buy, taxRate: 0, priceIncludesTax: false,
  openingStock: open, openingDate: '2026-01-01', active: true, createdAt: 0,
})
const flour = item('flour', 0, 100, 100)
const sugar = item('sugar', 0, 150, 50)
const cake = item('cake', 900, 0, 0)
const ali: Party = { id: 'ali', name: 'Ali', kind: 'customer', openingBalance: 0, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }

let clock = 1
const txn = (type: TxnType, over: Partial<Txn>, lines: [Item, number][] = []): Txn =>
  calcTotals({ ...blankTxn(type, s), accountId: 'cash', createdAt: clock++, lines: lines.map(([i, q]) => lineFor(i, 'sale', undefined, s, q)), ...over }, s)

test('split payments, cheques, capital, drawings, loans and manufacturing keep the books balanced', () => {
  const make = txn('manufacture', { date: '2026-02-01', outputItemId: 'cake', outputQty: 10, charges: 500 }, [[flour, 20], [sugar, 10]])
  const sale = txn('sale', { date: '2026-02-02', partyId: 'ali' }, [[cake, 4]]) // 3600
  sale.payments = [{ accountId: 'cash', mode: 'cash', amount: 1000 }, { accountId: 'bank', mode: 'card', amount: 1600 }]
  sale.received = 2600
  const chq = txn('payment_in', { date: '2026-02-03', partyId: 'ali', total: 1000, paymentMode: 'cheque', chequeStatus: 'cleared', clearedOn: '2026-02-10', accountId: 'bank' })
  const bounced = txn('payment_in', { date: '2026-02-04', partyId: 'ali', total: 999, paymentMode: 'cheque', chequeStatus: 'bounced', accountId: 'bank' })
  const capital = txn('capital_in', { date: '2026-02-05', total: 20000 })
  const drawing = txn('drawing', { date: '2026-02-06', total: 5000 })
  const borrow = txn('transfer', { date: '2026-02-07', total: 100000, accountId: 'loan', toAccountId: 'bank' })
  const repay = txn('transfer', { date: '2026-02-08', total: 10000, accountId: 'bank', toAccountId: 'loan' })
  for (const t of [chq, bounced, capital, drawing, borrow, repay]) t.received = t.total

  const books = computeBooks({ items: [flour, sugar, cake], parties: [ali], accounts: [cash, bank, loan], txns: [make, sale, chq, bounced, capital, drawing, borrow, repay], adjustments: [] })
  const tb = trialBalance(books)
  assert.equal(tb.debit, tb.credit)
  const bs = balanceSheet(books)
  assert.equal(bs.totalAssets, bs.totalLiabilities)

  // cake costs (20*100 + 10*150 + 500) / 10 = 400 each
  assert.equal(books.stock.get('cake')!.avgCost, 400)
  assert.equal(books.stock.get('cake')!.qty, 6)
  assert.equal(books.stock.get('flour')!.qty, 80)
  assert.equal(profitLoss(books).cogs, 1600)

  // Ali: 3600 - 2600 - 1000 (cleared cheque); the bounced cheque does nothing
  assert.equal(books.balances.get('party:ali'), 0)
  assert.equal(books.balances.get('acc:bank'), 1600 + 1000 + 100000 - 10000)
  // before the cheque cleared it was in hand
  assert.equal(balanceSheet(books, '2026-02-05').chequesInHand, 1000)
  assert.equal(bs.chequesInHand, 0)
  assert.deepEqual(bs.loans, [{ acct: 'acc:loan', amount: 90000 }])
  assert.equal(bs.capital, 50000 + 20000 + 2000 * 0 + flour.openingStock * 100 + sugar.openingStock * 150)
  assert.equal(bs.drawings, 5000)
  // the stock count agrees with the valuation
  assert.equal(stockQty([flour, sugar, cake], [make, sale], []).get('cake'), 6)
})

test('stock transfers move stock between godowns without changing the total', () => {
  const move = txn('stock_transfer', { date: '2026-02-01', godownId: 'main', toGodownId: 'g2' }, [[flour, 30]])
  const sale = txn('sale', { date: '2026-02-02', godownId: 'g2' }, [[flour, 5]])
  const g = godownStock([flour], [move, sale], [{ id: 'a', itemId: 'flour', date: '2026-02-03', qty: -2, reason: 'damage', godownId: 'g2', createdAt: 9 }])
  assert.equal(g.get('flour')!.get('main'), 70)
  assert.equal(g.get('flour')!.get('g2'), 23)
  assert.equal(stockQty([flour], [move, sale], []).get('flour'), 95)
  assert.equal(validate({ ...move, toGodownId: 'main' })?.key, 'errGodowns')
})

test('locked periods and the recycle bin', async () => {
  const db = firmDb('test-' + Date.now())
  await seedFirm(db, 'retail')
  const st = (await db.settings.get('settings'))!
  const cashId = st.defaultAccountId!
  const t = { ...blankTxn('other_income', st), date: '2026-03-01', total: 500, accountId: cashId }
  const saved = await saveTxn(db, t)
  await deleteTxn(db, saved)
  assert.equal(await db.txns.count(), 0)
  assert.equal(await db.bin.count(), 1)
  await restoreTxn(db, saved.id)
  assert.equal((await db.txns.get(saved.id))!.number, saved.number)
  await db.settings.update('settings', { lockDate: '2026-03-31' })
  await assert.rejects(() => deleteTxn(db, saved), (e: unknown) => e instanceof TxnError && e.problem.key === 'errLocked')
  await assert.rejects(() => saveTxn(db, { ...blankTxn('other_income', st), date: '2026-03-15', total: 1, accountId: cashId }), TxnError)
})
