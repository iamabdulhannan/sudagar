import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { reportPath, txnPath } from '../../lib/paths'
import { capitalAccount, type CapitalEntry } from '../../lib/reports'
import { typeLabel, RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'
import type { StmtRow } from './statement'

/** the owner's account: at the start, opening capital, capital added, profit, less drawings */
export default function CapitalAccount() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange('year')
  const label = usePeriodLabel()
  const c = useMemo(() => capitalAccount(data, books, from, to), [data, books, from, to])
  const rows: StmtRow[] = [
    ...(from ? [{ label: t('rp_capStart'), amount: c.start, style: 'total' as const }] : []),
    ...(c.openingCapital ? [{ label: t('la_opening_equity'), amount: c.openingCapital, style: 'indent' as const }] : []),
    { label: t('la_capital'), amount: c.added, style: 'indent' },
    { label: c.profit < 0 ? t('rp_netLoss') : t('rp_netProfit'), amount: c.profit, style: 'indent', href: reportPath('pl') },
    { label: t('rp_lessDrawings'), amount: -c.drawings, style: 'indent' },
    { label: t('rp_capClosing'), amount: c.closing, style: 'grand', href: reportPath('bs') },
  ]
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_capClosing'), value: c.closing, kind: 'money', tone: 'brand' },
      { label: t('la_capital'), value: c.added, kind: 'money', tone: 'good' },
      { label: t('la_drawings'), value: c.drawings, kind: 'money', tone: 'bad' },
      { label: c.profit < 0 ? t('rp_netLoss') : t('rp_netProfit'), value: c.profit, kind: 'money', tone: c.profit < 0 ? 'bad' : 'good' },
    ],
    sections: [
      section<StmtRow>({
        cols: [
          { key: 'label', label: t('rp_particulars'), value: (r) => r.label, href: (r) => r.href },
          { key: 'amount', label: t('amount'), kind: 'money', value: (r) => r.amount, tone: true },
        ],
        rows,
        rowStyle: (r) => r.style,
        note: t('rp_capNote'),
      }),
      section<CapitalEntry>({
        title: t('rp_capEntries'),
        cols: [
          { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
          { key: 'number', label: t('number'), value: (r) => r.number || '-', href: (r) => txnPath(r.type, r.id) },
          { key: 'type', label: t('type'), value: (r) => typeLabel(t, r.type), sub: (r) => r.note },
          { key: 'in', label: t('la_capital'), kind: 'money', value: (r) => (r.type === 'capital_in' ? r.amount : undefined) },
          { key: 'out', label: t('la_drawings'), kind: 'money', value: (r) => (r.type === 'drawing' ? r.amount : undefined) },
        ],
        rows: c.entries,
        foot: { in: c.added, out: c.drawings },
        empty: t('rp_noData'),
        rowKey: (r) => r.id,
      }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_capital')}
      period={label.range(from, to)}
      fileName="capital-account"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
