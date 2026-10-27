import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../src/lib/db'
import { balanceSheet, computeBooks, profitLoss, statement, trialBalance } from '../src/lib/ledger'
import { blankTxn, calcTotals, lineFor } from '../src/lib/txn'
import type { Account, Item, Party, Txn, TxnType } from '../src/lib/types'

const s = defaultSettings('retail')
s.features.tax = true
s.features.roundOff = false

const cash: Account = { id: 'cash', kind: 'cash', name: 'Cash', openingBalance: 10000, openingDate: '2026-01-01', active: true, createdAt: 0 }
const soap: Item = {
  id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', salePrice: 120, purchasePrice: 80, taxRate: 0, priceIncludesTax: false,
  openingStock: 10, openingDate: '2026-01-01', active: true, createdAt: 0,
}
const oil: Item = { ...soap, id: 'oil', name: 'Oil', salePrice: 500, purchasePrice: 400, taxRate: 18, openingStock: 0 }
const repair: Item = { ...soap, id: 'repair', kind: 'service', name: 'Repair', salePrice: 1000, purchasePrice: 0, openingStock: 0 }
const ali: Party = { id: 'ali', name: 'Ali', kind: 'customer', openingBalance: 2000, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }
const sup: Party = { id: 'sup', name: 'Supplier', kind: 'supplier', openingBalance: -5000, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }

let clock = 1
function txn(type: TxnType, over: Partial<Txn>, items: [Item, number][] = []): Txn {
  const base = blankTxn(type, s)
  const lines = items.map(([it, q]) => lineFor(it, type.startsWith('purchase') ? 'purchase' : 'sale', undefined, s, q))
  return calcTotals({ ...base, accountId: 'cash', lines, createdAt: clock++, ...over }, s)
}

test('books balance and profit is right', () => {
  const sale = txn('sale', { date: '2026-02-01', partyId: 'ali' }, [[soap, 5], [repair, 1]])
  sale.received = 600 // partly paid
  const purchase = txn('purchase', { date: '2026-02-02', partyId: 'sup' }, [[oil, 10]])
  purchase.received = 1000
  const sale2 = txn('sale', { date: '2026-02-03' }, [[oil, 2]])
  sale2.received = sale2.total
  const ret = txn('sale_return', { date: '2026-02-04', partyId: 'ali' }, [[soap, 1]])
  const payIn = txn('payment_in', { date: '2026-02-05', partyId: 'ali', total: 1000, received: 1000 })
  const exp = txn('expense', { date: '2026-02-06', total: 300, received: 300, categoryId: 'rent' })
  const est = txn('estimate', { date: '2026-02-06', partyId: 'ali' }, [[soap, 100]])

  const books = computeBooks({
    items: [soap, oil, repair], parties: [ali, sup], accounts: [cash],
    txns: [sale, purchase, sale2, ret, payIn, exp, est], adjustments: [{ id: 'a1', itemId: 'soap', date: '2026-02-07', qty: -1, reason: 'damage', createdAt: clock++ }],
  })

  const tb = trialBalance(books)
  assert.equal(tb.debit, tb.credit, 'trial balance must balance')

  const bs = balanceSheet(books)
  assert.equal(bs.totalAssets, bs.totalLiabilities, 'balance sheet must balance')

  // soap: 10 opening - 5 sold + 1 returned - 1 damaged = 5 left at 80
  assert.equal(books.stock.get('soap')!.qty, 5)
  assert.equal(books.stock.get('soap')!.value, 400)
  // oil: 10 bought - 2 sold
  assert.equal(books.stock.get('oil')!.qty, 8)

  const pl = profitLoss(books)
  // sales: soap 600 + repair 1000 + oil 1000 (net of tax) ; return 120
  assert.equal(pl.sales, 2600)
  assert.equal(pl.salesReturn, 120)
  // cogs: 5*80 - 1*80 + 2*400 = 1120
  assert.equal(pl.cogs, 1120)
  // expenses: rent 300 + damage 80
  assert.equal(pl.totalExpenses, 380)
  assert.equal(pl.netProfit, 2600 - 120 - 1120 - 380)

  // Ali: 2000 opening + 1600 sale - 600 paid - 120 return - 1000 paid = 1880
  assert.equal(statement(books, 'party:ali').closing, 1880)
  // invoice dues: opening 2000 settled first by the 1120 credit pool, so the sale stays fully due
  assert.equal(books.dues.get(sale.id)!.due, 1000)
  // estimates do nothing
  assert.equal(books.stock.get('soap')!.qty, 5)
  // cash: 10000 + 600 - 1000 + 1180 + 1000 - 300
  assert.equal(books.balances.get('acc:cash'), 11480)
})

test('a payment made against an invoice settles that invoice first', () => {
  const inv1 = txn('sale', { date: '2026-03-01', partyId: 'ali' }, [[soap, 10]]) // 1200, unpaid
  const inv2 = txn('sale', { date: '2026-03-02', partyId: 'ali' }, [[soap, 5]]) // 600, unpaid
  const pay = txn('payment_in', { date: '2026-03-03', partyId: 'ali', total: 800, received: 800, againstId: inv2.id })
  const books = computeBooks({ items: [soap], parties: [{ ...ali, openingBalance: 0 }], accounts: [cash], txns: [inv1, inv2, pay], adjustments: [] })
  assert.equal(books.dues.get(inv2.id)!.status, 'paid')
  // the 200 left over goes to the oldest invoice
  assert.equal(books.dues.get(inv1.id)!.due, 1000)
  assert.deepEqual(books.openingDues.get('ali'), { sale: 0, purchase: 0 })
})
