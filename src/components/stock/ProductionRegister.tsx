import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import type { ID } from '../../lib/types'
import { DateRange, resolveRange, type Range } from '../DateRange'
import { usePeriodLabel } from '../reports/ReportShell'
import { section, type ReportDoc } from '../reports/ReportTable'
import { Field, Select } from '../ui'
import { productionRegister, type ProductionByItem, type ProductionRow } from './stockLogic'
import { StockReport } from './StockReport'

/** production register: every manufacturing entry in a period with totals, and a summary per item made */
export function ProductionRegister() {
  const { txns, itemById, items } = useData()
  const { t } = useI18n()
  const label = usePeriodLabel()
  const [range, setRange] = useState<Range>({ period: 'month' })
  const [itemId, setItemId] = useState<ID>('')
  const { from, to } = useMemo(() => resolveRange(range), [range])

  const made = useMemo(() => items.filter((i) => i.kind === 'product' && (i.bom?.length || txns.some((x) => x.type === 'manufacture' && x.outputItemId === i.id))), [items, txns])

  const doc = useMemo<ReportDoc>(() => {
    const reg = productionRegister(itemId ? txns.filter((x) => x.outputItemId === itemId) : txns, from, to)
    const name = (id?: ID) => (id ? itemById.get(id)?.name ?? '' : '')
    const unit = (id?: ID) => (id ? itemById.get(id)?.unit ?? '' : '')
    return {
      summary: [
        { label: t('stEntries'), value: reg.rows.length, kind: 'int' },
        { label: t('stMaterialsCost'), value: reg.totals.materials, kind: 'money' },
        { label: t('stCharges'), value: reg.totals.charges, kind: 'money' },
        { label: t('stTotalCost'), value: reg.totals.total, kind: 'money', tone: 'brand' },
      ],
      sections: [
        section<ProductionRow>({
          title: t('stRegister'),
          rows: reg.rows,
          rowKey: (r) => r.txn.id,
          empty: t('stNoMade'),
          cols: [
            { key: 'date', label: t('date'), kind: 'date', value: (r) => r.txn.date },
            { key: 'no', label: t('number'), value: (r) => r.txn.number },
            { key: 'item', label: t('stItemMade'), value: (r) => name(r.itemId), href: (r) => (r.itemId ? itemPath(r.itemId) : undefined) },
            { key: 'qty', label: t('stQtyMade'), kind: 'qty', value: (r) => r.qty, sub: (r) => unit(r.itemId) },
            { key: 'materials', label: t('stMaterialsCost'), kind: 'money', value: (r) => r.materials },
            { key: 'charges', label: t('stCharges'), kind: 'money', value: (r) => r.charges },
            { key: 'total', label: t('stTotalCost'), kind: 'money', value: (r) => r.total },
            { key: 'unit', label: t('stUnitCost'), kind: 'money', value: (r) => r.unitCost },
          ],
          foot: { materials: reg.totals.materials, charges: reg.totals.charges, total: reg.totals.total },
        }),
        section<ProductionByItem>({
          title: t('stByItemMade'),
          rows: reg.byItem,
          rowKey: (r) => r.itemId,
          cols: [
            { key: 'item', label: t('stItemMade'), value: (r) => name(r.itemId), href: (r) => itemPath(r.itemId) },
            { key: 'entries', label: t('stEntries'), kind: 'int', value: (r) => r.entries },
            { key: 'qty', label: t('stQtyMade'), kind: 'qty', value: (r) => r.qty, sub: (r) => unit(r.itemId) },
            { key: 'materials', label: t('stMaterialsCost'), kind: 'money', value: (r) => r.materials },
            { key: 'charges', label: t('stCharges'), kind: 'money', value: (r) => r.charges },
            { key: 'total', label: t('stTotalCost'), kind: 'money', value: (r) => r.total },
            { key: 'unit', label: t('stAvgUnitCost'), kind: 'money', value: (r) => r.unitCost },
          ],
          foot: { materials: reg.totals.materials, charges: reg.totals.charges, total: reg.totals.total },
        }),
      ],
    }
  }, [txns, itemId, from, to, itemById, t])

  return (
    <StockReport
      title={t('stRegister')}
      period={label.range(from, to)}
      fileName="production-register"
      doc={doc}
      filters={<>
        <Field label={t('rp_periodLabel')}><DateRange value={range} onChange={setRange} /></Field>
        <Field label={t('stItemMade')} className="min-w-48">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">{t('all')}</option>
            {made.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </Field>
      </>}
    />
  )
}
