import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { accountPath } from '../../lib/paths'
import { cashFlow, type AccountFlow, type FlowLine } from '../../lib/reports'
import { RangeFilter, ReportShell, typeLabel, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** money in and out of cash, bank and wallets for a period, by document type and by account */
export default function CashFlow() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const label = usePeriodLabel()
  const cf = useMemo(() => cashFlow(data, books, from, to), [data, books, from, to])
  const accName = (id: string) => data.accountById.get(id)?.name ?? id
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_openingCash'), value: cf.opening, kind: 'money' },
      { label: t('rp_moneyIn'), value: cf.moneyIn, kind: 'money', tone: 'good' },
      { label: t('rp_moneyOut'), value: cf.moneyOut, kind: 'money', tone: 'bad' },
      { label: t('rp_closingCash'), value: cf.closing, kind: 'money', tone: 'brand' },
    ],
    sections: [
      section<FlowLine>({
        title: t('rp_byType'),
        cols: [
          { key: 'type', label: t('type'), value: (r) => typeLabel(t, r.key) },
          { key: 'in', label: t('rp_moneyIn'), kind: 'money', value: (r) => r.moneyIn || undefined },
          { key: 'out', label: t('rp_moneyOut'), kind: 'money', value: (r) => r.moneyOut || undefined },
          { key: 'net', label: t('rp_net'), kind: 'money', value: (r) => round2(r.moneyIn - r.moneyOut), tone: true },
        ],
        rows: cf.byType,
        foot: { in: cf.moneyIn, out: cf.moneyOut, net: round2(cf.moneyIn - cf.moneyOut) },
        empty: t('rp_noData'),
        rowKey: (r) => r.key,
        note: t('rp_transferNote'),
      }),
      section<AccountFlow>({
        title: t('rp_byAccount'),
        cols: [
          { key: 'name', label: t('rp_account'), value: (r) => accName(r.accountId), href: (r) => accountPath(r.accountId) },
          { key: 'opening', label: t('opening'), kind: 'money', value: (r) => r.opening, tone: true },
          { key: 'in', label: t('rp_moneyIn'), kind: 'money', value: (r) => r.moneyIn },
          { key: 'out', label: t('rp_moneyOut'), kind: 'money', value: (r) => r.moneyOut },
          { key: 'closing', label: t('closing'), kind: 'money', value: (r) => r.closing, tone: true },
        ],
        rows: cf.accounts,
        foot: { opening: cf.opening, in: cf.moneyIn, out: cf.moneyOut, closing: cf.closing },
        rowKey: (r) => r.accountId,
      }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_cashflow')}
      period={label.range(from, to)}
      fileName="cash-flow"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
