import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { txnRegister, type TxnRow } from '../../lib/reports'
import { TXN_META } from '../../lib/txn'
import type { TxnType } from '../../lib/types'
import { ChoiceFilter, RangeFilter, ReportShell, typeLabel, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** all transactions of a period, optionally of one type */
export default function AllTxns() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const [type, setType] = useState<TxnType | ''>('')
  const label = usePeriodLabel()
  const res = useMemo(() => txnRegister(data, books, from, to, type || undefined), [data, books, from, to, type])
  const tt = res.totals
  const types = Object.keys(TXN_META) as TxnType[]
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_txnCount'), value: tt.count, kind: 'int' },
      ...(type ? [{ label: t('rp_totalAmount'), value: tt.total, kind: 'money' as const, tone: 'brand' as const }] : []),
      { label: t('rp_moneyIn'), value: tt.moneyIn, kind: 'money', tone: 'good' },
      { label: t('rp_moneyOut'), value: tt.moneyOut, kind: 'money', tone: 'bad' },
    ],
    sections: [section<TxnRow>({
      cols: [
        { key: 'date', label: t('date'), kind: 'date', value: (r) => r.date },
        { key: 'number', label: t('number'), value: (r) => r.number || '-', href: (r) => txnPath(r.type, r.id) },
        { key: 'type', label: t('type'), value: (r) => typeLabel(t, r.type) },
        { key: 'party', label: t('rp_party'), value: (r) => r.partyName || '-', href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
        { key: 'total', label: t('amount'), kind: 'money', value: (r) => r.total },
        { key: 'in', label: t('rp_moneyIn'), kind: 'money', value: (r) => r.moneyIn || undefined },
        { key: 'out', label: t('rp_moneyOut'), kind: 'money', value: (r) => r.moneyOut || undefined },
        { key: 'due', label: t('rp_balanceDue'), kind: 'money', value: (r) => r.due || undefined },
      ],
      rows: res.rows,
      foot: { ...(type ? { total: tt.total } : {}), in: tt.moneyIn, out: tt.moneyOut },
      empty: t('rp_noData'),
      rowKey: (r) => r.id,
    })],
  }
  return (
    <ReportShell
      title={t('rp_alltxns')}
      period={label.range(from, to)}
      fileName="all-transactions"
      doc={doc}
      filters={<>
        <RangeFilter value={range} onChange={setRange} />
        <ChoiceFilter label={t('type')} value={type} onChange={setType} options={[['', t('all')], ...types.map((k) => [k, t(TXN_META[k].label)] as [TxnType, string])]} />
      </>}
    />
  )
}
