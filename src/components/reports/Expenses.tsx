import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { acctName } from '../../lib/ledger'
import { partyPath, txnPath } from '../../lib/paths'
import { expenseReport, partyNameOf, type ExpenseHead } from '../../lib/reports'
import type { Txn } from '../../lib/types'
import { RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** expenses by head for a period with each head's share, and the list of expense vouchers */
export default function Expenses() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const label = usePeriodLabel()
  const res = useMemo(() => expenseReport(data, books, from, to), [data, books, from, to])
  const names = { accounts: data.accounts, parties: data.parties, cats: data.moneyCategories }
  const head = (acct: string) => acctName(acct, names, t)
  const top = res.heads[0]
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_totalExpenses'), value: res.total, kind: 'money', tone: 'bad' },
      { label: t('rp_vouchers'), value: res.txns.length, kind: 'int' },
      { label: t('rp_heads'), value: res.heads.length, kind: 'int' },
      ...(top ? [{ label: t('rp_biggest', { name: head(top.acct) }), value: top.amount, kind: 'money' as const }] : []),
    ],
    sections: [
      section<ExpenseHead>({
        title: t('rp_byHead'),
        cols: [
          { key: 'head', label: t('rp_head'), value: (r) => head(r.acct) },
          { key: 'count', label: t('rp_vouchers'), kind: 'int', value: (r) => r.count },
          { key: 'amount', label: t('amount'), kind: 'money', value: (r) => r.amount },
          { key: 'share', label: t('rp_share'), kind: 'pct', value: (r) => r.share },
        ],
        rows: res.heads,
        foot: { count: res.txns.length, amount: res.total, share: res.total ? 100 : 0 },
        empty: t('rp_noData'),
        rowKey: (r) => r.acct,
      }),
      section<Txn>({
        title: t('tp_expense'),
        cols: [
          { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
          { key: 'number', label: t('number'), value: (r) => r.number || '-', href: (r) => txnPath(r.type, r.id) },
          { key: 'head', label: t('rp_head'), value: (r) => head(`exp:${r.categoryId ?? 'other'}`), sub: (r) => r.notes },
          { key: 'party', label: t('rp_party'), value: (r) => partyNameOf(data, r, data.partyById) || '-', href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
          { key: 'amount', label: t('amount'), kind: 'money', value: (r) => r.total },
        ],
        rows: res.txns,
        foot: { amount: res.total },
        empty: t('rp_noData'),
        rowKey: (r) => r.id,
      }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_expenses')}
      period={label.range(from, to)}
      fileName="expenses"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
