import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import { itemProfit, pct, type ItemProfitRow } from '../../lib/reports'
import { CategoryFilter, RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** quantity sold, sales, cost and profit per item for a period */
export default function ItemProfit() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { range, setRange, from, to } = useRange()
  const [cat, setCat] = useState('')
  const label = usePeriodLabel()
  const res = useMemo(() => itemProfit(data, books, from, to), [data, books, from, to])
  const rows: ItemProfitRow[] = res.rows.filter((r) => !cat || r.categoryId === cat)
  // free-text lines and deleted items, so the totals still match the P&L
  if (!cat && (res.other.sales || res.other.cost)) {
    rows.push({ itemId: '', name: t('rp_otherLines'), unit: '', qty: 0, sales: res.other.sales, cost: res.other.cost, profit: res.other.profit, margin: pct(res.other.profit, res.other.sales) })
  }
  const sales = cat ? rows.reduce((a, r) => a + r.sales, 0) : res.totals.sales
  const cost = cat ? rows.reduce((a, r) => a + r.cost, 0) : res.totals.cost
  const profit = cat ? rows.reduce((a, r) => a + r.profit, 0) : res.totals.profit
  const margin = pct(profit, sales)
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_salesNet'), value: sales, kind: 'money' },
      { label: t('rp_cost'), value: cost, kind: 'money' },
      { label: t('rp_profit'), value: profit, kind: 'money', tone: profit < 0 ? 'bad' : 'good' },
      { label: t('rp_margin'), value: margin, kind: 'pct' },
    ],
    sections: [section<ItemProfitRow>({
      cols: [
        { key: 'name', label: t('rp_item'), value: (r) => r.name, href: (r) => (r.itemId ? itemPath(r.itemId) : undefined) },
        { key: 'qty', label: t('rp_qtySold'), kind: 'qty', value: (r) => (r.itemId ? r.qty : undefined), sub: (r) => r.unit || undefined },
        { key: 'sales', label: t('rp_salesNet'), kind: 'money', value: (r) => r.sales, tone: true },
        { key: 'cost', label: t('rp_cost'), kind: 'money', value: (r) => r.cost, tone: true },
        { key: 'profit', label: t('rp_profit'), kind: 'money', value: (r) => r.profit, tone: true },
        { key: 'margin', label: t('rp_margin'), kind: 'pct', value: (r) => r.margin, tone: true },
      ],
      rows,
      foot: { sales, cost, profit, margin },
      rowStyle: (r) => (r.itemId ? undefined : 'muted'),
      empty: t('rp_noData'),
      rowKey: (r) => r.itemId || 'other',
      note: t('rp_itemProfitNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_itemprofit')}
      period={label.range(from, to)}
      fileName="item-wise-profit"
      doc={doc}
      filters={<>
        <RangeFilter value={range} onChange={setRange} />
        <CategoryFilter value={cat} onChange={setCat} />
      </>}
    />
  )
}
