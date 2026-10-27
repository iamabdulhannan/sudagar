import { Download, Package } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { downloadCsv } from '../../lib/csv'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { round2, round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import type { ID, Item } from '../../lib/types'
import { fmtStock, matchItem } from '../items/itemUtils'
import { Button, Empty, Money, SearchInput, Select, Toggle } from '../ui'
import { GodownSelect } from './StockBits'
import { useCost, useGodownStock } from './useStock'

interface Row { item: Item; by: Map<ID, number>; total: number; value: number }

/** stock of every product in every godown (or in one godown), valued at average cost */
export function GodownStockTable() {
  const { items, godowns, categories, settings, firm } = useData()
  const { t } = useI18n()
  const stock = useGodownStock()
  const cost = useCost()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [godown, setGodown] = useState<ID>('')
  const [hideZero, setHideZero] = useState(true)
  const alt = settings.features.altUnits
  const sym = firm.currencySymbol

  // columns: active godowns plus any inactive one that still holds stock
  const cols = useMemo(() => godowns.filter((g) => g.active || items.some((i) => (stock.get(i.id)?.get(g.id) ?? 0) !== 0)), [godowns, items, stock])

  const rows = useMemo(() => {
    const out: Row[] = []
    for (const item of items) {
      if (item.kind !== 'product') continue
      if (cat && item.categoryId !== cat) continue
      if (!matchItem(item, q)) continue
      const by = stock.get(item.id) ?? new Map<ID, number>()
      const total = godown ? by.get(godown) ?? 0 : round3([...by.values()].reduce((a, v) => a + v, 0))
      if (hideZero && total === 0 && (godown || [...by.values()].every((v) => v === 0))) continue
      out.push({ item, by, total, value: round2(Math.max(0, total) * cost.ofItem(item)) })
    }
    return out
  }, [items, stock, cat, q, godown, hideZero, cost])

  const totalValue = round2(rows.reduce((a, r) => a + r.value, 0))
  const shownCols = godown ? cols.filter((g) => g.id === godown) : cols

  function exportCsv() {
    downloadCsv(`godown-stock-${today()}`, [t('name'), t('itCode'), t('unit'), ...shownCols.map((g) => g.name), ...(godown ? [] : [t('total')]), t('stAvgCost'), t('itStockValue')],
      rows.map((r) => [
        r.item.name, r.item.code ?? '', r.item.unit,
        ...shownCols.map((g) => r.by.get(g.id) ?? 0),
        ...(godown ? [] : [r.total]),
        round2(cost.ofItem(r.item)), r.value,
      ]))
  }

  return (
    <div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_auto_auto]">
        <SearchInput value={q} onChange={setQ} placeholder={t('itSearchPh')} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('itCategory')}>
          <option value="">{t('itAllCategories')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <GodownSelect value={godown} onChange={setGodown} all />
        <div className="flex items-center"><Toggle checked={hideZero} onChange={setHideZero} label={t('stHideZero')} /></div>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" />{t('exportCsv')}</Button>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<Package className="size-6" />} title={t('noResults')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('stItem')}</th>
                {shownCols.map((g) => <th key={g.id} className="r whitespace-nowrap">{g.name}</th>)}
                {!godown && <th className="r">{t('total')}</th>}
                <th className="r">{t('stAvgCost')}</th>
                <th className="r">{t('itStockValue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id}>
                  <td>
                    <Link to={itemPath(r.item.id)} className="font-medium text-stone-900 hover:text-brand-700 hover:underline">{r.item.name}</Link>
                    {r.item.code && <div className="num text-xs text-stone-500">{r.item.code}</div>}
                  </td>
                  {shownCols.map((g) => {
                    const v = r.by.get(g.id) ?? 0
                    return <td key={g.id} className={cx('r num whitespace-nowrap', v < 0 ? 'text-red-700' : v === 0 ? 'text-stone-400' : 'text-stone-800')}>{fmtStock(r.item, v, alt)}</td>
                  })}
                  {!godown && <td className={cx('r num whitespace-nowrap font-semibold', r.total < 0 && 'text-red-700')}>{fmtStock(r.item, r.total, alt)}</td>}
                  <td className="r text-stone-600"><Money value={cost.ofItem(r.item)} symbol={sym} /></td>
                  <td className="r font-medium"><Money value={r.value} symbol={sym} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={shownCols.length + (godown ? 2 : 3)}>{t('total')}</td>
                <td className="r"><Money value={totalValue} symbol={sym} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
