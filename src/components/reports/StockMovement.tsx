import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import { stockMovement, type MovementRow } from '../../lib/reports'
import { CategoryFilter, CheckFilter, RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** opening, in, out and closing quantity per product for a period */
export default function StockMovement() {
  const { t } = useI18n()
  const data = useData()
  const { range, setRange, from, to } = useRange()
  const [cat, setCat] = useState('')
  const [movedOnly, setMovedOnly] = useState(true)
  const label = usePeriodLabel()
  const res = useMemo(() => stockMovement(data, from, to), [data, from, to])
  const rows = res.rows
    .filter((r) => !cat || r.categoryId === cat)
    .filter((r) => !movedOnly || r.inQty || r.outQty)
    .sort((a, b) => a.name.localeCompare(b.name))
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_stockItems'), value: rows.length, kind: 'int' },
      { label: t('rp_itemsIn'), value: rows.filter((r) => r.inQty).length, kind: 'int', tone: 'good' },
      { label: t('rp_itemsOut'), value: rows.filter((r) => r.outQty).length, kind: 'int', tone: 'bad' },
    ],
    sections: [section<MovementRow>({
      cols: [
        { key: 'name', label: t('rp_item'), value: (r) => r.name, href: (r) => itemPath(r.itemId) },
        { key: 'unit', label: t('unit'), value: (r) => r.unit },
        { key: 'opening', label: t('opening'), kind: 'qty', value: (r) => r.opening, tone: true },
        { key: 'in', label: t('rp_in'), kind: 'qty', value: (r) => r.inQty || undefined },
        { key: 'out', label: t('rp_out'), kind: 'qty', value: (r) => r.outQty || undefined },
        { key: 'closing', label: t('closing'), kind: 'qty', value: (r) => r.closing, tone: true },
      ],
      rows,
      empty: t('rp_noData'),
      rowKey: (r) => r.itemId,
      note: t('rp_movementNote'),
    })],
  }
  return (
    <ReportShell
      title={t('rp_movement')}
      period={label.range(from, to)}
      fileName="stock-movement"
      doc={doc}
      filters={<>
        <RangeFilter value={range} onChange={setRange} />
        <CategoryFilter value={cat} onChange={setCat} />
        <CheckFilter label={t('rp_movedOnly')} checked={movedOnly} onChange={setMovedOnly} />
      </>}
    />
  )
}
