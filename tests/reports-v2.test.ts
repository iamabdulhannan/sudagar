import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import 'fake-indexeddb/auto'
import { defaultSettings, firmDb, seedFirm } from '../src/lib/db'
import { balanceSheet, computeBooks, profitLoss, trialBalance } from '../src/lib/ledger'
import {
  capitalAccount, cashFlow, chequeRegister, dashboardSummary, endOfLastMonth, endOfLastTaxYear, fillTemplate, loanReport,
  loyaltyRows, reminderRows, type ReportData,
} from '../src/lib/reports'
import { blankTxn, calcTotals, lineFor } from '../src/lib/txn'
import type { Account, AppUser, Item, Party, Txn, TxnType } from '../src/lib/types'
import {
  checkPin, checkUserChange, hashPin, lockEnabled, ROLE_PERMS, saveUser, sha256Hex, sha256Js, userCan, UserError, validPin,
} from '../src/lib/users'

// ---------- fixture: cheques, a loan, capital, drawings ----------

const s = defaultSettings('retail')
s.features.roundOff = false
s.features.tax = false
s.features.loyalty = true
s.loyalty = { earnPer: 100, pointValue: 2 }

const acc = (id: string, kind: Account['kind'], opening = 0): Account => ({ id, kind, name: id, openingBalance: opening, openingDate: '2026-01-01', active: true, createdAt: 0 })
const cash = acc('cash', 'cash', 20000)
const bank = acc('bank', 'bank', 5000)
const loan = acc('loan', 'loan', -30000) // 30,000 owed from before
const loan2 = acc('loan2', 'loan', 0)
const pen: Item = {
  id: 'pen', kind: 'product', name: 'Pen', unit: 'pcs', salePrice: 100, purchasePrice: 60, taxRate: 0, priceIncludesTax: false,
  openingStock: 100, openingDate: '2026-01-01', active: true, createdAt: 0,
}
const party = (id: string, opening = 0, phone?: string): Party => ({ id, name: id.toUpperCase(), kind: 'customer', phone, openingBalance: opening, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 })
const ali = party('ali', 0, '0300 1234567')
const bilal = party('bilal', 500)
const sup: Party = { ...party('sup', -5000), kind: 'supplier' }

let clock = 1
const txn = (type: TxnType, over: Partial<Txn>, lines: [Item, number][] = []): Txn => {
  const t = calcTotals({ ...blankTxn(type, s), accountId: 'cash', createdAt: clock++, dueDate: undefined, lines: lines.map(([i, q]) => lineFor(i, 'sale', undefined, s, q)), ...over }, s)
  if (!lines.length) t.received = t.total
  return t
}

const sale1 = txn('sale', { date: '2026-02-01', partyId: 'ali', dueDate: '2026-02-15', received: 0 }, [[pen, 50]]) // 5000, earns 50 points
const sale2 = txn('sale', { date: '2026-03-01', partyId: 'ali', dueDate: '2026-04-30', received: 1000, pointsRedeemed: 10 }, [[pen, 30]]) // 3000
const sale3 = txn('sale', { date: '2026-03-05', partyId: 'bilal', received: 0 }, [[pen, 5]]) // 500, no due date
const chqIn = txn('payment_in', { date: '2026-03-10', partyId: 'ali', total: 2000, paymentMode: 'cheque', chequeStatus: 'open', chequeDate: '2026-03-20', accountId: 'bank', refNo: '123' })
const chqCleared = txn('payment_in', { date: '2026-03-11', partyId: 'ali', total: 1500, paymentMode: 'cheque', chequeStatus: 'cleared', clearedOn: '2026-03-18', accountId: 'bank' })
const chqBounced = txn('payment_in', { date: '2026-03-12', partyId: 'bilal', total: 400, paymentMode: 'cheque', chequeStatus: 'bounced', accountId: 'bank' })
const chqOut = txn('payment_out', { date: '2026-03-13', partyId: 'sup', total: 700, paymentMode: 'cheque', chequeStatus: 'open', chequeDate: '2026-03-13', accountId: 'bank' })
const capital = txn('capital_in', { date: '2026-02-10', total: 10000 })
const drawing = txn('drawing', { date: '2026-03-15', total: 2500 })
const borrow = txn('transfer', { date: '2026-02-20', total: 50000, accountId: 'loan2', toAccountId: 'bank' })
const repay = txn('transfer', { date: '2026-03-20', total: 8000, accountId: 'bank', toAccountId: 'loan2' })
const repayOld = txn('transfer', { date: '2026-03-21', total: 5000, accountId: 'bank', toAccountId: 'loan' })
const interest = txn('expense', { date: '2026-03-21', total: 600, categoryId: 'int' })
const rent = txn('expense', { date: '2026-02-05', total: 1000, categoryId: 'rent' })
const cancelled = { ...txn('payment_in', { date: '2026-03-14', partyId: 'ali', total: 999, paymentMode: 'cheque', chequeStatus: 'open', accountId: 'bank' }), cancelled: true }

const data: ReportData = {
  items: [pen], categories: [], parties: [ali, bilal, sup], accounts: [cash, bank, loan, loan2],
  moneyCategories: [{ id: 'int', kind: 'expense', name: 'Loan interest' }, { id: 'rent', kind: 'expense', name: 'Rent' }],
  txns: [sale1, sale2, sale3, chqIn, chqCleared, chqBounced, chqOut, capital, drawing, borrow, repay, repayOld, interest, rent, cancelled],
  adjustments: [],
}
const books = computeBooks(data)

test('the v2 fixture keeps the books balanced', () => {
  const tb = trialBalance(books)
  assert.equal(tb.debit, tb.credit)
  for (const d of ['2026-02-28', '2026-03-12', '2026-03-19', undefined]) {
    const bs = balanceSheet(books, d)
    assert.equal(bs.totalAssets, bs.totalLiabilities, `balance sheet on ${d}`)
  }
})

test('open cheques match the cheques in hand and issued on the balance sheet, on any date', () => {
  for (const d of ['2026-03-09', '2026-03-12', '2026-03-17', '2026-03-18', '2026-12-31']) {
    const reg = chequeRegister(data, d)
    const bs = balanceSheet(books, d)
    assert.equal(reg.totals.inHand, bs.chequesInHand, `in hand on ${d}`)
    assert.equal(reg.totals.issued, bs.chequesIssued, `issued on ${d}`)
  }
  // before it cleared on the 18th both received cheques were in hand; bounced and cancelled never count
  const mid = chequeRegister(data, '2026-03-17')
  assert.deepEqual(mid.inHand.map((r) => r.amount), [1500, 2000], 'sorted by the date on the cheque')
  const end = chequeRegister(data, '2026-03-25')
  assert.equal(end.totals.countIn, 1)
  assert.equal(end.inHand[0].days, 15)
  assert.equal(end.inHand[0].dueIn, -5, 'cheque date passed 5 days ago')
  assert.equal(end.issued[0].partyName, 'SUP')
})

test('loans: still owed equals the loans on the balance sheet', () => {
  const all = loanReport(data, books)
  const bs = balanceSheet(books)
  assert.equal(all.totals.owed, bs.loans.reduce((a, x) => a + x.amount, 0))
  const old = all.rows.find((r) => r.accountId === 'loan')!
  assert.deepEqual([old.opening, old.borrowed, old.repaid, old.owed], [30000, 0, 5000, 25000])
  const fresh = all.rows.find((r) => r.accountId === 'loan2')!
  assert.deepEqual([fresh.opening, fresh.borrowed, fresh.repaid, fresh.owed], [0, 50000, 8000, 42000])
  assert.equal(all.interest, 600)
  // a period starting in March carries February's borrowing as the opening
  const march = loanReport(data, books, '2026-03-01', '2026-03-31')
  assert.equal(march.rows.find((r) => r.accountId === 'loan2')!.opening, 50000)
  assert.equal(march.totals.owed, all.totals.owed)
})

test('capital account closes at capital - drawings + profit of the balance sheet', () => {
  const full = capitalAccount(data, books)
  const bs = balanceSheet(books)
  assert.equal(full.closing, Math.round((bs.capital - bs.drawings + bs.profit) * 100) / 100)
  assert.equal(full.added, 10000)
  assert.equal(full.drawings, 2500)
  assert.equal(full.profit, profitLoss(books).netProfit)
  assert.equal(full.entries.length, 2)
  // a period: what the owner had on 1 March plus March's movement
  const march = capitalAccount(data, books, '2026-03-01', '2026-03-31')
  const feb = balanceSheet(books, '2026-02-28')
  assert.equal(march.start, Math.round((feb.capital - feb.drawings + feb.profit) * 100) / 100)
  const endMarch = balanceSheet(books, '2026-03-31')
  assert.equal(march.closing, Math.round((endMarch.capital - endMarch.drawings + endMarch.profit) * 100) / 100)
  assert.equal(march.added, 0)
  assert.equal(march.drawings, 2500)
})

test('loan accounts are not counted as money in hand', () => {
  const sum = dashboardSummary(data, books, '2026-03-25', '2026-03-01', '2026-03-31')
  assert.equal(sum.bank, books.balances.get('acc:bank'))
  const flow = cashFlow(data, books)
  assert.ok(!flow.accounts.some((a) => a.accountId === 'loan' || a.accountId === 'loan2'))
  assert.equal(flow.closing, (books.balances.get('acc:cash') ?? 0) + (books.balances.get('acc:bank') ?? 0))
})

test('payment reminders: who owes, overdue invoices and the oldest due date', () => {
  const rows = reminderRows(data, books, '2026-03-25')
  const a = rows.find((r) => r.partyId === 'ali')!
  // 5000 + 3000 - 1000 paid - 2000 cheque in hand - 1500 cleared
  assert.equal(a.balance, 3500)
  assert.equal(a.overdueCount, 1)
  assert.equal(a.oldestDue, '2026-02-15')
  assert.equal(a.daysLate, 38)
  // payments settle the oldest invoice first, so what is overdue is what is left of the first one
  assert.equal(a.overdueAmount, 1500)
  const b = rows.find((r) => r.partyId === 'bilal')!
  assert.equal(b.balance, 1000, 'the bounced cheque does not reduce the balance')
  assert.equal(b.overdueCount, 0)
  assert.equal(rows[0].partyId, 'ali', 'the most late first')
  assert.ok(!rows.some((r) => r.partyId === 'sup'))
  assert.equal(
    fillTemplate('Dear {party}, {amount} is due to {firm} ({phone}). {unknown}', { party: 'Ali', amount: 'Rs 3,500', firm: 'Madina', phone: '0300' }),
    'Dear Ali, Rs 3,500 is due to Madina (0300). {unknown}',
  )
})

test('loyalty rows: earned, spent, left and value', () => {
  const { rows, totals } = loyaltyRows(data, s)
  const a = rows.find((r) => r.partyId === 'ali')!
  assert.deepEqual([a.earned, a.redeemed, a.balance, a.value], [80, 10, 70, 140])
  assert.equal(totals.earned, 85)
})

test('closing dates: end of last month and of the Pakistani tax year', () => {
  assert.equal(endOfLastMonth('2026-10-20'), '2026-09-30')
  assert.equal(endOfLastMonth('2026-03-01'), '2026-02-28')
  assert.equal(endOfLastMonth('2026-01-15'), '2025-12-31')
  assert.equal(endOfLastTaxYear('2026-10-20'), '2026-06-30')
  assert.equal(endOfLastTaxYear('2026-07-01'), '2026-06-30')
  assert.equal(endOfLastTaxYear('2026-06-30'), '2025-06-30')
})

// ---------- users, PINs and permissions ----------

test('SHA-256 fallback matches Web Crypto', async () => {
  for (const text of ['', 'abc', 'saudagar|firm|user|1234', 'x'.repeat(200), 'سوداگر']) {
    const data = new TextEncoder().encode(text)
    const want = Buffer.from(await webcrypto.subtle.digest('SHA-256', data)).toString('hex')
    assert.equal(Buffer.from(sha256Js(data)).toString('hex'), want)
    assert.equal(await sha256Hex(text), want)
  }
})

test('PINs: 4 to 6 digits, salted per business and user, compared by hash only', async () => {
  assert.ok(validPin('1234') && validPin('123456'))
  assert.ok(!validPin('123') && !validPin('1234567') && !validPin('12a4'))
  const h = await hashPin('firm1', 'u1', '1234')
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.notEqual(h, await hashPin('firm2', 'u1', '1234'))
  assert.notEqual(h, await hashPin('firm1', 'u2', '1234'))
  const u: AppUser = { id: 'u1', name: 'Owner', role: 'owner', pinHash: h, active: true, createdAt: 0 }
  assert.equal(await checkPin('firm1', u, '1234'), true)
  assert.equal(await checkPin('firm1', u, '4321'), false)
  assert.equal(await checkPin('firm2', u, '1234'), false)
})

test('roles: what each can do, and single-owner mode allows everything', () => {
  const as = (role: AppUser['role']): AppUser => ({ id: role, name: role, role, pinHash: 'x', active: true, createdAt: 0 })
  assert.equal(ROLE_PERMS.owner.size, 12)
  assert.ok(userCan(null, 'users') && userCan(null, 'delete'))
  assert.ok(userCan(as('manager'), 'sell') && userCan(as('manager'), 'profit'))
  assert.ok(!userCan(as('manager'), 'users') && !userCan(as('manager'), 'settings') && !userCan(as('manager'), 'delete') && !userCan(as('manager'), 'editPast'))
  assert.ok(userCan(as('accountant'), 'money') && userCan(as('accountant'), 'profit') && userCan(as('accountant'), 'backup') && userCan(as('accountant'), 'sell'))
  assert.ok(!userCan(as('accountant'), 'settings') && !userCan(as('accountant'), 'users'))
  assert.deepEqual([...ROLE_PERMS.cashier].sort(), ['parties', 'sell'])
  // lock only when turned on and someone can sign in
  assert.equal(lockEnabled(true, []), false)
  assert.equal(lockEnabled(false, [as('owner')]), false)
  assert.equal(lockEnabled(true, [{ ...as('owner'), active: false }]), false)
  assert.equal(lockEnabled(true, [as('owner')]), true)
})

test('users: there is always an active owner', async () => {
  const owner: AppUser = { id: 'o', name: 'Owner', role: 'owner', pinHash: 'x', active: true, createdAt: 0 }
  const cashier: AppUser = { id: 'c', name: 'Cashier', role: 'cashier', pinHash: 'x', active: true, createdAt: 0 }
  assert.equal(checkUserChange([], cashier), 'us_errOwner')
  assert.equal(checkUserChange([owner], { ...owner, active: false }), 'us_errOwner')
  assert.equal(checkUserChange([owner], { ...owner, role: 'manager' }), 'us_errOwner')
  assert.equal(checkUserChange([owner], cashier), null)
  assert.equal(checkUserChange([owner, cashier], { ...cashier, name: ' owner ' }), 'us_errDupName')

  const db = firmDb('users-' + Date.now())
  await seedFirm(db, 'retail')
  await assert.rejects(() => saveUser(db, 'f1', { name: 'Ali', role: 'cashier', active: true, pin: '1234' }), (e: unknown) => e instanceof UserError && e.key === 'us_errOwner')
  await assert.rejects(() => saveUser(db, 'f1', { name: 'Boss', role: 'owner', active: true, pin: '12' }), (e: unknown) => e instanceof UserError && e.key === 'us_errPin')
  const boss = await saveUser(db, 'f1', { name: 'Boss', role: 'owner', active: true, pin: '2468' })
  assert.equal(await checkPin('f1', boss, '2468'), true)
  assert.ok(!JSON.stringify(await db.users.toArray()).includes('2468'), 'the PIN itself is never stored')
  const ali = await saveUser(db, 'f1', { name: 'Ali', role: 'cashier', active: true, pin: '1357' })
  await assert.rejects(() => saveUser(db, 'f1', { id: boss.id, name: 'Boss', role: 'owner', active: false }), UserError)
  // editing without a PIN keeps the old one
  const renamed = await saveUser(db, 'f1', { id: ali.id, name: 'Ali Raza', role: 'cashier', active: true })
  assert.equal(renamed.pinHash, ali.pinHash)
  assert.ok((await db.audit.where('entity').equals('user').count()) >= 3)
})
