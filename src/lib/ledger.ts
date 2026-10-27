import { round2, round3 } from './format'
import { MAIN_GODOWN } from './db'
import { TXN_META, baseQty, isBounced, moneySplits } from './txn'
import type { Account, ID, Item, MoneyCategory, Party, StockAdjustment, Txn, TxnType } from './types'

/**
 * The accounting engine.
 *
 * Nothing here is stored: every report is rebuilt from the transactions, so editing
 * or deleting an invoice can never leave the books out of balance. Each transaction
 * is turned into double-entry postings (debits positive, credits negative), and
 * stock is valued at weighted average cost, replayed in date order.
 *
 * Ledger accounts:
 *   acc:<id>        cash, bank and wallet accounts            asset
 *   party:<id>      customers / suppliers (+ receivable, - payable)
 *   party:walkin    walk-in customers
 *   inventory       stock at cost                              asset
 *   tax_in          tax paid on purchases                       asset
 *   tax_out         tax charged on sales                        liability
 *   opening_equity  opening balances (capital)                  equity
 *   capital         money the owner put in                      equity
 *   drawings        money the owner took out                    equity (debit)
 *   cheques_in      cheques received, not yet cleared            asset
 *   cheques_out     cheques issued, not yet cleared              liability
 *   (acc:<id> of a loan account is a liability while negative)
 *   sales           sales                                        income
 *   sales_return    customer returns                             contra income
 *   inc:<id>        other income heads                           income
 *   cogs            cost of goods sold                           expense
 *   purchase_services  services bought on purchase bills        expense
 *   exp:<id>        expense heads                                expense
 *   stock_adjust    stock written off / found                    expense
 */

export interface Posting {
  date: string
  /** order within a date */
  seq: number
  acct: string
  /** debit positive, credit negative */
  amount: number
  txnId?: ID
  /** what created it, for statements */
  kind: TxnType | 'opening' | 'adjustment'
  ref?: string
}

export interface ItemStock {
  qty: number
  value: number
  /** weighted average cost per base unit */
  avgCost: number
}

export interface InvoiceDue {
  /** paid or settled so far (at the time of the invoice plus later payments, oldest first) */
  paid: number
  due: number
  status: 'paid' | 'partial' | 'unpaid'
}

export interface BooksInput {
  items: Item[]
  parties: Party[]
  accounts: Account[]
  txns: Txn[]
  adjustments: StockAdjustment[]
  moneyCategories?: MoneyCategory[]
}

export interface Books {
  postings: Posting[]
  /** current stock per item */
  stock: Map<ID, ItemStock>
  /** cost of goods for each sale / return, by txn id (returns negative) */
  cogs: Map<ID, number>
  /** cost of goods of each line of a sale / sale return (same order as txn.lines; 0 for services) */
  lineCogs: Map<ID, number[]>
  /** open balance per sale / purchase invoice */
  dues: Map<ID, InvoiceDue>
  /** part of each party's opening balance still unsettled, per side */
  openingDues: Map<ID, { sale: number; purchase: number }>
  /** balance per ledger account (all dates) */
  balances: Map<string, number>
  /** ledger keys (acc:<id>) of loan accounts, shown as liabilities */
  loanAccts: Set<string>
}

/** transactions that count, in the order they happened */
export function activeTxns(txns: Txn[]): Txn[] {
  return txns
    .filter((t) => !t.cancelled && TXN_META[t.type].posts && !isBounced(t))
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
}

const partyAcct = (t: Txn) => (t.partyId ? `party:${t.partyId}` : 'party:walkin')

export function computeBooks(input: BooksInput): Books {
  const postings: Posting[] = []
  const itemById = new Map(input.items.map((i) => [i.id, i]))
  const stock = new Map<ID, ItemStock>()
  const cogs = new Map<ID, number>()
  const lineCogs = new Map<ID, number[]>()
  let seq = 0

  const post = (date: string, acct: string, amount: number, kind: Posting['kind'], txnId?: ID, ref?: string) => {
    const a = round2(amount)
    if (a !== 0) postings.push({ date, seq: seq++, acct, amount: a, kind, txnId, ref })
  }
  const st = (id: ID) => {
    let s = stock.get(id)
    if (!s) { s = { qty: 0, value: 0, avgCost: 0 }; stock.set(id, s) }
    return s
  }
  const stockIn = (id: ID, qty: number, value: number) => {
    const s = st(id)
    s.qty = round3(s.qty + qty)
    s.value = s.value + value
    if (s.qty > 0) s.avgCost = s.value / s.qty
    else if (qty > 0) s.avgCost = value / qty
    if (s.qty <= 0) s.value = s.qty * s.avgCost
  }
  /** take qty out at average cost, returns its cost */
  const stockOut = (id: ID, qty: number) => {
    const s = st(id)
    const cost = qty * s.avgCost
    s.qty = round3(s.qty - qty)
    s.value = s.qty === 0 ? 0 : s.value - cost
    return cost
  }

  // ---- event list: openings, transactions and adjustments in date order
  type Ev =
    | { date: string; order: number; k: 'item'; item: Item }
    | { date: string; order: number; k: 'txn'; t: Txn }
    | { date: string; order: number; k: 'adj'; a: StockAdjustment }
  const events: Ev[] = []
  for (const item of input.items) {
    if (item.kind === 'product' && item.openingStock) events.push({ date: item.openingDate, order: -1, k: 'item', item })
  }
  for (const t of activeTxns(input.txns)) events.push({ date: t.date, order: t.createdAt, k: 'txn', t })
  for (const a of input.adjustments) events.push({ date: a.date, order: a.createdAt, k: 'adj', a })
  events.sort((x, y) => (x.date === y.date ? x.order - y.order : x.date < y.date ? -1 : 1))

  // ---- opening balances of money accounts and parties
  for (const a of input.accounts) {
    post(a.openingDate, `acc:${a.id}`, a.openingBalance, 'opening')
    post(a.openingDate, 'opening_equity', -a.openingBalance, 'opening')
  }
  for (const p of input.parties) {
    post(p.openingDate, `party:${p.id}`, p.openingBalance, 'opening')
    post(p.openingDate, 'opening_equity', -p.openingBalance, 'opening')
  }

  for (const ev of events) {
    if (ev.k === 'item') {
      const it = ev.item
      const cost = it.openingCost ?? it.purchasePrice
      const value = it.openingStock * cost
      stockIn(it.id, it.openingStock, value)
      post(it.openingDate, 'inventory', value, 'opening', undefined, it.name)
      post(it.openingDate, 'opening_equity', -value, 'opening', undefined, it.name)
      continue
    }
    if (ev.k === 'adj') {
      const a = ev.a
      const item = itemById.get(a.itemId)
      if (!item || item.kind !== 'product') continue
      let value: number
      if (a.qty >= 0) {
        value = a.qty * (st(a.itemId).avgCost || item.purchasePrice)
        stockIn(a.itemId, a.qty, value)
      } else {
        value = -stockOut(a.itemId, -a.qty)
      }
      post(a.date, 'inventory', value, 'adjustment', undefined, item.name)
      post(a.date, 'stock_adjust', -value, 'adjustment', undefined, item.name)
      continue
    }

    const t = ev.t
    const P = partyAcct(t)
    const net = t.total - t.taxTotal
    const k = t.type
    const d = t.date
    /** money received (+1) or paid (-1) now, through one or more accounts, against the party */
    const settle = (sign: 1 | -1, withParty = true) => {
      for (const p of moneySplits(t)) {
        post(d, `acc:${p.accountId}`, sign * p.amount, k, t.id)
        if (withParty) post(d, P, -sign * p.amount, k, t.id)
      }
    }
    /** a single payment that may be a cheque: in hand until cleared */
    const cheque = (sign: 1 | -1) => {
      const acc = `acc:${t.accountId}`
      if (t.paymentMode !== 'cheque' || !t.chequeStatus) { post(d, acc, sign * t.total, k, t.id); return }
      const hold = sign > 0 ? 'cheques_in' : 'cheques_out'
      post(d, hold, sign * t.total, k, t.id)
      if (t.chequeStatus === 'cleared' && t.clearedOn) {
        const cd = t.clearedOn < d ? d : t.clearedOn
        post(cd, hold, -sign * t.total, k, t.id, 'cleared')
        post(cd, acc, sign * t.total, k, t.id, 'cleared')
      }
    }

    switch (k) {
      case 'sale': {
        post(d, P, t.total, k, t.id)
        post(d, 'sales', -net, k, t.id)
        post(d, 'tax_out', -t.taxTotal, k, t.id)
        settle(1)
        let c = 0
        const per: number[] = []
        for (const l of t.lines) {
          const item = l.itemId ? itemById.get(l.itemId) : undefined
          const lc = item?.kind === 'product' ? stockOut(item.id, baseQty(l)) : 0
          per.push(round2(lc))
          c += lc
        }
        cogs.set(t.id, round2(c))
        lineCogs.set(t.id, per)
        post(d, 'cogs', c, k, t.id)
        post(d, 'inventory', -c, k, t.id)
        break
      }
      case 'sale_return': {
        post(d, 'sales_return', net, k, t.id)
        post(d, 'tax_out', t.taxTotal, k, t.id)
        post(d, P, -t.total, k, t.id)
        settle(-1)
        let c = 0
        const per: number[] = []
        for (const l of t.lines) {
          const item = l.itemId ? itemById.get(l.itemId) : undefined
          if (item?.kind !== 'product') { per.push(0); continue }
          const q = baseQty(l)
          const unit = st(item.id).avgCost || item.purchasePrice
          stockIn(item.id, q, q * unit)
          c += q * unit
          per.push(-round2(q * unit))
        }
        cogs.set(t.id, -round2(c))
        lineCogs.set(t.id, per)
        post(d, 'inventory', c, k, t.id)
        post(d, 'cogs', -c, k, t.id)
        break
      }
      case 'purchase': {
        // spread invoice discount, charges and round-off over the lines by value
        const lineNet = t.lines.reduce((a, l) => a + (l.amount - l.taxAmount), 0)
        const f = lineNet > 0 ? net / lineNet : 1
        let inv = 0
        for (const l of t.lines) {
          const value = (l.amount - l.taxAmount) * f
          const item = l.itemId ? itemById.get(l.itemId) : undefined
          if (item?.kind === 'product') { stockIn(item.id, baseQty(l), value); inv += value }
        }
        post(d, 'inventory', inv, k, t.id)
        post(d, 'purchase_services', net - inv, k, t.id)
        post(d, 'tax_in', t.taxTotal, k, t.id)
        post(d, P, -t.total, k, t.id)
        settle(-1)
        break
      }
      case 'purchase_return': {
        // goods leave at average cost; the gap to the supplier's price goes to cost of goods
        let c = 0
        for (const l of t.lines) {
          const item = l.itemId ? itemById.get(l.itemId) : undefined
          if (item?.kind === 'product') c += stockOut(item.id, baseQty(l))
        }
        post(d, P, t.total, k, t.id)
        post(d, 'tax_in', -t.taxTotal, k, t.id)
        post(d, 'inventory', -c, k, t.id)
        post(d, 'cogs', c - net, k, t.id)
        settle(1)
        break
      }
      case 'payment_in':
        cheque(1)
        post(d, P, -t.total, k, t.id)
        break
      case 'payment_out':
        post(d, P, t.total, k, t.id)
        cheque(-1)
        break
      case 'expense':
        post(d, `exp:${t.categoryId ?? 'other'}`, t.total, k, t.id)
        if (t.partyId) {
          post(d, P, -t.total, k, t.id)
          settle(-1)
        } else settle(-1, false)
        break
      case 'capital_in':
        post(d, `acc:${t.accountId}`, t.total, k, t.id)
        post(d, 'capital', -t.total, k, t.id)
        break
      case 'drawing':
        post(d, 'drawings', t.total, k, t.id)
        post(d, `acc:${t.accountId}`, -t.total, k, t.id)
        break
      case 'manufacture': {
        // materials leave at average cost; the finished goods carry that cost plus making charges
        let c = 0
        for (const l of t.lines) {
          const item = l.itemId ? itemById.get(l.itemId) : undefined
          if (item?.kind === 'product') c += stockOut(item.id, baseQty(l))
        }
        const out = t.outputItemId ? itemById.get(t.outputItemId) : undefined
        if (out && t.outputQty) stockIn(out.id, t.outputQty, c + (t.charges || 0))
        cogs.set(t.id, round2(c))
        post(d, 'inventory', t.charges || 0, k, t.id, out?.name)
        if (t.charges) post(d, `acc:${t.accountId}`, -t.charges, k, t.id)
        break
      }
      case 'other_income':
        post(d, `acc:${t.accountId}`, t.total, k, t.id)
        post(d, `inc:${t.categoryId ?? 'other'}`, -t.total, k, t.id)
        break
      case 'transfer':
        post(d, `acc:${t.toAccountId}`, t.total, k, t.id)
        post(d, `acc:${t.accountId}`, -t.total, k, t.id)
        break
      default:
        break
    }
  }

  for (const s of stock.values()) {
    s.value = round2(s.value)
    s.avgCost = round2(s.avgCost)
  }

  // cleared cheques add postings dated later; keep every list in date order
  postings.sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date < b.date ? -1 : 1))

  const balances = new Map<string, number>()
  for (const p of postings) balances.set(p.acct, (balances.get(p.acct) ?? 0) + p.amount)
  for (const [k, v] of balances) balances.set(k, round2(v))

  const openingDues = new Map<ID, { sale: number; purchase: number }>()
  const loanAccts = new Set(input.accounts.filter((a) => a.kind === 'loan').map((a) => `acc:${a.id}`))
  return { postings, stock, cogs, lineCogs, dues: computeDues(input, openingDues), openingDues, balances, loanAccts }
}

/**
 * Open amount of each sale / purchase invoice. Payments and returns of a party settle
 * its oldest invoices first (the opening balance counts as the oldest).
 */
export function computeDues(input: BooksInput, openingOut?: Map<ID, { sale: number; purchase: number }>): Map<ID, InvoiceDue> {
  const dues = new Map<ID, InvoiceDue>()
  const txns = activeTxns(input.txns)
  const opening = new Map(input.parties.map((p) => [p.id, p.openingBalance]))
  // parties with no transactions keep their whole opening balance
  if (openingOut) for (const p of input.parties) openingOut.set(p.id, { sale: Math.max(p.openingBalance, 0), purchase: Math.max(-p.openingBalance, 0) })

  for (const side of ['sale', 'purchase'] as const) {
    const byParty = new Map<string, Txn[]>()
    for (const t of txns) {
      if (!t.partyId) continue
      const s = TXN_META[t.type].side
      if (s !== side && !(side === 'sale' && t.type === 'payment_in') && !(side === 'purchase' && t.type === 'payment_out')) continue
      if (!byParty.has(t.partyId)) byParty.set(t.partyId, [])
      byParty.get(t.partyId)!.push(t)
    }
    for (const [pid, list] of byParty) {
      // credit pool: payments and returns (unrefunded part)
      let pool = 0
      const ob = opening.get(pid) ?? 0
      // opening balance in our favour on this side is settled first; the opposite adds to the pool
      let openingDue = side === 'sale' ? Math.max(ob, 0) : Math.max(-ob, 0)
      pool += side === 'sale' ? Math.max(-ob, 0) : Math.max(ob, 0)
      const invoices: Txn[] = []
      // payments made against a particular invoice settle it first; the rest joins the pool
      const direct = new Map<ID, number>()
      const byId = new Map(list.map((t) => [t.id, t]))
      for (const t of list) {
        if (t.type === side) invoices.push(t)
        else if (t.type === 'payment_in' || t.type === 'payment_out') {
          const inv = t.againstId ? byId.get(t.againstId) : undefined
          if (inv && inv.type === side) {
            const room = Math.max(0, inv.total - inv.received - (direct.get(inv.id) ?? 0))
            const use = Math.min(room, t.total)
            direct.set(inv.id, (direct.get(inv.id) ?? 0) + use)
            pool += t.total - use
          } else pool += t.total
        } else pool += t.total - t.received
      }
      const take = Math.min(pool, openingDue)
      pool -= take
      openingDue -= take
      if (openingOut) {
        const o = openingOut.get(pid) ?? { sale: 0, purchase: 0 }
        o[side] = round2(openingDue)
        openingOut.set(pid, o)
      }
      for (const inv of invoices) {
        const open = round2(inv.total - inv.received - (direct.get(inv.id) ?? 0))
        const used = Math.min(pool, open)
        pool = round2(pool - used)
        const due = round2(open - used)
        const paid = round2(inv.total - due)
        dues.set(inv.id, { paid, due, status: due <= 0.001 ? 'paid' : paid > 0.001 ? 'partial' : 'unpaid' })
      }
    }
  }
  // walk-in sales are always settled
  for (const t of txns) {
    if ((t.type === 'sale' || t.type === 'purchase') && !dues.has(t.id)) {
      const due = round2(t.total - t.received)
      dues.set(t.id, { paid: t.received, due, status: due <= 0.001 ? 'paid' : t.received > 0 ? 'partial' : 'unpaid' })
    }
  }
  return dues
}

// ---------- classification ----------

export type AcctClass = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export function classOf(acct: string, balance = 0): AcctClass {
  if (acct.startsWith('acc:') || acct === 'inventory' || acct === 'tax_in' || acct === 'cheques_in') return 'asset'
  if (acct.startsWith('party:')) return balance >= 0 ? 'asset' : 'liability'
  if (acct === 'tax_out' || acct === 'cheques_out') return 'liability'
  if (acct === 'opening_equity' || acct === 'capital' || acct === 'drawings') return 'equity'
  if (acct === 'sales' || acct === 'sales_return' || acct.startsWith('inc:')) return 'income'
  return 'expense'
}

/** human name of a ledger account (i18n key or record name) */
export function acctName(acct: string, names: { accounts: Account[]; parties: Party[]; cats?: MoneyCategory[] }, t: (k: string) => string): string {
  const [kind, id] = acct.split(':')
  if (kind === 'acc') return names.accounts.find((a) => a.id === id)?.name ?? acct
  if (kind === 'party') return id === 'walkin' ? t('walkIn') : names.parties.find((p) => p.id === id)?.name ?? acct
  if (kind === 'exp' || kind === 'inc') return names.cats?.find((c) => c.id === id)?.name ?? t('la_other')
  return t('la_' + acct)
}

// ---------- reports ----------

const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to)

export function sumWhere(postings: Posting[], pred: (p: Posting) => boolean) {
  let s = 0
  for (const p of postings) if (pred(p)) s += p.amount
  return round2(s)
}

export function balanceOf(books: Books, acct: string, asOf?: string) {
  if (!asOf) return books.balances.get(acct) ?? 0
  return sumWhere(books.postings, (p) => p.acct === acct && p.date <= asOf)
}

export interface ProfitLoss {
  sales: number
  salesReturn: number
  netSales: number
  cogs: number
  grossProfit: number
  otherIncome: { acct: string; amount: number }[]
  expenses: { acct: string; amount: number }[]
  purchaseServices: number
  stockAdjust: number
  totalExpenses: number
  totalOtherIncome: number
  netProfit: number
}

export function profitLoss(books: Books, from?: string, to?: string): ProfitLoss {
  const by = new Map<string, number>()
  for (const p of books.postings) {
    if (!inRange(p.date, from, to)) continue
    const c = classOf(p.acct)
    if (c === 'income' || c === 'expense') by.set(p.acct, (by.get(p.acct) ?? 0) + p.amount)
  }
  const g = (k: string) => round2(by.get(k) ?? 0)
  const sales = -g('sales')
  const salesReturn = g('sales_return')
  const netSales = round2(sales - salesReturn)
  const cogs = g('cogs')
  const grossProfit = round2(netSales - cogs)
  const otherIncome = [...by].filter(([k]) => k.startsWith('inc:')).map(([acct, v]) => ({ acct, amount: round2(-v) })).filter((x) => x.amount !== 0)
  const expenses = [...by].filter(([k]) => k.startsWith('exp:')).map(([acct, v]) => ({ acct, amount: round2(v) })).filter((x) => x.amount !== 0)
  const purchaseServices = g('purchase_services')
  const stockAdjust = g('stock_adjust')
  const totalOtherIncome = round2(otherIncome.reduce((a, x) => a + x.amount, 0))
  const totalExpenses = round2(expenses.reduce((a, x) => a + x.amount, 0) + purchaseServices + stockAdjust)
  return {
    sales, salesReturn, netSales, cogs, grossProfit, otherIncome, expenses, purchaseServices, stockAdjust,
    totalExpenses, totalOtherIncome, netProfit: round2(grossProfit + totalOtherIncome - totalExpenses),
  }
}

export interface BalanceSheet {
  cashBank: { acct: string; amount: number }[]
  /** cheques received and not yet cleared */
  chequesInHand: number
  receivables: number
  inventory: number
  taxCredit: number
  totalAssets: number
  payables: number
  /** cheques issued and not yet cleared */
  chequesIssued: number
  taxPayable: number
  /** loan accounts (amount still owed) */
  loans: { acct: string; amount: number }[]
  /** opening capital plus capital put in later */
  capital: number
  /** taken out by the owner (reduces capital) */
  drawings: number
  profit: number
  totalLiabilities: number
}

export function balanceSheet(books: Books, asOf?: string): BalanceSheet {
  const by = new Map<string, number>()
  for (const p of books.postings) if (!asOf || p.date <= asOf) by.set(p.acct, (by.get(p.acct) ?? 0) + p.amount)
  let receivables = 0, payables = 0, profit = 0
  const cashBank: { acct: string; amount: number }[] = []
  const loans: { acct: string; amount: number }[] = []
  for (const [k, v0] of by) {
    const v = round2(v0)
    if (books.loanAccts?.has(k)) loans.push({ acct: k, amount: round2(-v) })
    else if (k.startsWith('acc:')) cashBank.push({ acct: k, amount: v })
    else if (k.startsWith('party:')) { if (v > 0) receivables += v; else payables -= v }
    else { const c = classOf(k); if (c === 'income' || c === 'expense') profit -= v }
  }
  const g = (k: string) => round2(by.get(k) ?? 0)
  const inventory = g('inventory')
  // tax is shown net: payable if more was charged than paid
  const netTax = round2(g('tax_out') + g('tax_in'))
  const taxPayable = netTax < 0 ? -netTax : 0
  const taxCredit = netTax > 0 ? netTax : 0
  const chequesInHand = g('cheques_in')
  const chequesIssued = round2(-g('cheques_out'))
  const capital = round2(-(g('opening_equity') + g('capital')))
  const drawings = g('drawings')
  const cash = round2(cashBank.reduce((a, x) => a + x.amount, 0))
  const loanTotal = round2(loans.reduce((a, x) => a + x.amount, 0))
  return {
    cashBank, chequesInHand, receivables: round2(receivables), inventory, taxCredit,
    totalAssets: round2(cash + chequesInHand + receivables + inventory + taxCredit),
    payables: round2(payables), chequesIssued, taxPayable, loans, capital, drawings, profit: round2(profit),
    totalLiabilities: round2(payables + chequesIssued + taxPayable + loanTotal + capital - drawings + profit),
  }
}

/** debit / credit totals per account, for the trial balance */
export function trialBalance(books: Books, asOf?: string) {
  const by = new Map<string, number>()
  for (const p of books.postings) if (!asOf || p.date <= asOf) by.set(p.acct, (by.get(p.acct) ?? 0) + p.amount)
  const rows = [...by].map(([acct, v]) => ({ acct, debit: v > 0 ? round2(v) : 0, credit: v < 0 ? round2(-v) : 0 }))
    .filter((r) => r.debit || r.credit)
    .sort((a, b) => a.acct.localeCompare(b.acct))
  return {
    rows,
    debit: round2(rows.reduce((a, r) => a + r.debit, 0)),
    credit: round2(rows.reduce((a, r) => a + r.credit, 0)),
  }
}

export interface StatementRow {
  date: string
  kind: Posting['kind']
  txnId?: ID
  ref?: string
  debit: number
  credit: number
  balance: number
}

/** running statement of one ledger account (party khata, cash book, bank book) */
export function statement(books: Books, acct: string, from?: string, to?: string) {
  const all = books.postings.filter((p) => p.acct === acct)
  const opening = round2(all.filter((p) => from && p.date < from).reduce((a, p) => a + p.amount, 0))
  // group postings of one transaction into a single row
  const rows: StatementRow[] = []
  let bal = opening
  const keyOf = (p: Posting) => p.txnId ?? `${p.kind}:${p.seq}`
  const groups = new Map<string, Posting[]>()
  for (const p of all) {
    if (!inRange(p.date, from, to)) continue
    const k = keyOf(p)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  }
  for (const list of groups.values()) {
    const amount = round2(list.reduce((a, p) => a + p.amount, 0))
    const debit = round2(list.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0))
    const credit = round2(-list.filter((p) => p.amount < 0).reduce((a, p) => a + p.amount, 0))
    bal = round2(bal + amount)
    rows.push({ date: list[0].date, kind: list[0].kind, txnId: list[0].txnId, ref: list[0].ref, debit, credit, balance: bal })
  }
  return { opening, rows, closing: bal }
}

/** quantity of each item on hand, without valuation (cheap, for pickers) */
export function stockQty(items: Item[], txns: Txn[], adjustments: StockAdjustment[]): Map<ID, number> {
  const q = new Map<ID, number>()
  for (const i of items) if (i.kind === 'product') q.set(i.id, i.openingStock || 0)
  for (const t of txns) {
    if (t.cancelled) continue
    const sign = TXN_META[t.type].stock
    if (!sign) continue
    for (const l of t.lines) if (l.itemId && q.has(l.itemId)) q.set(l.itemId, round3(q.get(l.itemId)! + sign * baseQty(l)))
  }
  for (const t of txns) {
    if (t.type === 'manufacture' && !t.cancelled && t.outputItemId && q.has(t.outputItemId)) q.set(t.outputItemId, round3(q.get(t.outputItemId)! + (t.outputQty || 0)))
  }
  for (const a of adjustments) if (q.has(a.itemId)) q.set(a.itemId, round3(q.get(a.itemId)! + a.qty))
  return q
}

/** quantity of each item in each godown (item id → godown id → base units); empty godown = main */
export function godownStock(items: Item[], txns: Txn[], adjustments: StockAdjustment[]): Map<ID, Map<ID, number>> {
  const out = new Map<ID, Map<ID, number>>()
  const add = (itemId: ID | undefined, godown: ID | undefined, qty: number) => {
    if (!itemId || !qty) return
    let m = out.get(itemId)
    if (!m) { m = new Map(); out.set(itemId, m) }
    const g = godown || MAIN_GODOWN
    m.set(g, round3((m.get(g) ?? 0) + qty))
  }
  const products = new Set(items.filter((i) => i.kind === 'product').map((i) => i.id))
  for (const i of items) if (products.has(i.id)) add(i.id, MAIN_GODOWN, i.openingStock || 0)
  for (const t of txns) {
    if (t.cancelled) continue
    if (t.type === 'stock_transfer') {
      for (const l of t.lines) { add(l.itemId, t.godownId, -baseQty(l)); add(l.itemId, t.toGodownId, baseQty(l)) }
      continue
    }
    const sign = TXN_META[t.type].stock
    if (sign) for (const l of t.lines) if (l.itemId && products.has(l.itemId)) add(l.itemId, t.godownId, sign * baseQty(l))
    if (t.type === 'manufacture' && t.outputItemId) add(t.outputItemId, t.godownId, t.outputQty || 0)
  }
  for (const a of adjustments) if (products.has(a.itemId)) add(a.itemId, a.godownId, a.qty)
  return out
}
