import { useMemo } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { partyPath } from '../../lib/paths'
import { partyWise, type PartyWiseRow } from '../../lib/reports'
import { RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** sales, purchases and payments per party for a period */
export default function PartyWise() {
  const { t } = useI18n()
  const data = useData()
  const { range, setRange, from, to } = useRange()
  const label = usePeriodLabel()
  const res = useMemo(() => partyWise(data, from, to), [data, from, to])
  const tt = res.totals
  const blank = (n: number) => n || undefined
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_netSales'), value: tt.sales - tt.saleReturns, kind: 'money', tone: 'brand' },
      { label: t('rp_netPurchases'), value: tt.purchases - tt.purchaseReturns, kind: 'money' },
      { label: t('rp_received'), value: tt.received, kind: 'money', tone: 'good' },
      { label: t('rp_paidOut'), value: tt.paid, kind: 'money', tone: 'bad' },
    ],
    sections: [section<PartyWiseRow>({
      cols: [
        { key: 'party', label: t('rp_party'), value: (r) => r.partyName || t('walkIn'), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
        { key: 'sales', label: t('la_sales'), kind: 'money', value: (r) => blank(r.sales) },
        { key: 'saleReturns', label: t('la_sales_return'), kind: 'money', value: (r) => blank(r.saleReturns) },
        { key: 'purchases', label: t('rp_purchases'), kind: 'money', value: (r) => blank(r.purchases) },
        { key: 'purchaseReturns', label: t('tp_purchase_return'), kind: 'money', value: (r) => blank(r.purchaseReturns) },
        { key: 'received', label: t('rp_received'), kind: 'money', value: (r) => blank(r.received) },
        { key: 'paid', label: t('rp_paidOut'), kind: 'money', value: (r) => blank(r.paid) },
      ],
      rows: res.rows,
      foot: { ...tt },
      empty: t('rp_noData'),
      rowKey: (r) => r.partyId || 'walkin',
      note: t('rp_inclTaxNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_partywise')}
      period={label.range(from, to)}
      fileName="party-wise"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
