import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { section, type ReportDoc } from '../reports/ReportTable'
import { Field, Select } from '../ui'
import { godownSummary, type GodownSummaryRow } from './stockLogic'
import { StockReport } from './StockReport'
import { useCost, useGodownStock } from './useStock'

interface CatRow { name: string; qty: number; value: number; by: Record<string, number> }

/** godown-wise stock summary: items and value per godown, and value per category in each godown */
export function GodownSummary() {
  const { items, godowns, categories } = useData()
  const { t } = useI18n()
  const stock = useGodownStock()
  const cost = useCost()
  const [cat, setCat] = useState('')

  const doc = useMemo<ReportDoc>(() => {
    const list = items.filter((i) => !cat || i.categoryId === cat)
    const { rows, total } = godownSummary(list, stock, godowns, cost.ofItem)
    const share = (r: GodownSummaryRow) => (total.value > 0 ? round2((r.value / total.value) * 100) : 0)

    // value per category, one column per godown
    const catName = new Map(categories.map((c) => [c.id, c.name]))
    const byCat = new Map<string, CatRow>()
    for (const i of list) {
      if (i.kind !== 'product') continue
      const m = stock.get(i.id)
      if (!m) continue
      const key = i.categoryId ?? ''
      const r = byCat.get(key) ?? { name: key ? catName.get(key) ?? '' : t('itNoCategory'), qty: 0, value: 0, by: {} }
      for (const [gid, q] of m) {
        if (q <= 0) continue
        const v = round2(q * cost.ofItem(i))
        r.by[gid] = round2((r.by[gid] ?? 0) + v)
        r.value = round2(r.value + v)
      }
      byCat.set(key, r)
    }
    const catRows = [...byCat.values()].filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
    const gCols = rows.map((r) => r.godown)

    return {
      summary: [
        { label: t('stGodownsCount'), value: rows.length, kind: 'int' },
        { label: t('stItemsInStock'), value: total.items, kind: 'int' },
        { label: t('itStockValue'), value: total.value, kind: 'money', tone: 'brand' },
        { label: t('stNegativeItems'), value: total.negative, kind: 'int', tone: total.negative ? 'bad' : 'neutral' },
      ],
      sections: [
        section<GodownSummaryRow>({
          title: t('stByGodown'),
          rows,
          rowKey: (r) => r.godown.id,
          cols: [
            { key: 'name', label: t('stGodown'), value: (r) => r.godown.name + (r.godown.active ? '' : ` (${t('inactive')})`) },
            { key: 'items', label: t('stItemsInStock'), kind: 'int', value: (r) => r.items },
            { key: 'negative', label: t('stNegativeItems'), kind: 'int', value: (r) => r.negative || '' },
            { key: 'qty', label: t('stTotalUnits'), kind: 'qty', value: (r) => r.qty },
            { key: 'value', label: t('itStockValue'), kind: 'money', value: (r) => r.value },
            { key: 'share', label: t('stShare'), kind: 'pct', value: share },
          ],
          foot: { items: total.items, negative: total.negative, qty: total.qty, value: total.value, share: total.value > 0 ? 100 : 0 },
        }),
        section<CatRow>({
          title: t('stByCategory'),
          rows: catRows,
          rowKey: (r) => r.name,
          cols: [
            { key: 'name', label: t('itCategory'), value: (r) => r.name },
            ...gCols.map((g) => ({ key: g.id, label: g.name, kind: 'money' as const, value: (r: CatRow) => r.by[g.id] ?? 0 })),
            { key: 'value', label: t('total'), kind: 'money', value: (r) => r.value },
          ],
          foot: Object.fromEntries([...gCols.map((g) => [g.id, round2(catRows.reduce((a, r) => a + (r.by[g.id] ?? 0), 0))]), ['value', round2(catRows.reduce((a, r) => a + r.value, 0))]]),
        }),
      ],
    }
  }, [items, cat, stock, godowns, categories, cost, t])

  return (
    <StockReport
      title={t('stGodownSummary')}
      period={t('rp_asOf', { date: fmtDate(today()) })}
      fileName="godown-summary"
      doc={doc}
      filters={
        <Field label={t('itCategory')} className="min-w-48">
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t('itAllCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      }
    />
  )
}
