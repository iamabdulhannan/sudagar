import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtMoney, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { acctName, classOf, trialBalance, type AcctClass } from '../../lib/ledger'
import { accountPath, partyPath } from '../../lib/paths'
import { DateFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

interface Row { acct: string; name: string; cls: AcctClass; debit: number; credit: number }

const ORDER: AcctClass[] = ['asset', 'liability', 'equity', 'income', 'expense']

/** every ledger account with its debit or credit balance; the two totals must match */
export default function TrialBalance() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [asOf, setAsOf] = useState(today())
  const label = usePeriodLabel()
  const tb = useMemo(() => trialBalance(books, asOf), [books, asOf])
  const names = { accounts: data.accounts, parties: data.parties, cats: data.moneyCategories }
  const rows: Row[] = tb.rows
    .map((r) => ({ ...r, name: acctName(r.acct, names, t), cls: classOf(r.acct, r.debit - r.credit) }))
    .sort((a, b) => ORDER.indexOf(a.cls) - ORDER.indexOf(b.cls) || a.name.localeCompare(b.name))
  const diff = round2(tb.debit - tb.credit)
  const href = (acct: string) => {
    const [k, id] = acct.split(':')
    if (k === 'acc') return accountPath(id)
    if (k === 'party' && id !== 'walkin') return partyPath(id)
    return undefined
  }
  const doc: ReportDoc = {
    summary: [
      { label: t('debit'), value: tb.debit, kind: 'money' },
      { label: t('credit'), value: tb.credit, kind: 'money' },
      { label: t('rp_check'), value: diff === 0 ? t('rp_balanced') : t('rp_difference', { amount: fmtMoney(diff, data.firm.currencySymbol) }), tone: diff === 0 ? 'good' : 'bad' },
      { label: t('rp_accounts'), value: rows.length, kind: 'int' },
    ],
    sections: [section<Row>({
      cols: [
        { key: 'name', label: t('rp_account'), value: (r) => r.name, href: (r) => href(r.acct) },
        { key: 'cls', label: t('rp_group'), value: (r) => t('rp_cls_' + r.cls) },
        { key: 'debit', label: t('debit'), kind: 'money', value: (r) => r.debit || undefined },
        { key: 'credit', label: t('credit'), kind: 'money', value: (r) => r.credit || undefined },
      ],
      rows,
      foot: { debit: tb.debit, credit: tb.credit },
      empty: t('rp_noData'),
      rowKey: (r) => r.acct,
    })],
  }
  return (
    <ReportShell
      title={t('rp_tb')}
      period={label.asOf(asOf)}
      fileName="trial-balance"
      doc={doc}
      filters={<DateFilter value={asOf} onChange={setAsOf} />}
    />
  )
}
