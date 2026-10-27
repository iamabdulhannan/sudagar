import type { FirmData } from './data'
import { addDays } from './db'
import { pointsByParty } from './loyalty'
import { monthStart, round2, round3 } from './format'
import { activeTxns, classOf, computeBooks, profitLoss, type Books, type ItemStock, type Posting } from './ledger'
import { TXN_META, baseQty } from './txn'
import type { ID, Item, Party, Settings, Txn, TxnType } from './types'

/**
 * Report calculations. Every function here is pure: it takes the business data and the
 * books (ledger.ts) and returns plain rows, so the numbers can be tested and always
 * reconcile with the ledger. Screens and printing live in components/reports.
 */

/** the parts of FirmData the reports read (FirmData itself fits) */
export type ReportData = Pick<FirmData, 'items' | 'categories' | 'parties' | 'accounts' | 'moneyCategories' | 'txns' | 'adjustments'>

// ---------- helpers ----------

export const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to)
const sum = (xs: number[]) => round2(xs.reduce((a, x) => a + x, 0))
/** a as a percent of b (0 when b is 0) */
export const pct = (a: number, b: number) => (b ? round2((a / b) * 100) : 0)

/** whole days from a to b (b later = positive) */
export function daysBetween(a: string, b: string) {
  const u = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((u(b) - u(a)) / 86400000)
}

const byDate = (a: Txn, b: Txn) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1)

/** transactions in a period, oldest first, cancelled left out */
export function txnsIn(d: ReportData, from?: string, to?: string, types?: TxnType[]) {
  return d.txns.filter((t) => !t.cancelled && inRange(t.date, from, to) && (!types || types.includes(t.type))).sort(byDate)
}

/** party name of a transaction ('' for a walk-in customer without a name) */
export function partyNameOf(d: ReportData, t: Txn, parties?: Map<ID, Party>) {
  if (t.partyId) return (parties ?? new Map(d.parties.map((p) => [p.id, p]))).get(t.partyId)?.name ?? t.partyName ?? ''
  return t.partyName ?? ''
}

const cashCache = new WeakMap<Books, Map<ID, { moneyIn: number; moneyOut: number }>>()

/** money in / out of cash, bank and wallet accounts caused by each transaction */
export function cashByTxn(books: Books) {
  let m = cashCache.get(books)
  if (m) return m
  m = new Map()
  for (const p of books.postings) {
    // loan accounts are what is owed, not money in hand
    if (!p.txnId || !p.acct.startsWith('acc:') || books.loanAccts?.has(p.acct)) continue
    const r = m.get(p.txnId) ?? { moneyIn: 0, moneyOut: 0 }
    if (p.amount > 0) r.moneyIn = round2(r.moneyIn + p.amount)
    else r.moneyOut = round2(r.moneyOut - p.amount)
    m.set(p.txnId, r)
  }
  cashCache.set(books, m)
  return m
}

/** stock per item as it stood at the end of a date (replays only what happened up to then) */
export function stockAsOf(d: ReportData, asOf: string): Map<ID, ItemStock> {
  return computeBooks({
    items: d.items.map((i) => (i.openingDate > asOf ? { ...i, openingStock: 0 } : i)),
    parties: [], accounts: [],
    txns: d.txns.filter((t) => t.date <= asOf),
    adjustments: d.adjustments.filter((a) => a.date <= asOf),
  }).stock
}

/** cash + bank + wallet balance at the end of a date (or before the start of `before`) */
function moneyBalance(postings: Posting[], pred: (date: string) => boolean, acct?: string) {
  let s = 0
  for (const p of postings) if (p.acct.startsWith('acc:') && (!acct || p.acct === acct) && pred(p.date)) s += p.amount
  return round2(s)
}

// ---------- transaction registers ----------

export interface InvoiceRow {
  id: ID
  type: TxnType
  date: string
  number: string
  partyId?: ID
  partyName: string
  /** net of tax */
  net: number
  tax: number
  total: number
  paid: number
  due: number
  status: 'paid' | 'partial' | 'unpaid'
  dueDate?: string
}

/** sale / purchase register with paid and open amounts per invoice */
export function invoiceRegister(d: ReportData, books: Books, types: TxnType[], from?: string, to?: string, partyId?: ID) {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  const rows: InvoiceRow[] = txnsIn(d, from, to, types)
    .filter((t) => !partyId || t.partyId === partyId)
    .map((t) => {
      const due = books.dues.get(t.id)
      const paid = due?.paid ?? t.received
      const open = due?.due ?? round2(t.total - t.received)
      return {
        id: t.id, type: t.type, date: t.date, number: t.number, partyId: t.partyId, partyName: partyNameOf(d, t, parties),
        net: round2(t.total - t.taxTotal), tax: t.taxTotal, total: t.total, paid, due: open,
        status: due?.status ?? (open <= 0.001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'), dueDate: t.dueDate,
      }
    })
  return {
    rows,
    totals: {
      count: rows.length, net: sum(rows.map((r) => r.net)), tax: sum(rows.map((r) => r.tax)), total: sum(rows.map((r) => r.total)),
      paid: sum(rows.map((r) => r.paid)), due: sum(rows.map((r) => r.due)),
    },
  }
}

export interface TxnRow {
  id: ID
  type: TxnType
  date: string
  number: string
  partyId?: ID
  partyName: string
  total: number
  moneyIn: number
  moneyOut: number
  /** open amount for sale / purchase invoices */
  due?: number
}

/** every transaction of a period (all document types) with the money it moved */
export function txnRegister(d: ReportData, books: Books, from?: string, to?: string, type?: TxnType) {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  const cash = cashByTxn(books)
  const rows: TxnRow[] = txnsIn(d, from, to, type ? [type] : undefined).map((t) => {
    const c = cash.get(t.id)
    return {
      id: t.id, type: t.type, date: t.date, number: t.number, partyId: t.partyId, partyName: partyNameOf(d, t, parties),
      total: t.total, moneyIn: c?.moneyIn ?? 0, moneyOut: c?.moneyOut ?? 0, due: books.dues.get(t.id)?.due,
    }
  })
  return {
    rows,
    totals: { count: rows.length, total: sum(rows.map((r) => r.total)), moneyIn: sum(rows.map((r) => r.moneyIn)), moneyOut: sum(rows.map((r) => r.moneyOut)) },
  }
}

/** one day's transactions with cash + bank opening and closing */
export function dayBook(d: ReportData, books: Books, date: string) {
  const reg = txnRegister(d, books, date, date)
  const opening = moneyBalance(books.postings, (x) => x < date)
  const closing = moneyBalance(books.postings, (x) => x <= date)
  return { ...reg, opening, closing }
}

export interface BillProfitRow {
  id: ID
  type: TxnType
  date: string
  number: string
  partyId?: ID
  partyName: string
  /** net of tax; negative for returns */
  sales: number
  cost: number
  profit: number
  margin: number
}

/** profit per sale invoice: sale net of tax minus its cost of goods (returns shown negative) */
export function billProfit(d: ReportData, books: Books, from?: string, to?: string, withReturns = true) {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  const rows: BillProfitRow[] = txnsIn(d, from, to, withReturns ? ['sale', 'sale_return'] : ['sale']).map((t) => {
    const sign = t.type === 'sale' ? 1 : -1
    const sales = round2(sign * (t.total - t.taxTotal))
    const cost = books.cogs.get(t.id) ?? 0
    const profit = round2(sales - cost)
    return { id: t.id, type: t.type, date: t.date, number: t.number, partyId: t.partyId, partyName: partyNameOf(d, t, parties), sales, cost, profit, margin: pct(profit, sales) }
  })
  const sales = sum(rows.map((r) => r.sales)), cost = sum(rows.map((r) => r.cost)), profit = sum(rows.map((r) => r.profit))
  return { rows, totals: { count: rows.length, sales, cost, profit, margin: pct(profit, sales) } }
}

// ---------- parties ----------

export interface PartyBalanceRow {
  partyId: ID
  name: string
  phone?: string
  kind: Party['kind']
  balance: number
  receivable: number
  payable: number
}

/** balance of every party at the end of a date (+ receivable, - payable) */
export function partyBalances(d: ReportData, books: Books, asOf?: string) {
  const bal = new Map<string, number>()
  for (const p of books.postings) {
    if (!p.acct.startsWith('party:') || (asOf && p.date > asOf)) continue
    bal.set(p.acct, (bal.get(p.acct) ?? 0) + p.amount)
  }
  const rows: PartyBalanceRow[] = d.parties.map((p) => {
    const b = round2(bal.get(`party:${p.id}`) ?? 0)
    return { partyId: p.id, name: p.name, phone: p.phone, kind: p.kind, balance: b, receivable: b > 0 ? b : 0, payable: b < 0 ? -b : 0 }
  })
  const walkin = round2(bal.get('party:walkin') ?? 0)
  const receivable = sum(rows.map((r) => r.receivable)) + (walkin > 0 ? walkin : 0)
  const payable = sum(rows.map((r) => r.payable)) + (walkin < 0 ? -walkin : 0)
  return { rows, walkin, totals: { receivable: round2(receivable), payable: round2(payable), net: round2(receivable - payable) } }
}

export type AgingBucket = 'b0' | 'b30' | 'b60' | 'b90'
export const AGING_BUCKETS: AgingBucket[] = ['b0', 'b30', 'b60', 'b90']

export const bucketOf = (days: number): AgingBucket => (days <= 30 ? 'b0' : days <= 60 ? 'b30' : days <= 90 ? 'b60' : 'b90')

export interface AgingItem {
  partyId: ID
  partyName: string
  /** empty for the unsettled part of a party's opening balance */
  txnId?: ID
  type?: TxnType
  number?: string
  date: string
  dueDate?: string
  days: number
  amount: number
  bucket: AgingBucket
}

export interface AgingParty extends Record<AgingBucket, number> {
  partyId: ID
  partyName: string
  count: number
  total: number
}

/**
 * Open invoices by age (days since the invoice date, measured on `asOf`).
 * Uses books.dues, where payments settle the oldest invoices first. The part of a
 * party's opening balance that payments have not covered yet is aged from its opening date.
 */
export function aging(d: ReportData, books: Books, side: 'sale' | 'purchase', asOf: string) {
  const items: AgingItem[] = []
  const active = activeTxns(d.txns)
  const parties = new Map(d.parties.map((p) => [p.id, p]))

  // opening balance not yet settled (worked out with the invoice dues in ledger.ts)
  for (const p of d.parties) {
    const left = books.openingDues.get(p.id)?.[side] ?? 0
    if (left > 0.001) {
      const days = Math.max(0, daysBetween(p.openingDate, asOf))
      items.push({ partyId: p.id, partyName: p.name, date: p.openingDate, days, amount: left, bucket: bucketOf(days) })
    }
  }
  for (const t of active) {
    if (t.type !== side) continue
    const due = books.dues.get(t.id)?.due ?? 0
    if (due <= 0.001) continue
    const days = Math.max(0, daysBetween(t.date, asOf))
    items.push({
      partyId: t.partyId ?? '', partyName: partyNameOf(d, t, parties), txnId: t.id, type: t.type, number: t.number,
      date: t.date, dueDate: t.dueDate, days, amount: due, bucket: bucketOf(days),
    })
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const byParty = new Map<ID, AgingParty>()
  for (const it of items) {
    let r = byParty.get(it.partyId)
    if (!r) { r = { partyId: it.partyId, partyName: it.partyName, count: 0, total: 0, b0: 0, b30: 0, b60: 0, b90: 0 }; byParty.set(it.partyId, r) }
    r.count++
    r[it.bucket] = round2(r[it.bucket] + it.amount)
    r.total = round2(r.total + it.amount)
  }
  const partiesOut = [...byParty.values()].sort((a, b) => b.total - a.total)
  const totals = { count: items.length, total: sum(items.map((i) => i.amount)), b0: 0, b30: 0, b60: 0, b90: 0 }
  for (const b of AGING_BUCKETS) totals[b] = sum(items.filter((i) => i.bucket === b).map((i) => i.amount))
  return { items, parties: partiesOut, totals }
}

export interface PartyWiseRow {
  partyId: ID
  partyName: string
  sales: number
  saleReturns: number
  purchases: number
  purchaseReturns: number
  received: number
  paid: number
}

/** sales, purchases and payments per party in a period (invoice totals including tax) */
export function partyWise(d: ReportData, from?: string, to?: string) {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  const by = new Map<string, PartyWiseRow>()
  const field: Partial<Record<TxnType, keyof PartyWiseRow>> = {
    sale: 'sales', sale_return: 'saleReturns', purchase: 'purchases', purchase_return: 'purchaseReturns', payment_in: 'received', payment_out: 'paid',
  }
  for (const t of txnsIn(d, from, to)) {
    const f = field[t.type]
    if (!f) continue
    const key = t.partyId ?? ''
    let r = by.get(key)
    if (!r) {
      r = { partyId: key, partyName: t.partyId ? partyNameOf(d, t, parties) : '', sales: 0, saleReturns: 0, purchases: 0, purchaseReturns: 0, received: 0, paid: 0 }
      by.set(key, r)
    }
    ;(r[f] as number) = round2((r[f] as number) + t.total)
  }
  const rows = [...by.values()].sort((a, b) => b.sales - b.saleReturns - (a.sales - a.saleReturns) || b.purchases - a.purchases)
  const tot = (k: keyof PartyWiseRow) => sum(rows.map((r) => r[k] as number))
  return {
    rows,
    totals: { sales: tot('sales'), saleReturns: tot('saleReturns'), purchases: tot('purchases'), purchaseReturns: tot('purchaseReturns'), received: tot('received'), paid: tot('paid') },
  }
}

// ---------- accounts ----------

export interface FlowLine { key: string; moneyIn: number; moneyOut: number }
export interface AccountFlow { accountId: ID; opening: number; moneyIn: number; moneyOut: number; closing: number }

/** money in and out of cash, bank and wallets for a period, per document type and per account */
export function cashFlow(d: ReportData, books: Books, from?: string, to?: string) {
  const before = (x: string) => !!from && x < from
  const byKind = new Map<string, FlowLine>()
  const byAcc = new Map<string, AccountFlow>()
  for (const a of d.accounts) if (a.kind !== 'loan') byAcc.set(`acc:${a.id}`, { accountId: a.id, opening: 0, moneyIn: 0, moneyOut: 0, closing: 0 })
  for (const p of books.postings) {
    // loan accounts are what is owed (see the loans report), not money in hand
    if (!p.acct.startsWith('acc:') || books.loanAccts?.has(p.acct)) continue
    let acc = byAcc.get(p.acct)
    if (!acc) { acc = { accountId: p.acct.slice(4), opening: 0, moneyIn: 0, moneyOut: 0, closing: 0 }; byAcc.set(p.acct, acc) }
    if (before(p.date)) { acc.opening += p.amount; continue }
    if (!inRange(p.date, from, to)) continue
    const k = byKind.get(p.kind) ?? { key: p.kind, moneyIn: 0, moneyOut: 0 }
    if (p.amount > 0) { k.moneyIn += p.amount; acc.moneyIn += p.amount } else { k.moneyOut -= p.amount; acc.moneyOut -= p.amount }
    byKind.set(p.kind, k)
  }
  const accounts = [...byAcc.values()].map((a) => {
    const opening = round2(a.opening), moneyIn = round2(a.moneyIn), moneyOut = round2(a.moneyOut)
    return { ...a, opening, moneyIn, moneyOut, closing: round2(opening + moneyIn - moneyOut) }
  })
  const order = Object.keys(TXN_META)
  const byType = [...byKind.values()]
    .map((k) => ({ ...k, moneyIn: round2(k.moneyIn), moneyOut: round2(k.moneyOut) }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  const opening = sum(accounts.map((a) => a.opening))
  const moneyIn = sum(byType.map((k) => k.moneyIn))
  const moneyOut = sum(byType.map((k) => k.moneyOut))
  return { opening, moneyIn, moneyOut, closing: round2(opening + moneyIn - moneyOut), byType, accounts }
}

export interface ExpenseHead { acct: string; count: number; amount: number; share: number }

/** expenses per head for a period, with each head's share of the total */
export function expenseReport(d: ReportData, books: Books, from?: string, to?: string) {
  const amt = new Map<string, number>()
  for (const p of books.postings) if (p.acct.startsWith('exp:') && inRange(p.date, from, to)) amt.set(p.acct, (amt.get(p.acct) ?? 0) + p.amount)
  const txns = txnsIn(d, from, to, ['expense'])
  const count = new Map<string, number>()
  for (const t of txns) { const k = `exp:${t.categoryId ?? 'other'}`; count.set(k, (count.get(k) ?? 0) + 1) }
  const total = sum([...amt.values()])
  const heads: ExpenseHead[] = [...amt]
    .map(([acct, v]) => ({ acct, count: count.get(acct) ?? 0, amount: round2(v), share: pct(v, total) }))
    .filter((h) => h.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
  return { heads, txns, total }
}

export interface TaxRateRow {
  rate: number
  salesTaxable: number
  salesTax: number
  purchaseTaxable: number
  purchaseTax: number
}

/** tax charged on sales and paid on purchases in a period, by rate (returns are taken off) */
export function taxReport(d: ReportData, from?: string, to?: string) {
  const by = new Map<number, TaxRateRow>()
  const sign: Partial<Record<TxnType, [1 | -1, 'sales' | 'purchase']>> = {
    sale: [1, 'sales'], sale_return: [-1, 'sales'], purchase: [1, 'purchase'], purchase_return: [-1, 'purchase'],
  }
  for (const t of txnsIn(d, from, to, ['sale', 'sale_return', 'purchase', 'purchase_return'])) {
    const [s, side] = sign[t.type]!
    for (const l of t.lines) {
      const rate = l.taxRate || 0
      const r = by.get(rate) ?? { rate, salesTaxable: 0, salesTax: 0, purchaseTaxable: 0, purchaseTax: 0 }
      if (side === 'sales') { r.salesTaxable += s * (l.amount - l.taxAmount); r.salesTax += s * l.taxAmount }
      else { r.purchaseTaxable += s * (l.amount - l.taxAmount); r.purchaseTax += s * l.taxAmount }
      by.set(rate, r)
    }
  }
  const rows = [...by.values()]
    .map((r) => ({ rate: r.rate, salesTaxable: round2(r.salesTaxable), salesTax: round2(r.salesTax), purchaseTaxable: round2(r.purchaseTaxable), purchaseTax: round2(r.purchaseTax) }))
    .sort((a, b) => a.rate - b.rate)
  const collected = sum(rows.map((r) => r.salesTax))
  const paid = sum(rows.map((r) => r.purchaseTax))
  return {
    rows, collected, paid, net: round2(collected - paid),
    salesTaxable: sum(rows.map((r) => r.salesTaxable)), purchaseTaxable: sum(rows.map((r) => r.purchaseTaxable)),
  }
}

// ---------- stock ----------

export interface StockRow {
  item: Item
  qty: number
  avgCost: number
  value: number
  saleValue: number
}

/** stock on hand with value at cost and at sale price, plus totals per category */
export function stockSummary(d: ReportData, stock: Map<ID, ItemStock>, categoryId?: ID) {
  const rows: StockRow[] = d.items
    .filter((i) => i.kind === 'product' && (!categoryId || i.categoryId === categoryId))
    .map((item) => {
      const s = stock.get(item.id) ?? { qty: 0, value: 0, avgCost: 0 }
      return { item, qty: s.qty, avgCost: s.avgCost, value: s.value, saleValue: round2(s.qty * item.salePrice) }
    })
    .filter((r) => r.item.active || r.qty !== 0)
  const cats = new Map<string, { categoryId: string; items: number; qty: number; value: number; saleValue: number }>()
  for (const r of rows) {
    const k = r.item.categoryId ?? ''
    const c = cats.get(k) ?? { categoryId: k, items: 0, qty: 0, value: 0, saleValue: 0 }
    c.items++
    c.qty = round3(c.qty + r.qty)
    c.value = round2(c.value + r.value)
    c.saleValue = round2(c.saleValue + r.saleValue)
    cats.set(k, c)
  }
  return {
    rows,
    byCategory: [...cats.values()].sort((a, b) => b.value - a.value),
    totals: { items: rows.length, value: sum(rows.map((r) => r.value)), saleValue: sum(rows.map((r) => r.saleValue)) },
  }
}

export interface ItemProfitRow {
  itemId: ID
  name: string
  unit: string
  categoryId?: ID
  /** base units sold minus returned */
  qty: number
  /** net of tax, after the invoice discount, charges and round off are shared over the lines */
  sales: number
  cost: number
  profit: number
  margin: number
}

/**
 * Profit per item for a period. Invoice level discount, charges and round off are spread
 * over the lines by value (as the ledger does for purchases), so the total matches net sales
 * in the P&L. Cost comes from books.lineCogs, line by line.
 */
export function itemProfit(d: ReportData, books: Books, from?: string, to?: string) {
  const items = new Map(d.items.map((i) => [i.id, i]))
  const by = new Map<ID, { qty: number; sales: number; cost: number }>()
  const other = { sales: 0, cost: 0 }
  for (const t of txnsIn(d, from, to, ['sale', 'sale_return'])) {
    const sign = t.type === 'sale' ? 1 : -1
    const net = t.total - t.taxTotal
    const lineNet = t.lines.reduce((a, l) => a + (l.amount - l.taxAmount), 0)
    const f = lineNet > 0 ? net / lineNet : 1
    const lc = books.lineCogs.get(t.id) ?? []
    t.lines.forEach((l, i) => {
      const sales = sign * (l.amount - l.taxAmount) * f
      const cost = lc[i] ?? 0
      const item = l.itemId ? items.get(l.itemId) : undefined
      if (!item) { other.sales += sales; other.cost += cost; return }
      const r = by.get(item.id) ?? { qty: 0, sales: 0, cost: 0 }
      r.qty += sign * baseQty(l)
      r.sales += sales
      r.cost += cost
      by.set(item.id, r)
    })
    // invoice with no lines at all (should not happen) still counts
    if (t.lines.length === 0) other.sales += sign * net
  }
  const rows: ItemProfitRow[] = [...by].map(([id, r]) => {
    const item = items.get(id)!
    const sales = round2(r.sales), cost = round2(r.cost), profit = round2(r.sales - r.cost)
    return { itemId: id, name: item.name, unit: item.unit, categoryId: item.categoryId, qty: round3(r.qty), sales, cost, profit, margin: pct(profit, sales) }
  }).sort((a, b) => b.profit - a.profit)
  const allSales = rows.reduce((a, r) => a + r.sales, 0) + other.sales
  const allCost = rows.reduce((a, r) => a + r.cost, 0) + other.cost
  const otherOut = { sales: round2(other.sales), cost: round2(other.cost), profit: round2(other.sales - other.cost) }
  const sales = round2(allSales), cost = round2(allCost), profit = round2(allSales - allCost)
  return { rows, other: otherOut, totals: { sales, cost, profit, margin: pct(profit, sales) } }
}

export interface LowStockRow { item: Item; qty: number; min: number; short: number }

/** active products at or below their minimum stock (items with no minimum show when out of stock) */
export function lowStock(d: ReportData, stock: Map<ID, ItemStock>) {
  return d.items
    .filter((i) => i.kind === 'product' && i.active)
    .map((item) => {
      const qty = stock.get(item.id)?.qty ?? 0
      const min = item.minStock ?? 0
      return { item, qty, min, short: round3(Math.max(min - qty, 0)) }
    })
    .filter((r) => r.qty <= r.min)
    .sort((a, b) => a.qty - a.min - (b.qty - b.min))
}

export interface MovementRow {
  itemId: ID
  name: string
  unit: string
  categoryId?: ID
  opening: number
  inQty: number
  outQty: number
  closing: number
}

/** opening, in, out and closing quantity per product for a period (base units) */
export function stockMovement(d: ReportData, from?: string, to?: string) {
  const products = d.items.filter((i) => i.kind === 'product')
  const by = new Map<ID, { opening: number; inQty: number; outQty: number }>(products.map((i) => [i.id, { opening: 0, inQty: 0, outQty: 0 }]))
  const add = (id: ID, date: string, qty: number) => {
    const r = by.get(id)
    if (!r || !qty) return
    if (from && date < from) r.opening += qty
    else if (inRange(date, from, to)) { if (qty > 0) r.inQty += qty; else r.outQty -= qty }
  }
  for (const i of products) if (i.openingStock) add(i.id, i.openingDate, i.openingStock)
  for (const t of activeTxns(d.txns)) {
    const s = TXN_META[t.type].stock
    if (!s) continue
    for (const l of t.lines) if (l.itemId) add(l.itemId, t.date, s * baseQty(l))
  }
  for (const a of d.adjustments) add(a.itemId, a.date, a.qty)
  const rows: MovementRow[] = products.map((i) => {
    const r = by.get(i.id)!
    const opening = round3(r.opening), inQty = round3(r.inQty), outQty = round3(r.outQty)
    return { itemId: i.id, name: i.name, unit: i.unit, categoryId: i.categoryId, opening, inQty, outQty, closing: round3(opening + inQty - outQty) }
  })
  return { rows }
}

export type ExpiryStatus = 'expired' | 'd30' | 'd90' | 'ok' | 'none'

export interface BatchRow {
  itemId: ID
  name: string
  unit: string
  batch: string
  expiry?: string
  qty: number
  /** days left until expiry (negative = expired) */
  days?: number
  status: ExpiryStatus
}

/** stock left in each batch with its expiry status on `asOf` */
export function batchExpiry(d: ReportData, asOf: string) {
  const items = new Map(d.items.map((i) => [i.id, i]))
  const by = new Map<string, { itemId: ID; batch: string; expiry?: string; qty: number }>()
  const touch = (itemId: ID, batch: string, qty: number, expiry?: string) => {
    const k = itemId + '\u0000' + batch
    const r = by.get(k) ?? { itemId, batch, qty: 0 }
    r.qty += qty
    if (expiry && !r.expiry) r.expiry = expiry
    by.set(k, r)
  }
  for (const t of activeTxns(d.txns)) {
    const s = TXN_META[t.type].stock
    if (!s) continue
    for (const l of t.lines) if (l.itemId && l.batch) touch(l.itemId, l.batch.trim(), s * baseQty(l), l.expiry)
  }
  for (const a of d.adjustments) if (a.batch) touch(a.itemId, a.batch.trim(), a.qty)
  const soon30 = addDays(asOf, 30), soon90 = addDays(asOf, 90)
  const rows: BatchRow[] = [...by.values()]
    .filter((r) => round3(r.qty) > 0 && items.get(r.itemId))
    .map((r) => {
      const item = items.get(r.itemId)!
      const status: ExpiryStatus = !r.expiry ? 'none' : r.expiry < asOf ? 'expired' : r.expiry <= soon30 ? 'd30' : r.expiry <= soon90 ? 'd90' : 'ok'
      return { itemId: r.itemId, name: item.name, unit: item.unit, batch: r.batch, expiry: r.expiry, qty: round3(r.qty), days: r.expiry ? daysBetween(asOf, r.expiry) : undefined, status }
    })
    .sort((a, b) => (a.expiry ?? '9999') < (b.expiry ?? '9999') ? -1 : (a.expiry ?? '9999') > (b.expiry ?? '9999') ? 1 : a.name.localeCompare(b.name))
  return { rows }
}

// ---------- dashboard ----------

export interface DayTotals { date: string; sales: number; purchases: number }

/** sale and purchase invoice totals per day, every day from `from` to `to` */
export function dailyTotals(d: ReportData, from: string, to: string): DayTotals[] {
  const days: DayTotals[] = []
  const at = new Map<string, DayTotals>()
  for (let x = from; x <= to; x = addDays(x, 1)) { const r = { date: x, sales: 0, purchases: 0 }; days.push(r); at.set(x, r) }
  for (const t of d.txns) {
    if (t.cancelled || (t.type !== 'sale' && t.type !== 'purchase')) continue
    const r = at.get(t.date)
    if (!r) continue
    if (t.type === 'sale') r.sales = round2(r.sales + t.total)
    else r.purchases = round2(r.purchases + t.total)
  }
  return days
}

/** the numbers on the dashboard cards */
export function dashboardSummary(d: ReportData, books: Books, today: string, monthFrom: string, monthTo: string) {
  let todaySales = 0, todayBills = 0, monthSales = 0, monthBills = 0
  for (const t of d.txns) {
    if (t.cancelled || t.type !== 'sale') continue
    if (t.date === today) { todaySales += t.total; todayBills++ }
    if (inRange(t.date, monthFrom, monthTo)) { monthSales += t.total; monthBills++ }
  }
  let receivable = 0, payable = 0
  for (const [k, v] of books.balances) {
    if (!k.startsWith('party:')) continue
    if (v > 0) receivable += v
    else payable -= v
  }
  let cash = 0, bank = 0
  for (const a of d.accounts) {
    if (a.kind === 'loan') continue
    const b = books.balances.get(`acc:${a.id}`) ?? 0
    if (a.kind === 'cash') cash += b
    else bank += b
  }
  let stockValue = 0
  for (const s of books.stock.values()) stockValue += s.value
  return {
    todaySales: round2(todaySales), todayBills, monthSales: round2(monthSales), monthBills,
    receivable: round2(receivable), payable: round2(payable), cash: round2(cash), bank: round2(bank), stockValue: round2(stockValue),
  }
}

export interface OverdueRow { id: ID; type: TxnType; number: string; date: string; dueDate: string; partyName: string; partyId?: ID; due: number; days: number }

/** sale and purchase invoices past their due date that still have money open */
export function overdueInvoices(d: ReportData, books: Books, today: string): OverdueRow[] {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  return d.txns
    .filter((t) => !t.cancelled && (t.type === 'sale' || t.type === 'purchase') && t.dueDate && t.dueDate < today && (books.dues.get(t.id)?.due ?? 0) > 0.001)
    .map((t) => ({
      id: t.id, type: t.type, number: t.number, date: t.date, dueDate: t.dueDate!, partyId: t.partyId, partyName: partyNameOf(d, t, parties),
      due: books.dues.get(t.id)!.due, days: daysBetween(t.dueDate!, today),
    }))
    .sort((a, b) => (a.type === b.type ? (a.dueDate < b.dueDate ? -1 : 1) : a.type === 'sale' ? -1 : 1))
}

// ---------- periods ----------

/** last day of the month before the one `d` is in */
export const endOfLastMonth = (d: string) => addDays(monthStart(d), -1)

/** 30 June that ended the last finished Pakistani tax year (July to June) */
export function endOfLastTaxYear(d: string) {
  const [y, m] = d.split('-').map(Number)
  return `${m >= 7 ? y : y - 1}-06-30`
}

// ---------- payment reminders ----------

export interface ReminderRow {
  partyId: ID
  name: string
  phone?: string
  /** what the party owes now */
  balance: number
  /** sale invoices with money still open */
  openCount: number
  /** of those, past their due date */
  overdueCount: number
  overdueAmount: number
  /** earliest due date among the open invoices */
  oldestDue?: string
  /** days since the oldest due date (0 when not late) */
  daysLate: number
}

/** parties who owe money, with their open and overdue sale invoices, most late first */
export function reminderRows(d: ReportData, books: Books, today: string): ReminderRow[] {
  const open = new Map<ID, Txn[]>()
  for (const t of activeTxns(d.txns)) {
    if (t.type !== 'sale' || !t.partyId || (books.dues.get(t.id)?.due ?? 0) <= 0.001) continue
    if (!open.has(t.partyId)) open.set(t.partyId, [])
    open.get(t.partyId)!.push(t)
  }
  const rows: ReminderRow[] = []
  for (const p of d.parties) {
    const balance = round2(books.balances.get(`party:${p.id}`) ?? 0)
    if (balance <= 0.004) continue
    const list = open.get(p.id) ?? []
    const overdue = list.filter((t) => t.dueDate && t.dueDate < today)
    const dues = list.map((t) => t.dueDate).filter((x): x is string => !!x).sort()
    const oldestDue = dues[0]
    rows.push({
      partyId: p.id, name: p.name, phone: p.phone, balance,
      openCount: list.length,
      overdueCount: overdue.length,
      overdueAmount: sum(overdue.map((t) => books.dues.get(t.id)!.due)),
      oldestDue,
      daysLate: oldestDue && oldestDue < today ? daysBetween(oldestDue, today) : 0,
    })
  }
  return rows.sort((a, b) => b.daysLate - a.daysLate || b.balance - a.balance)
}

/** fill {party}, {amount}, {firm}, {phone} (and any other {key}) in a message template */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

// ---------- cheques ----------

export interface ChequeRow {
  id: ID
  type: 'payment_in' | 'payment_out'
  number: string
  /** date received / issued */
  date: string
  chequeDate?: string
  refNo?: string
  partyId?: ID
  partyName: string
  accountId?: ID
  amount: number
  /** days since it was received / issued */
  days: number
  /** days until the date on the cheque (negative: the date has passed) */
  dueIn?: number
}

/**
 * Cheques not yet cleared on `asOf`: received (in hand) and issued. Matches the ledger:
 * a cheque is held from its date until it clears; bounced cheques never count.
 */
export function chequeRegister(d: ReportData, asOf: string) {
  const parties = new Map(d.parties.map((p) => [p.id, p]))
  const inHand: ChequeRow[] = []
  const issued: ChequeRow[] = []
  for (const t of activeTxns(d.txns)) {
    if ((t.type !== 'payment_in' && t.type !== 'payment_out') || t.paymentMode !== 'cheque' || !t.chequeStatus) continue
    if (t.date > asOf) continue
    if (t.chequeStatus === 'cleared' && t.clearedOn && (t.clearedOn < t.date ? t.date : t.clearedOn) <= asOf) continue
    const row: ChequeRow = {
      id: t.id, type: t.type, number: t.number, date: t.date, chequeDate: t.chequeDate, refNo: t.refNo,
      partyId: t.partyId, partyName: partyNameOf(d, t, parties), accountId: t.accountId, amount: round2(t.total),
      days: daysBetween(t.date, asOf), dueIn: t.chequeDate ? daysBetween(asOf, t.chequeDate) : undefined,
    }
    ;(t.type === 'payment_in' ? inHand : issued).push(row)
  }
  const byDue = (a: ChequeRow, b: ChequeRow) => ((a.chequeDate ?? a.date) < (b.chequeDate ?? b.date) ? -1 : 1)
  inHand.sort(byDue)
  issued.sort(byDue)
  return {
    inHand, issued,
    totals: { inHand: sum(inHand.map((r) => r.amount)), issued: sum(issued.map((r) => r.amount)), countIn: inHand.length, countOut: issued.length },
  }
}

// ---------- loans ----------

export interface LoanRow {
  accountId: ID
  name: string
  bankName?: string
  /** owed at the start of the period (with the loan's opening balance) */
  opening: number
  borrowed: number
  repaid: number
  /** still owed at the end of the period */
  owed: number
}

/** money owed on each loan account: opening, borrowed, repaid and still owed */
export function loanReport(d: ReportData, books: Books, from?: string, to?: string) {
  const rows: LoanRow[] = d.accounts.filter((a) => a.kind === 'loan').map((a) => {
    const acct = `acc:${a.id}`
    let opening = 0, borrowed = 0, repaid = 0
    for (const p of books.postings) {
      if (p.acct !== acct || (to && p.date > to)) continue
      if ((from && p.date < from) || p.kind === 'opening') opening -= p.amount
      else if (inRange(p.date, from, to)) { if (p.amount < 0) borrowed -= p.amount; else repaid += p.amount }
    }
    opening = round2(opening); borrowed = round2(borrowed); repaid = round2(repaid)
    return { accountId: a.id, name: a.name, bankName: a.bankName, opening, borrowed, repaid, owed: round2(opening + borrowed - repaid) }
  })
  // interest is booked as an expense under a head named like "Loan interest"
  const interestHeads = new Set((d.moneyCategories ?? []).filter((c) => c.kind === 'expense' && /interest|سود/i.test(c.name)).map((c) => `exp:${c.id}`))
  const interest = sum(books.postings.filter((p) => interestHeads.has(p.acct) && inRange(p.date, from, to)).map((p) => p.amount))
  return {
    rows, interest,
    totals: { opening: sum(rows.map((r) => r.opening)), borrowed: sum(rows.map((r) => r.borrowed)), repaid: sum(rows.map((r) => r.repaid)), owed: sum(rows.map((r) => r.owed)) },
  }
}

// ---------- capital account ----------

export interface CapitalEntry { id: ID; type: TxnType; number: string; date: string; amount: number; note?: string }

/**
 * The owner's account for a period: what the owner had in the business at the start,
 * plus opening balances entered, capital added and profit, less drawings.
 * The closing figure equals capital - drawings + profit on the balance sheet.
 */
export function capitalAccount(d: ReportData, books: Books, from?: string, to?: string) {
  const equity = (a: string) => a === 'opening_equity' || a === 'capital' || a === 'drawings'
  let start = 0, openingCapital = 0, added = 0, drawings = 0
  for (const p of books.postings) {
    if (to && p.date > to) continue
    if (from && p.date < from) {
      const c = classOf(p.acct)
      if (equity(p.acct) || c === 'income' || c === 'expense') start -= p.amount
      continue
    }
    if (p.acct === 'opening_equity') openingCapital -= p.amount
    else if (p.acct === 'capital') added -= p.amount
    else if (p.acct === 'drawings') drawings += p.amount
  }
  const profit = profitLoss(books, from, to).netProfit
  start = round2(start); openingCapital = round2(openingCapital); added = round2(added); drawings = round2(drawings)
  const entries: CapitalEntry[] = txnsIn(d, from, to, ['capital_in', 'drawing'])
    .map((t) => ({ id: t.id, type: t.type, number: t.number, date: t.date, amount: round2(t.total), note: t.notes }))
  return { start, openingCapital, added, drawings, profit, closing: round2(start + openingCapital + added - drawings + profit), entries }
}

// ---------- loyalty ----------

export interface LoyaltyRow { partyId: ID; name: string; phone?: string; earned: number; redeemed: number; balance: number; value: number }

/** points earned, spent and left per customer, with the money value of what is left */
export function loyaltyRows(d: ReportData, s: Settings): { rows: LoyaltyRow[]; totals: { earned: number; redeemed: number; balance: number; value: number } } {
  const pts = pointsByParty(d.txns, s)
  const rows: LoyaltyRow[] = []
  for (const p of d.parties) {
    const x = pts.get(p.id)
    if (!x) continue
    rows.push({ partyId: p.id, name: p.name, phone: p.phone, earned: x.earned, redeemed: x.redeemed, balance: x.balance, value: round2(Math.max(0, x.balance) * s.loyalty.pointValue) })
  }
  rows.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  const tot = (k: 'earned' | 'redeemed' | 'balance' | 'value') => round2(rows.reduce((a, r) => a + r[k], 0))
  return { rows, totals: { earned: tot('earned'), redeemed: tot('redeemed'), balance: tot('balance'), value: tot('value') } }
}
