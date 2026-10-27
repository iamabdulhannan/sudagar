import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { partyPath } from '../../lib/paths'
import { partyBalances, type PartyBalanceRow } from '../../lib/reports'
import { CheckFilter, ChoiceFilter, DateFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

type Kind = '' | 'customer' | 'supplier'

/** what every party owes us or we owe them, as of a date */
export default function PartyBalances() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [asOf, setAsOf] = useState(today())
  const [kind, setKind] = useState<Kind>('')
  const [hideZero, setHideZero] = useState(true)
  const label = usePeriodLabel()
  const res = useMemo(() => partyBalances(data, books, asOf), [data, books, asOf])
  const rows = res.rows
    .filter((r) => !kind || r.kind === kind || r.kind === 'both')
    .filter((r) => !hideZero || r.balance !== 0)
    .sort((a, b) => b.balance - a.balance)
  const receivable = rows.reduce((a, r) => a + r.receivable, 0)
  const payable = rows.reduce((a, r) => a + r.payable, 0)
  const doc: ReportDoc = {
    summary: [
      { label: t('receivable'), value: receivable, kind: 'money', tone: 'good' },
      { label: t('payable'), value: payable, kind: 'money', tone: 'bad' },
      { label: t('rp_net'), value: receivable - payable, kind: 'money', tone: 'brand' },
      { label: t('rp_parties'), value: rows.length, kind: 'int' },
    ],
    sections: [section<PartyBalanceRow>({
      cols: [
        { key: 'name', label: t('rp_party'), value: (r) => r.name, href: (r) => partyPath(r.partyId) },
        { key: 'phone', label: t('phone'), value: (r) => r.phone ?? '', className: 'num' },
        { key: 'kind', label: t('type'), value: (r) => t('rp_kind_' + r.kind) },
        { key: 'receivable', label: t('receivable'), kind: 'money', value: (r) => r.receivable || undefined },
        { key: 'payable', label: t('payable'), kind: 'money', value: (r) => r.payable || undefined },
      ],
      rows,
      foot: { receivable, payable },
      empty: t('rp_noData'),
      rowKey: (r) => r.partyId,
      note: res.walkin ? t('rp_walkinNote', { amount: fmtMoney(res.walkin, data.firm.currencySymbol) }) : undefined,
    })],
  }
  return (
    <ReportShell
      title={t('rp_partybalances')}
      period={label.asOf(asOf)}
      fileName="party-balances"
      doc={doc}
      filters={<>
        <DateFilter value={asOf} onChange={setAsOf} />
        <ChoiceFilter label={t('type')} value={kind} onChange={setKind} options={[['', t('all')], ['customer', t('rp_customers')], ['supplier', t('rp_suppliers')]]} />
        <CheckFilter label={t('rp_hideZero')} checked={hideZero} onChange={setHideZero} />
      </>}
    />
  )
}
