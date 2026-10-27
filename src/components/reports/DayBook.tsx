import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { dayBook, type TxnRow } from '../../lib/reports'
import { DateFilter, ReportShell, typeLabel, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** every transaction of one day with the money it moved, plus opening and closing cash and bank */
export default function DayBook() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [date, setDate] = useState(today())
  const label = usePeriodLabel()
  const res = useMemo(() => dayBook(data, books, date), [data, books, date])
  const tt = res.totals
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_openingCash'), value: res.opening, kind: 'money' },
      { label: t('rp_moneyIn'), value: tt.moneyIn, kind: 'money', tone: 'good' },
      { label: t('rp_moneyOut'), value: tt.moneyOut, kind: 'money', tone: 'bad' },
      { label: t('rp_closingCash'), value: res.closing, kind: 'money', tone: 'brand' },
    ],
    sections: [section<TxnRow>({
      cols: [
        { key: 'number', label: t('number'), value: (r) => r.number || '-', href: (r) => txnPath(r.type, r.id) },
        { key: 'type', label: t('type'), value: (r) => typeLabel(t, r.type) },
        { key: 'party', label: t('rp_party'), value: (r) => r.partyName || (r.partyId ? '' : '-'), href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
        { key: 'total', label: t('amount'), kind: 'money', value: (r) => r.total },
        { key: 'in', label: t('rp_moneyIn'), kind: 'money', value: (r) => r.moneyIn || undefined },
        { key: 'out', label: t('rp_moneyOut'), kind: 'money', value: (r) => r.moneyOut || undefined },
      ],
      rows: res.rows,
      foot: { in: tt.moneyIn, out: tt.moneyOut },
      empty: t('rp_noTxnsDay'),
      rowKey: (r) => r.id,
    })],
  }
  return (
    <ReportShell
      title={t('rp_daybook')}
      period={label.range(date, date)}
      fileName={`day-book-${date}`}
      doc={doc}
      filters={<DateFilter label={t('date')} value={date} onChange={setDate} />}
    />
  )
}
