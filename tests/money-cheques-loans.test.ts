import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { defaultSettings, firmDb, seedFirm } from '../src/lib/db'
import { balanceSheet, computeBooks } from '../src/lib/ledger'
import { blankTxn, saveTxn, setChequeStatus } from '../src/lib/txn'
import type { Account, Party, Txn } from '../src/lib/types'
import {
  binSorted, chequeAge, chequeList, chequeTotals, daysBetween, instalmentDrafts, isTrackedCheque, loanOpening, loanSummary, receiveLoanDraft,
} from '../src/components/cash/moneyLogic'

const s = defaultSettings('retail')
const acc = (id: string, kind: Account['kind'], opening = 0): Account => ({ id, kind, name: id, openingBalance: opening, openingDate: '2026-01-01', active: true, createdAt: 0 })
const ali: Party = { id: 'ali', name: 'Ali', kind: 'customer', openingBalance: 5000, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }

let clock = 1
const pay = (type: 'payment_in' | 'payment_out', over: Partial<Txn>): Txn => ({
  ...blankTxn(type, s), partyId: 'ali', accountId: 'bank', paymentMode: 'cheque', chequeStatus: 'open', total: 1000, received: 1000, createdAt: clock++, ...over,
})

test('dates and cheque age', () => {
  assert.equal(daysBetween('2026-01-30', '2026-03-01'), 30)
  assert.equal(daysBetween('2026-03-01', '2026-03-01'), 0)
  assert.equal(chequeAge(pay('payment_in', { date: '2026-03-01', chequeDate: '2026-03-05' }), '2026-03-10'), 5)
  // post-dated: never negative
  assert.equal(chequeAge(pay('payment_in', { date: '2026-03-01', chequeDate: '2026-04-01' }), '2026-03-10'), 0)
})

test('cheque totals and lists by side and status', () => {
  const list = [
    pay('payment_in', { id: 'a', total: 1000, chequeDate: '2026-03-01' }),
    pay('payment_in', { id: 'b', total: 500, chequeDate: '2026-03-05' }),
    pay('payment_in', { id: 'c', total: 700, chequeStatus: 'cleared', clearedOn: '2026-03-06' }),
    pay('payment_out', { id: 'd', total: 300 }),
    pay('payment_out', { id: 'e', total: 900, chequeStatus: 'bounced' }),
    pay('payment_in', { id: 'f', total: 999, cancelled: true }),
    pay('payment_in', { id: 'g', total: 111, paymentMode: 'cash', chequeStatus: undefined }),
  ]
  assert.deepEqual(chequeTotals(list), { inHand: 1500, inHandCount: 2, issued: 300, issuedCount: 1 })
  assert.deepEqual(chequeList(list, 'received', 'open').map((x) => x.id), ['b', 'a'])
  assert.deepEqual(chequeList(list, 'received').map((x) => x.id).sort(), ['a', 'b', 'c'])
  assert.deepEqual(chequeList(list, 'issued', 'bounced').map((x) => x.id), ['e'])
  assert.equal(isTrackedCheque(list[6]), false)
})

test('loan drafts and summary', () => {
  const loan = acc('loan', 'loan', loanOpening(200000))
  assert.equal(loan.openingBalance, -200000)
  assert.equal(loanOpening(0), 0)
  const get = receiveLoanDraft(s, { loanId: 'loan', toAccountId: 'bank', amount: 50000, date: '2026-02-01' })
  assert.equal(get.type, 'transfer')
  assert.equal(get.accountId, 'loan')
  assert.equal(get.toAccountId, 'bank')
  const [principal, interest] = instalmentDrafts(s, { loanId: 'loan', fromAccountId: 'bank', principal: 20000, interest: 3500, interestHeadId: 'int', date: '2026-03-01' })
  assert.equal(principal.type, 'transfer')
  assert.equal(principal.toAccountId, 'loan')
  assert.equal(interest.type, 'expense')
  assert.equal(interest.total, 3500)
  assert.equal(interest.received, 3500)
  assert.equal(interest.categoryId, 'int')
  assert.equal(interest.toAccountId, 'loan')
  assert.equal(instalmentDrafts(s, { loanId: 'loan', fromAccountId: 'bank', principal: 0, interest: 100, date: '2026-03-01' }).length, 1)

  const txns = [get, principal, interest].map((t, i) => ({ ...t, createdAt: i + 1 }))
  const books = computeBooks({ items: [], parties: [], accounts: [acc('bank', 'bank'), loan], txns, adjustments: [] })
  const bal = books.balances.get('acc:loan') ?? 0
  assert.equal(bal, -230000)
  assert.deepEqual(loanSummary(loan, txns, bal), { owed: 230000, taken: 250000, repaid: 20000, interest: 3500 })
  const bs = balanceSheet(books)
  assert.deepEqual(bs.loans, [{ acct: 'acc:loan', amount: 230000 }])
  assert.equal(bs.cashBank.find((x) => x.acct === 'acc:loan'), undefined)
  assert.equal(bs.totalAssets, bs.totalLiabilities)
})

test('cheque in hand clears into the bank, a bounced one restores the party balance', async () => {
  const id = 'chq-' + Date.now()
  const db = firmDb(id)
  await seedFirm(db, 'retail')
  await db.accounts.bulkPut([acc('bank', 'bank')])
  await db.parties.put(ali)
  const saved = await saveTxn(db, pay('payment_in', { date: '2026-03-01', total: 2000, received: 2000 }))
  const books = async () => computeBooks({ items: [], parties: [ali], accounts: await db.accounts.toArray(), txns: await db.txns.toArray(), adjustments: [] })

  let b = await books()
  assert.equal(b.balances.get('cheques_in'), 2000)
  assert.equal(b.balances.get('acc:bank') ?? 0, 0)
  assert.equal(b.balances.get('party:ali'), 3000)

  await setChequeStatus(db, saved, 'cleared', '2026-03-04', 'bank')
  b = await books()
  assert.equal(b.balances.get('cheques_in') ?? 0, 0)
  assert.equal(b.balances.get('acc:bank'), 2000)

  await setChequeStatus(db, (await db.txns.get(saved.id))!, 'bounced')
  b = await books()
  assert.equal(b.balances.get('acc:bank') ?? 0, 0)
  assert.equal(b.balances.get('party:ali'), 5000)

  // an instalment saves its two entries together
  await db.accounts.put(acc('loan', 'loan', -10000))
  await db.transaction('rw', [db.txns, db.settings, db.audit], async () => {
    for (const d of instalmentDrafts((await db.settings.get('settings'))!, { loanId: 'loan', fromAccountId: 'bank', principal: 1000, interest: 200, date: '2026-03-10' })) await saveTxn(db, d)
  })
  const all = await db.txns.toArray()
  assert.equal(all.filter((t) => t.toAccountId === 'loan').length, 2)
  db.close()
})

test('bin entries newest first', () => {
  const e = (id: string, at: number) => ({ id, deletedAt: at, txn: { ...blankTxn('sale', s), id } })
  assert.deepEqual(binSorted([e('a', 1), e('b', 3), e('c', 2)]).map((x) => x.id), ['b', 'c', 'a'])
})
