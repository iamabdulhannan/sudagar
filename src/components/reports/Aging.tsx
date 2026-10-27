import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { aging, AGING_BUCKETS, type AgingBucket, type AgingItem, type AgingParty } from '../../lib/reports'
import { ChoiceFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type Col, type ReportDoc } from './ReportTable'

/** open invoices by age: 0-30, 31-60, 61-90 and over 90 days since the invoice date */
export default function Aging() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [side, setSide] = useState<'sale' | 'purchase'>('sale')
  const [view, setView] = useState<'party' | 'invoice'>('party')
  const asOf = today()
  const label = usePeriodLabel()
  const res = useMemo(() => aging(data, books, side, asOf), [data, books, side, asOf])
  const bl = (b: AgingBucket) => t('rp_' + b)
  const party = (name: string, id: string) => name || (id ? '' : t('walkIn'))

  const partyCols: Col<AgingParty>[] = [
    { key: 'party', label: t('rp_party'), value: (r) => party(r.partyName, r.partyId), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
    { key: 'count', label: t('rp_invoices'), kind: 'int', value: (r) => r.count },
    ...AGING_BUCKETS.map((b): Col<AgingParty> => ({ key: b, label: bl(b), kind: 'money', value: (r) => r[b] || undefined })),
    { key: 'total', label: t('total'), kind: 'money', value: (r) => r.total },
  ]
  const itemCols: Col<AgingItem>[] = [
    { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
    { key: 'number', label: t('number'), value: (r) => r.number ?? t('rp_openingBalance'), href: (r) => (r.txnId && r.type ? txnPath(r.type, r.txnId) : undefined) },
    { key: 'party', label: t('rp_party'), value: (r) => party(r.partyName, r.partyId), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
    { key: 'dueDate', label: t('rp_dueDate'), kind: 'date', value: (r) => r.dueDate },
    { key: 'days', label: t('rp_days'), kind: 'int', value: (r) => r.days },
    { key: 'bucket', label: t('rp_ageGroup'), value: (r) => bl(r.bucket) },
    { key: 'amount', label: t('rp_balanceDue'), kind: 'money', value: (r) => r.amount },
  ]
  const tt = res.totals
  const doc: ReportDoc = {
    summary: [
      ...AGING_BUCKETS.map((b) => ({ label: bl(b), value: tt[b], kind: 'money' as const, tone: b === 'b90' && tt[b] > 0 ? 'bad' as const : 'neutral' as const })),
    ],
    sections: [view === 'party'
      ? section({ cols: partyCols, rows: res.parties, foot: { count: tt.count, b0: tt.b0, b30: tt.b30, b60: tt.b60, b90: tt.b90, total: tt.total }, empty: t('rp_nothingDue'), rowKey: (r) => r.partyId })
      : section({ cols: itemCols, rows: res.items, foot: { amount: tt.total }, empty: t('rp_nothingDue'), rowKey: (r, i) => r.txnId ?? `o${i}` }),
    ],
  }
  doc.sections[0].note = t('rp_agingNote')
  return (
    <ReportShell
      title={`${t('rp_aging')}: ${t(side === 'sale' ? 'receivable' : 'payable')}`}
      period={label.asOf(asOf)}
      fileName={side === 'sale' ? 'receivables-aging' : 'payables-aging'}
      doc={doc}
      filters={<>
        <ChoiceFilter label={t('type')} value={side} onChange={setSide} options={[['sale', t('receivable')], ['purchase', t('payable')]]} />
        <ChoiceFilter label={t('rp_view')} value={view} onChange={setView} options={[['party', t('rp_byParty')], ['invoice', t('rp_byInvoice')]]} />
      </>}
    />
  )
}
