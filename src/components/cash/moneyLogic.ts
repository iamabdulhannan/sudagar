import { round2 } from '../../lib/format'
import { blankTxn, calcTotals } from '../../lib/txn'
import type { Account, BinEntry, ChequeStatus, ID, Settings, Txn } from '../../lib/types'

/**
 * Pure helpers for cheques, loan accounts and the recycle bin (no React, tested in node).
 *
 * Loans are kept with plain transactions: borrowing is a transfer loan → bank, an instalment
 * is a transfer bank → loan, and its interest an expense under the "Loan interest" head.
 * The interest expense carries the loan account in `toAccountId` so it can be shown per loan.
 */

// ---------- cheques ----------

export type ChequeSide = 'received' | 'issued'

/** a payment in / out by cheque whose clearing is tracked */
export const isTrackedCheque = (t: Txn) =>
  (t.type === 'payment_in' || t.type === 'payment_out') && t.paymentMode === 'cheque' && !!t.chequeStatus && !t.cancelled

export const chequeSide = (t: Txn): ChequeSide => (t.type === 'payment_in' ? 'received' : 'issued')

/** whole days from one date to another ('YYYY-MM-DD') */
export function daysBetween(from: string, to: string): number {
  const p = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day) }
  return Math.round((p(to) - p(from)) / 86400000)
}

/** days since the cheque date (or the payment date) */
export const chequeAge = (t: Txn, todayStr: string) => Math.max(0, daysBetween(t.chequeDate || t.date, todayStr))

export interface ChequeTotals { inHand: number; inHandCount: number; issued: number; issuedCount: number }

/** open cheques: received and not yet deposited / cleared, and issued but not yet presented */
export function chequeTotals(txns: Txn[]): ChequeTotals {
  const r: ChequeTotals = { inHand: 0, inHandCount: 0, issued: 0, issuedCount: 0 }
  for (const t of txns) {
    if (!isTrackedCheque(t) || t.chequeStatus !== 'open') continue
    if (t.type === 'payment_in') { r.inHand += t.total; r.inHandCount++ } else { r.issued += t.total; r.issuedCount++ }
  }
  r.inHand = round2(r.inHand)
  r.issued = round2(r.issued)
  return r
}

/** cheques of one side and (optionally) one status, newest cheque date first */
export function chequeList(txns: Txn[], side: ChequeSide, status?: ChequeStatus): Txn[] {
  return txns
    .filter((t) => isTrackedCheque(t) && chequeSide(t) === side && (!status || t.chequeStatus === status))
    .sort((a, b) => {
      const da = a.chequeDate || a.date, db = b.chequeDate || b.date
      return da === db ? b.createdAt - a.createdAt : da < db ? 1 : -1
    })
}

// ---------- loans ----------

export interface LoanSummary {
  /** still owed (positive while money is owed) */
  owed: number
  /** borrowed: opening amount owed plus money received from the loan */
  taken: number
  /** principal paid back */
  repaid: number
  interest: number
}

export function loanSummary(acc: Account, txns: Txn[], balance: number): LoanSummary {
  let taken = Math.max(0, -acc.openingBalance), repaid = 0, interest = 0
  for (const t of txns) {
    if (t.cancelled) continue
    if (t.type === 'transfer' && t.accountId === acc.id) taken += t.total
    else if (t.type === 'transfer' && t.toAccountId === acc.id) repaid += t.total
    else if (t.type === 'expense' && t.toAccountId === acc.id) interest += t.total
  }
  return { owed: round2(-balance), taken: round2(taken), repaid: round2(repaid), interest: round2(interest) }
}

/** the opening balance field of a loan account: the user types the amount owed, it is stored negative */
export const loanOpening = (owed: number) => { const v = Math.abs(round2(owed || 0)); return v ? -v : 0 }

/** money received from a loan into a bank / cash account */
export function receiveLoanDraft(s: Settings, o: { loanId: ID; toAccountId: ID; amount: number; date: string; notes?: string }): Txn {
  return {
    ...blankTxn('transfer', s), accountId: o.loanId, toAccountId: o.toAccountId, total: round2(o.amount), subtotal: round2(o.amount),
    received: round2(o.amount), date: o.date, notes: o.notes, paymentMode: 'bank',
  }
}

export interface InstalmentInput {
  loanId: ID
  /** the bank / cash account paying */
  fromAccountId: ID
  principal: number
  interest: number
  /** expense head for the interest */
  interestHeadId?: ID
  date: string
  notes?: string
}

/** an instalment: principal as a transfer to the loan, interest as an expense (either may be 0) */
export function instalmentDrafts(s: Settings, o: InstalmentInput): Txn[] {
  const out: Txn[] = []
  if (o.principal > 0) {
    out.push({
      ...blankTxn('transfer', s), accountId: o.fromAccountId, toAccountId: o.loanId, total: round2(o.principal), subtotal: round2(o.principal),
      received: round2(o.principal), date: o.date, notes: o.notes, paymentMode: 'bank',
    })
  }
  if (o.interest > 0) {
    out.push(calcTotals({
      ...blankTxn('expense', s), accountId: o.fromAccountId, toAccountId: o.loanId, categoryId: o.interestHeadId,
      total: round2(o.interest), received: round2(o.interest), date: o.date, notes: o.notes, paymentMode: 'bank', dueDate: undefined,
    }, s))
  }
  return out
}

// ---------- recycle bin ----------

/** bin entries newest deleted first */
export const binSorted = (entries: BinEntry[]) => [...entries].sort((a, b) => b.deletedAt - a.deletedAt)
