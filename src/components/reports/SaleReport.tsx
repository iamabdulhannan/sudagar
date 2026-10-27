import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { invoiceRegister, type InvoiceRow } from '../../lib/reports'
import { PartyFilter, RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type Col, type ReportDoc } from './ReportTable'

/** sale register or purchase register for a period, with paid and open amounts */
export default function SaleReport({ type }: { type: 'sale' | 'purchase' }) {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const [party, setParty] = useState('')
  const label = usePeriodLabel()
  const res = useMemo(() => invoiceRegister(data, books, [type], from, to, party || undefined), [data, books, type, from, to, party])
  const showTax = data.settings.features.tax || res.totals.tax !== 0

  const cols: Col<InvoiceRow>[] = [
    { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
    { key: 'number', label: t('number'), value: (r) => r.number, href: (r) => txnPath(r.type, r.id) },
    { key: 'party', label: t('rp_party'), value: (r) => r.partyName || t('walkIn'), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
    ...(showTax ? [
      { key: 'net', label: t('rp_beforeTax'), kind: 'money', value: (r) => r.net },
      { key: 'tax', label: data.settings.taxLabel, kind: 'money', value: (r) => r.tax },
    ] as Col<InvoiceRow>[] : []),
    { key: 'total', label: t('total'), kind: 'money', value: (r) => r.total },
    { key: 'paid', label: t('paid'), kind: 'money', value: (r) => r.paid },
    { key: 'due', label: t('rp_balanceDue'), kind: 'money', value: (r) => r.due },
    { key: 'status', label: t('status'), value: (r) => t(r.status) },
  ]
  const tt = res.totals
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_invoices'), value: tt.count, kind: 'int' },
      { label: t('rp_totalAmount'), value: tt.total, kind: 'money', tone: 'brand' },
      { label: t('paid'), value: tt.paid, kind: 'money', tone: 'good' },
      { label: t('rp_balanceDue'), value: tt.due, kind: 'money', tone: tt.due > 0 ? 'warn' : 'neutral' },
    ],
    sections: [section({ cols, rows: res.rows, foot: { net: tt.net, tax: tt.tax, total: tt.total, paid: tt.paid, due: tt.due }, empty: t('rp_noData'), rowKey: (r) => r.id })],
  }
  return (
    <ReportShell
      title={t(type === 'sale' ? 'rp_sale' : 'rp_purchase')}
      period={label.range(from, to)}
      fileName={type === 'sale' ? 'sale-report' : 'purchase-report'}
      doc={doc}
      filters={<>
        <RangeFilter value={range} onChange={setRange} />
        <PartyFilter value={party} onChange={setParty} kind={type === 'sale' ? 'customer' : 'supplier'} />
      </>}
    />
  )
}
