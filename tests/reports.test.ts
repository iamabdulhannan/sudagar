import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../src/lib/db'
import { balanceSheet, computeBooks, profitLoss } from '../src/lib/ledger'
import {
  aging, batchExpiry, billProfit, cashFlow, dailyTotals, dashboardSummary, dayBook, expenseReport, invoiceRegister,
  itemProfit, lowStock, overdueInvoices, partyBalances, partyWise, stockAsOf, stockMovement, stockSummary, taxReport,
  type ReportData,
} from '../src/lib/reports'
import { blankTxn, calcTotals, lineFor } from '../src/lib/txn'
import type { Account, Item, Party, StockAdjustment, Txn, TxnType } from '../src/lib/types'

const s = defaultSettings('retail')
s.features.tax = true
s.features.roundOff = false

const cash: Account = { id: 'cash', kind: 'cash', name: 'Cash', openingBalance: 10000, openingDate: '2026-01-01', active: true, createdAt: 0 }
const soap: Item = {
  id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', salePrice: 120, purchasePrice: 80, taxRate: 0, priceIncludesTax: false,
  openingStock: 10, openingDate: '2026-01-01', minStock: 4, categoryId: 'c1', active: true, createdAt: 0,
}
const oil: Item = { ...soap, id: 'oil', name: 'Oil', salePrice: 500, purchasePrice: 400, taxRate: 18, openingStock: 0, minStock: 10, categoryId: 'c2' }
const repair: Item = { ...soap, id: 'repair', kind: 'service', name: 'Repair', salePrice: 1000, purchasePrice: 0, openingStock: 0 }
const ali: Party = { id: 'ali', name: 'Ali', kind: 'customer', openingBalance: 2000, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }
const bilal: Party = { ...ali, id: 'bilal', name: 'Bilal', openingBalance: 0 }
const sup: Party = { id: 'sup', name: 'Supplier', kind: 'supplier', openingBalance: -5000, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }

let clock = 1
function txn(type: TxnType, over: Partial<Txn>, items: [Item, number][] = []): Txn {
  const base = blankTxn(type, s)
  const lines = items.map(([it, q]) => lineFor(it, type.startsWith('purchase') ? 'purchase' : 'sale', undefined, s, q))
  return calcTotals({ ...base, accountId: 'cash', lines, createdAt: clock++, dueDate: undefined, ...over }, s)
}

const s1 = txn('sale', { date: '2026-02-01', partyId: 'ali', number: 'INV-1' }, [[soap, 5], [repair, 1]])
s1.received = 600
const p1 = txn('purchase', { date: '2026-02-02', partyId: 'sup', number: 'PB-1', dueDate: '2026-03-01' }, [[oil, 10]])
p1.received = 1000
const s2 = txn('sale', { date: '2026-02-03', number: 'INV-2' }, [[oil, 2]])
s2.received = s2.total
const r1 = txn('sale_return', { date: '2026-02-04', partyId: 'ali', number: 'CN-1' }, [[soap, 1]])
const pay1 = txn('payment_in', { date: '2026-02-05', partyId: 'ali', total: 1000, received: 1000 })
const e1 = txn('expense', { date: '2026-02-06', total: 300, received: 300, categoryId: 'rent' })
// invoice discount of 40 is spread over the line for item profit
const s3 = txn('sale', { date: '2026-03-10', partyId: 'bilal', number: 'INV-3', discount: 40, dueDate: '2026-03-20' }, [[soap, 2]])
const est = txn('estimate', { date: '2026-02-06', partyId: 'ali' }, [[soap, 100]])
const cancelled = { ...txn('sale', { date: '2026-02-06', partyId: 'ali' }, [[soap, 1]]), cancelled: true }
const adj: StockAdjustment = { id: 'a1', itemId: 'soap', date: '2026-02-07', qty: -1, reason: 'damage', createdAt: clock++ }

const data: ReportData = {
  items: [soap, oil, repair], categories: [{ id: 'c1', name: 'Care' }, { id: 'c2', name: 'Food' }],
  parties: [ali, bilal, sup], accounts: [cash], moneyCategories: [{ id: 'rent', kind: 'expense', name: 'Rent' }],
  txns: [s1, p1, s2, r1, pay1, e1, s3, est, cancelled], adjustments: [adj],
}
const books = computeBooks(data)
const pl = profitLoss(books)

test('dataset matches the P&L we expect', () => {
  assert.equal(s3.total, 200)
  assert.equal(pl.sales, 2800)
  assert.equal(pl.salesReturn, 120)
  assert.equal(pl.netSales, 2680)
  // cogs: 5*80 - 1*80 + 2*400 + 2*80
  assert.equal(pl.cogs, 1280)
  assert.equal(pl.grossProfit, 1400)
  assert.equal(pl.netProfit, 1400 - 300 - 80)
})

test('sale register reconciles with P&L sales', () => {
  const reg = invoiceRegister(data, books, ['sale'])
  assert.equal(reg.totals.count, 3, 'cancelled invoices are left out')
  assert.equal(reg.totals.net, pl.sales)
  assert.equal(reg.totals.tax, 180)
  assert.equal(reg.totals.due, 1200)
  const ali1 = invoiceRegister(data, books, ['sale'], undefined, undefined, 'ali')
  assert.equal(ali1.rows.length, 1)
})

test('bill profit adds up to gross profit', () => {
  const bp = billProfit(data, books)
  assert.equal(bp.totals.sales, pl.netSales)
  assert.equal(bp.totals.cost, pl.cogs)
  assert.equal(bp.totals.profit, pl.grossProfit)
  const row3 = bp.rows.find((r) => r.id === s3.id)!
  assert.equal(row3.profit, 40)
})

test('item profit splits the invoice discount and matches gross profit', () => {
  const ip = itemProfit(data, books)
  const soapRow = ip.rows.find((r) => r.itemId === 'soap')!
  assert.equal(soapRow.qty, 6)
  assert.equal(soapRow.sales, 680)
  assert.equal(soapRow.cost, 480)
  assert.equal(soapRow.profit, 200)
  assert.equal(ip.rows.find((r) => r.itemId === 'repair')!.profit, 1000)
  assert.equal(ip.rows.find((r) => r.itemId === 'oil')!.profit, 200)
  assert.equal(ip.totals.sales, pl.netSales)
  assert.equal(ip.totals.profit, pl.grossProfit)
  // a period: only February
  const feb = itemProfit(data, books, '2026-02-01', '2026-02-28')
  assert.equal(feb.rows.find((r) => r.itemId === 'soap')!.qty, 4)
})

test('aging buckets reconcile with party balances', () => {
  const asOf = '2026-04-15'
  const rec = aging(data, books, 'sale', asOf)
  // Ali: opening 2000 less 1120 credit = 880 left (104 days), INV-1 1000 due (72 days); Bilal INV-3 200 (36 days)
  assert.equal(rec.totals.b0, 0)
  assert.equal(rec.totals.b30, 200)
  assert.equal(rec.totals.b60, 1000)
  assert.equal(rec.totals.b90, 880)
  assert.equal(rec.totals.total, 2080)
  const pb = partyBalances(data, books)
  assert.equal(rec.totals.total, pb.totals.receivable)
  assert.equal(rec.parties.find((p) => p.partyId === 'ali')!.total, pb.rows.find((r) => r.partyId === 'ali')!.balance)

  const pay = aging(data, books, 'purchase', asOf)
  assert.equal(pay.totals.b90, 5000)
  assert.equal(pay.totals.b60, 3720)
  assert.equal(pay.totals.total, pb.totals.payable)
})

test('party balances match the balance sheet', () => {
  const bs = balanceSheet(books)
  const pb = partyBalances(data, books)
  assert.equal(pb.totals.receivable, bs.receivables)
  assert.equal(pb.totals.payable, bs.payables)
  // as of a date before the March sale
  const early = partyBalances(data, books, '2026-02-28')
  assert.equal(early.rows.find((r) => r.partyId === 'bilal')!.balance, 0)
})

test('party wise totals', () => {
  const pw = partyWise(data)
  const a = pw.rows.find((r) => r.partyId === 'ali')!
  assert.equal(a.sales, 1600)
  assert.equal(a.saleReturns, 120)
  assert.equal(a.received, 1000)
  assert.equal(pw.totals.sales, 1600 + 1180 + 200)
  assert.equal(pw.totals.purchases, p1.total)
})

test('stock movement replays to the as-of stock', () => {
  const mv = stockMovement(data, '2026-02-05', '2026-03-31')
  const soapMv = mv.rows.find((r) => r.itemId === 'soap')!
  assert.deepEqual([soapMv.opening, soapMv.inQty, soapMv.outQty, soapMv.closing], [6, 0, 3, 3])
  const oilMv = mv.rows.find((r) => r.itemId === 'oil')!
  assert.equal(oilMv.opening, 8)
  assert.equal(oilMv.closing, 8)
  assert.equal(mv.rows.find((r) => r.itemId === 'repair'), undefined, 'services have no stock')

  const at = stockAsOf(data, '2026-03-31')
  assert.equal(at.get('soap')!.qty, soapMv.closing)
  assert.equal(stockAsOf(data, '2026-02-04').get('soap')!.qty, 6)
  // all time closing equals current stock
  const all = stockMovement(data)
  for (const r of all.rows) assert.equal(r.closing, books.stock.get(r.itemId)?.qty ?? 0)
})

test('stock summary value matches the balance sheet', () => {
  const ss = stockSummary(data, books.stock)
  assert.equal(ss.totals.value, 3 * 80 + 8 * 400)
  assert.equal(ss.totals.value, balanceSheet(books).inventory)
  assert.equal(ss.byCategory.length, 2)
  const low = lowStock(data, books.stock)
  assert.deepEqual(low.map((r) => r.item.id), ['oil', 'soap'])
})

test('cash flow opening plus movement equals closing', () => {
  const cf = cashFlow(data, books, '2026-02-01', '2026-02-28')
  assert.equal(cf.opening, 10000)
  assert.equal(cf.moneyIn, 600 + 1180 + 1000)
  assert.equal(cf.moneyOut, 1000 + 300)
  assert.equal(cf.closing, books.balances.get('acc:cash'))
  assert.equal(cf.accounts[0].closing, cf.closing)
  const sales = cf.byType.find((k) => k.key === 'sale')!
  assert.equal(sales.moneyIn, 1780)
})

test('day book', () => {
  const db = dayBook(data, books, '2026-02-03')
  assert.equal(db.rows.length, 1)
  assert.equal(db.totals.moneyIn, 1180)
  assert.equal(db.opening, 9600)
  assert.equal(db.closing, 10780)
})

test('expenses and tax reconcile with the ledger', () => {
  const ex = expenseReport(data, books)
  assert.equal(ex.total, pl.expenses.reduce((a, x) => a + x.amount, 0))
  assert.equal(ex.heads[0].share, 100)
  const tx = taxReport(data)
  assert.equal(tx.collected, -(books.balances.get('tax_out') ?? 0))
  assert.equal(tx.paid, books.balances.get('tax_in'))
  assert.equal(tx.net, 180 - 720)
})

test('dashboard numbers', () => {
  const sum = dashboardSummary(data, books, '2026-03-10', '2026-03-01', '2026-03-31')
  assert.equal(sum.todaySales, 200)
  assert.equal(sum.todayBills, 1)
  assert.equal(sum.monthSales, 200)
  assert.equal(sum.receivable, 2080)
  assert.equal(sum.payable, 8720)
  assert.equal(sum.cash, 11480)
  assert.equal(sum.stockValue, 3440)
  const days = dailyTotals(data, '2026-02-01', '2026-02-03')
  assert.deepEqual(days.map((x) => [x.sales, x.purchases]), [[1600, 0], [0, p1.total], [1180, 0]])
  const od = overdueInvoices(data, books, '2026-04-15')
  assert.deepEqual(od.map((r) => r.id), [s3.id, p1.id])
})

test('batch expiry status', () => {
  const med: Item = { ...soap, id: 'med', name: 'Syrup', openingStock: 0 }
  const lineB = (batch: string, expiry: string, q: number, side: 'sale' | 'purchase') => ({ ...lineFor(med, side, undefined, s, q), batch, expiry })
  const buy = txn('purchase', { date: '2026-01-10', partyId: 'sup', lines: [lineB('B1', '2026-04-20', 10, 'purchase'), lineB('B2', '2026-06-15', 5, 'purchase'), lineB('B3', '2026-03-01', 3, 'purchase')] })
  const sell = txn('sale', { date: '2026-02-10', lines: [lineB('B1', '2026-04-20', 4, 'sale')] })
  sell.received = sell.total
  const d2: ReportData = { ...data, items: [med], txns: [buy, sell], adjustments: [] }
  const rows = batchExpiry(d2, '2026-04-15').rows
  assert.deepEqual(rows.map((r) => [r.batch, r.qty, r.status]), [['B3', 3, 'expired'], ['B1', 6, 'd30'], ['B2', 5, 'd90']])
})
