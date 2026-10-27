import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { accountPath } from '../../lib/paths'
import { loanReport, type LoanRow } from '../../lib/reports'
import { RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** what is owed on each loan account: at the start, borrowed, repaid, still owed */
export default function LoanReport() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange('all')
  const label = usePeriodLabel()
  const res = useMemo(() => loanReport(data, books, from, to), [data, books, from, to])
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_loanOwed'), value: res.totals.owed, kind: 'money', tone: 'bad' },
      { label: t('rp_loanBorrowed'), value: res.totals.borrowed, kind: 'money' },
      { label: t('rp_loanRepaid'), value: res.totals.repaid, kind: 'money', tone: 'good' },
      { label: t('rp_loanInterest'), value: res.interest, kind: 'money' },
    ],
    sections: [
      section<LoanRow>({
        cols: [
          { key: 'name', label: t('rp_account'), value: (r) => r.name, href: (r) => accountPath(r.accountId), sub: (r) => r.bankName },
          { key: 'opening', label: t('rp_loanOpening'), kind: 'money', value: (r) => r.opening },
          { key: 'borrowed', label: t('rp_loanBorrowed'), kind: 'money', value: (r) => r.borrowed },
          { key: 'repaid', label: t('rp_loanRepaid'), kind: 'money', value: (r) => r.repaid },
          { key: 'owed', label: t('rp_loanOwed'), kind: 'money', value: (r) => r.owed, tone: true },
        ],
        rows: res.rows,
        foot: { opening: res.totals.opening, borrowed: res.totals.borrowed, repaid: res.totals.repaid, owed: res.totals.owed },
        empty: t('rp_loanNone'),
        rowKey: (r) => r.accountId,
        note: t('rp_loanNote'),
      }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_loans')}
      period={label.range(from, to)}
      fileName="loans"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
