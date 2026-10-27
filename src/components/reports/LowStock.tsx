import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import { lowStock, type LowStockRow } from '../../lib/reports'
import { CategoryFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** products at or below their minimum stock, with the quantity and cost to reorder */
export default function LowStock() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [cat, setCat] = useState('')
  const label = usePeriodLabel()
  const rows = useMemo(() => lowStock(data, books.stock).filter((r) => !cat || r.item.categoryId === cat), [data, books, cat])
  const catName = (id?: string) => (id ? data.categories.find((c) => c.id === id)?.name : undefined) ?? t('rp_noCategory')
  const reorder = round2(rows.reduce((a, r) => a + r.short * r.item.purchasePrice, 0))
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_lowItems'), value: rows.length, kind: 'int', tone: rows.length ? 'warn' : 'good' },
      { label: t('rp_outOfStock'), value: rows.filter((r) => r.qty <= 0).length, kind: 'int', tone: 'bad' },
      { label: t('rp_reorderCost'), value: reorder, kind: 'money' },
    ],
    sections: [section<LowStockRow>({
      cols: [
        { key: 'name', label: t('rp_item'), value: (r) => r.item.name, href: (r) => itemPath(r.item.id), sub: (r) => r.item.code },
        { key: 'cat', label: t('rp_category'), value: (r) => catName(r.item.categoryId) },
        { key: 'qty', label: t('rp_inStock'), kind: 'qty', value: (r) => r.qty, tone: true, sub: (r) => r.item.unit },
        { key: 'min', label: t('rp_minStock'), kind: 'qty', value: (r) => r.min },
        { key: 'short', label: t('rp_toOrder'), kind: 'qty', value: (r) => r.short || undefined },
        { key: 'cost', label: t('rp_purchasePrice'), kind: 'money', value: (r) => r.item.purchasePrice },
        { key: 'value', label: t('rp_reorderCost'), kind: 'money', value: (r) => round2(r.short * r.item.purchasePrice) || undefined },
      ],
      rows,
      foot: { value: reorder },
      rowStyle: (r) => (r.qty <= 0 ? 'bad' : undefined),
      empty: t('rp_noLowStock'),
      rowKey: (r) => r.item.id,
      note: t('rp_lowStockNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_lowstock')}
      period={label.asOf(today())}
      fileName="low-stock"
      doc={doc}
      filters={<CategoryFilter value={cat} onChange={setCat} />}
    />
  )
}
