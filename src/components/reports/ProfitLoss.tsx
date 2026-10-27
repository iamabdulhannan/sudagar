import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { acctName, profitLoss } from '../../lib/ledger'
import { pct } from '../../lib/reports'
import { RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'
import type { StmtRow } from './statement'

/** profit and loss for a period: sales, cost of goods, gross profit, expenses, net profit */
export default function ProfitLoss() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const label = usePeriodLabel()
  const pl = useMemo(() => profitLoss(books, from, to), [books, from, to])
  const names = { accounts: data.accounts, parties: data.parties, cats: data.moneyCategories }
  const share = (n: number) => pct(n, pl.netSales)
  const margin = share(pl.grossProfit)

  const rows: StmtRow[] = [
    { label: t('rp_income'), style: 'head' },
    { label: t('la_sales'), amount: pl.sales, share: share(pl.sales), style: 'indent' },
    { label: t('rp_lessReturns'), amount: -pl.salesReturn, share: share(-pl.salesReturn), style: 'indent' },
    { label: t('rp_netSales'), amount: pl.netSales, share: 100, style: 'total' },
    { label: t('la_cogs'), amount: -pl.cogs, share: share(-pl.cogs), style: 'indent' },
    { label: t('rp_grossProfit'), amount: pl.grossProfit, share: margin, style: 'total' },
  ]
  if (pl.otherIncome.length) {
    rows.push({ label: t('tp_other_income'), style: 'head' })
    for (const x of pl.otherIncome) rows.push({ label: acctName(x.acct, names, t), amount: x.amount, share: share(x.amount), style: 'indent' })
    rows.push({ label: t('rp_totalOtherIncome'), amount: pl.totalOtherIncome, share: share(pl.totalOtherIncome), style: 'total' })
  }
  rows.push({ label: t('tp_expense'), style: 'head' })
  for (const x of [...pl.expenses].sort((a, b) => b.amount - a.amount)) rows.push({ label: acctName(x.acct, names, t), amount: -x.amount, share: share(-x.amount), style: 'indent' })
  if (pl.purchaseServices) rows.push({ label: t('la_purchase_services'), amount: -pl.purchaseServices, share: share(-pl.purchaseServices), style: 'indent' })
  if (pl.stockAdjust) rows.push({ label: t('la_stock_adjust'), amount: -pl.stockAdjust, share: share(-pl.stockAdjust), style: 'indent' })
  rows.push({ label: t('rp_totalExpenses'), amount: -pl.totalExpenses, share: share(-pl.totalExpenses), style: 'total' })
  rows.push({ label: pl.netProfit < 0 ? t('rp_netLoss') : t('rp_netProfit'), amount: pl.netProfit, share: share(pl.netProfit), style: 'grand' })

  const doc: ReportDoc = {
    summary: [
      { label: t('rp_netSales'), value: pl.netSales, kind: 'money', tone: 'brand' },
      { label: t('rp_grossProfit'), value: pl.grossProfit, kind: 'money', tone: pl.grossProfit < 0 ? 'bad' : 'good' },
      { label: t('rp_grossMargin'), value: margin, kind: 'pct' },
      { label: pl.netProfit < 0 ? t('rp_netLoss') : t('rp_netProfit'), value: pl.netProfit, kind: 'money', tone: pl.netProfit < 0 ? 'bad' : 'good' },
    ],
    sections: [section<StmtRow>({
      cols: [
        { key: 'label', label: t('rp_particulars'), value: (r) => r.label },
        { key: 'amount', label: t('amount'), kind: 'money', value: (r) => r.amount, tone: true },
        { key: 'share', label: t('rp_ofSales'), kind: 'pct', value: (r) => (r.amount === undefined || !pl.netSales ? undefined : r.share) },
      ],
      rows,
      rowStyle: (r) => r.style,
      note: t('rp_plNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_pl')}
      period={label.range(from, to)}
      fileName="profit-and-loss"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
