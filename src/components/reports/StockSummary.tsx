import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import { stockAsOf, stockSummary, type StockRow } from '../../lib/reports'
import { CategoryFilter, CheckFilter, DateFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

interface CatRow { categoryId: string; items: number; value: number; saleValue: number }

/** stock on hand with weighted average cost, value at cost and at sale price, by category */
export default function StockSummary() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [asOf, setAsOf] = useState(today())
  const [cat, setCat] = useState('')
  const [hideZero, setHideZero] = useState(false)
  const label = usePeriodLabel()
  // replay up to the date only when something happened after it
  const stock = useMemo(() => {
    const later = data.txns.some((x) => x.date > asOf) || data.adjustments.some((a) => a.date > asOf) || data.items.some((i) => i.openingDate > asOf && i.openingStock)
    return later ? stockAsOf(data, asOf) : books.stock
  }, [data, books, asOf])
  const res = useMemo(() => stockSummary(data, stock, cat || undefined), [data, stock, cat])
  const catName = (id?: string) => (id ? data.categories.find((c) => c.id === id)?.name : undefined) ?? t('rp_noCategory')
  const rows = hideZero ? res.rows.filter((r) => r.qty !== 0) : res.rows
  const tt = res.totals
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_stockItems'), value: rows.length, kind: 'int' },
      { label: t('rp_valueAtCost'), value: tt.value, kind: 'money', tone: 'brand' },
      { label: t('rp_valueAtSale'), value: tt.saleValue, kind: 'money' },
      { label: t('rp_expectedProfit'), value: round2(tt.saleValue - tt.value), kind: 'money', tone: 'good' },
    ],
    sections: [
      section<StockRow>({
        cols: [
          { key: 'name', label: t('rp_item'), value: (r) => r.item.name, href: (r) => itemPath(r.item.id), sub: (r) => r.item.code },
          { key: 'cat', label: t('rp_category'), value: (r) => catName(r.item.categoryId) },
          { key: 'qty', label: t('qty'), kind: 'qty', value: (r) => r.qty, tone: true },
          { key: 'unit', label: t('unit'), value: (r) => r.item.unit },
          { key: 'avg', label: t('rp_avgCost'), kind: 'money', value: (r) => r.avgCost },
          { key: 'value', label: t('rp_valueAtCost'), kind: 'money', value: (r) => r.value, tone: true },
          { key: 'price', label: t('rp_salePrice'), kind: 'money', value: (r) => r.item.salePrice },
          { key: 'saleValue', label: t('rp_valueAtSale'), kind: 'money', value: (r) => r.saleValue, tone: true },
        ],
        rows,
        foot: { value: round2(rows.reduce((a, r) => a + r.value, 0)), saleValue: round2(rows.reduce((a, r) => a + r.saleValue, 0)) },
        rowStyle: (r) => (r.qty < 0 ? 'bad' : undefined),
        empty: t('rp_noData'),
        rowKey: (r) => r.item.id,
      }),
      section<CatRow>({
        title: t('rp_byCategory'),
        cols: [
          { key: 'cat', label: t('rp_category'), value: (r) => catName(r.categoryId) },
          { key: 'items', label: t('rp_stockItems'), kind: 'int', value: (r) => r.items },
          { key: 'value', label: t('rp_valueAtCost'), kind: 'money', value: (r) => r.value },
          { key: 'saleValue', label: t('rp_valueAtSale'), kind: 'money', value: (r) => r.saleValue },
        ],
        rows: res.byCategory,
        foot: { items: tt.items, value: tt.value, saleValue: tt.saleValue },
        rowKey: (r) => r.categoryId || 'none',
      }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_stock')}
      period={label.asOf(asOf)}
      fileName="stock-summary"
      doc={doc}
      filters={<>
        <DateFilter value={asOf} onChange={setAsOf} />
        <CategoryFilter value={cat} onChange={setCat} />
        <CheckFilter label={t('rp_hideZeroStock')} checked={hideZero} onChange={setHideZero} />
      </>}
    />
  )
}
