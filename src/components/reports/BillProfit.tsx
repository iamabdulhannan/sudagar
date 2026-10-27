import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { billProfit, type BillProfitRow } from '../../lib/reports'
import { CheckFilter, RangeFilter, ReportShell, typeLabel, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** profit on each sale invoice: sale (net of tax) minus the cost of the goods sold */
export default function BillProfit() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const [returns, setReturns] = useState(true)
  const label = usePeriodLabel()
  const res = useMemo(() => billProfit(data, books, from, to, returns), [data, books, from, to, returns])
  const tt = res.totals
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_salesNet'), value: tt.sales, kind: 'money' },
      { label: t('rp_cost'), value: tt.cost, kind: 'money' },
      { label: t('rp_profit'), value: tt.profit, kind: 'money', tone: tt.profit < 0 ? 'bad' : 'good' },
      { label: t('rp_margin'), value: tt.margin, kind: 'pct' },
    ],
    sections: [section<BillProfitRow>({
      cols: [
        { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
        { key: 'number', label: t('number'), value: (r) => r.number, href: (r) => txnPath(r.type, r.id), sub: (r) => (r.type === 'sale' ? undefined : typeLabel(t, r.type)) },
        { key: 'party', label: t('rp_party'), value: (r) => r.partyName || t('walkIn'), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
        { key: 'sales', label: t('rp_salesNet'), kind: 'money', value: (r) => r.sales, tone: true },
        { key: 'cost', label: t('rp_cost'), kind: 'money', value: (r) => r.cost, tone: true },
        { key: 'profit', label: t('rp_profit'), kind: 'money', value: (r) => r.profit, tone: true },
        { key: 'margin', label: t('rp_margin'), kind: 'pct', value: (r) => r.margin, tone: true },
      ],
      rows: res.rows,
      foot: { sales: tt.sales, cost: tt.cost, profit: tt.profit, margin: tt.margin },
      empty: t('rp_noData'),
      rowKey: (r) => r.id,
      note: t('rp_billProfitNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_billprofit')}
      period={label.range(from, to)}
      fileName="bill-wise-profit"
      doc={doc}
      filters={<>
        <RangeFilter value={range} onChange={setRange} />
        <CheckFilter label={t('rp_withReturns')} checked={returns} onChange={setReturns} />
      </>}
    />
  )
}
