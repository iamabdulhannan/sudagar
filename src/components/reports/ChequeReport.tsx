import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import { partyPath, txnPath } from '../../lib/paths'
import { chequeRegister, type ChequeRow } from '../../lib/reports'
import { DateFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type Col, type ReportDoc } from './ReportTable'

/** cheques received and issued that have not cleared yet, with their age */
export default function ChequeReport() {
  const { t } = useI18n()
  const data = useData()
  const [asOf, setAsOf] = useState(today())
  const label = usePeriodLabel()
  const res = useMemo(() => chequeRegister(data, asOf), [data, asOf])
  const acc = (id?: string) => (id ? data.accountById.get(id)?.name : undefined)

  const cols = (side: 'in' | 'out'): Col<ChequeRow>[] => [
    { key: 'date', label: side === 'in' ? t('rp_chqReceived') : t('rp_chqIssuedOn'), kind: 'date', value: (r) => r.date },
    { key: 'number', label: t('number'), value: (r) => r.number || '-', href: (r) => txnPath(r.type, r.id), sub: (r) => (r.refNo ? t('rp_chqNo', { no: r.refNo }) : undefined) },
    { key: 'party', label: t('rp_party'), value: (r) => r.partyName || '-', href: (r) => (r.partyId ? partyPath(r.partyId) : undefined) },
    { key: 'chequeDate', label: t('rp_chqDate'), kind: 'date', value: (r) => r.chequeDate, sub: (r) => dueText(r) },
    { key: 'account', label: side === 'in' ? t('rp_chqDepositTo') : t('rp_chqFrom'), value: (r) => acc(r.accountId) ?? '-' },
    { key: 'days', label: t('rp_chqAge'), kind: 'int', value: (r) => r.days },
    { key: 'amount', label: t('amount'), kind: 'money', value: (r) => r.amount },
  ]
  const dueText = (r: ChequeRow) => r.dueIn === undefined ? undefined : r.dueIn > 0 ? t('rp_chqDueIn', { n: r.dueIn }) : r.dueIn === 0 ? t('today') : t('rp_chqDueSince', { n: -r.dueIn })

  const doc: ReportDoc = {
    summary: [
      { label: t('la_cheques_in'), value: res.totals.inHand, kind: 'money', tone: 'good' },
      { label: t('rp_chqCountIn'), value: res.totals.countIn, kind: 'int' },
      { label: t('la_cheques_out'), value: res.totals.issued, kind: 'money', tone: 'bad' },
      { label: t('rp_chqCountOut'), value: res.totals.countOut, kind: 'int' },
    ],
    sections: [
      section<ChequeRow>({ title: t('la_cheques_in'), cols: cols('in'), rows: res.inHand, foot: { amount: res.totals.inHand }, empty: t('rp_chqNone'), rowKey: (r) => r.id }),
      section<ChequeRow>({ title: t('la_cheques_out'), cols: cols('out'), rows: res.issued, foot: { amount: res.totals.issued }, empty: t('rp_chqNone'), rowKey: (r) => r.id, note: t('rp_chqNote') }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_cheques')}
      period={label.asOf(asOf)}
      fileName="open-cheques"
      doc={doc}
      filters={<DateFilter value={asOf} onChange={setAsOf} />}
    />
  )
}
