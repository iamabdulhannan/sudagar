import { AlertTriangle, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { uid } from '../../lib/db'
import { round2, round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { calcLine } from '../../lib/txn'
import type { ID, Item, TxnLine } from '../../lib/types'
import { fmtStock } from '../items/itemUtils'
import { IconButton, Money, NumberInput, Select } from '../ui'
import { shortages } from './stockLogic'

/** a line of a stock transfer or manufacturing entry, valued at average cost */
export interface StockLine extends TxnLine { key: string }

/** a new line: `qty` base units at `cost` per base unit */
export function stockLine(item: Item, cost: number, qty = 1): StockLine {
  return {
    ...calcLine({
      itemId: item.id, name: item.name, qty, unit: item.unit, factor: 1, rate: round2(cost),
      priceIncludesTax: false, discountPct: 0, discount: 0, taxRate: 0, taxAmount: 0, amount: 0,
    }, false),
    key: uid(),
  }
}

/** lines of a saved entry back into editable lines */
export const toStockLines = (lines: TxnLine[]): StockLine[] => lines.map((l) => ({ ...l, key: uid() }))
/** editable lines into the lines saved on the transaction */
export const fromStockLines = (lines: StockLine[]): TxnLine[] => lines.map(({ key: _k, ...l }) => l)

/** table of item lines with the quantity available, shortages and value at average cost */
export function StockLines({ lines, onChange, available, cost, needLabel }: {
  lines: StockLine[]
  onChange: (lines: StockLine[]) => void
  /** base units available per item (source godown, or total) */
  available: Map<ID, number>
  /** cost of 1 base unit */
  cost: (id: ID | undefined) => number
  /** header of the quantity column */
  needLabel?: string
}) {
  const { itemById, settings, firm } = useData()
  const { t } = useI18n()
  const alt = settings.features.altUnits
  const sym = firm.currencySymbol

  const short = useMemo(() => new Set(shortages(lines, (id) => available.get(id) ?? 0, (id) => itemById.get(id)?.kind === 'product').map((s) => s.itemId)), [lines, available, itemById])

  const update = (key: string, patch: (l: StockLine) => Partial<StockLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...calcLine({ ...l, ...patch(l) }, false), key: l.key } : l)))

  const setUnit = (l: StockLine, item: Item, useAlt: boolean) => {
    const factor = useAlt && item.altFactor ? item.altFactor : 1
    update(l.key, () => ({ factor, unit: useAlt ? item.altUnit! : item.unit, rate: round2(cost(item.id) * factor) }))
  }

  if (!lines.length) return <p className="rounded-lg border border-dashed border-stone-300 px-3 py-6 text-center text-sm text-stone-500">{t('stNoLines')}</p>

  return (
    <div className="table-wrap rounded-lg border border-stone-200">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('stItem')}</th>
            <th className="r">{t('stAvailable')}</th>
            <th className="r">{needLabel ?? t('qty')}</th>
            <th className="r">{t('stAvgCost')}</th>
            <th className="r">{t('amount')}</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const item = l.itemId ? itemById.get(l.itemId) : undefined
            const have = l.itemId ? available.get(l.itemId) ?? 0 : 0
            const isShort = !!l.itemId && short.has(l.itemId)
            const hasAlt = alt && !!item?.altUnit && !!item.altFactor
            return (
              <tr key={l.key} className={cx(isShort && 'bg-amber-50')}>
                <td>
                  <div className="font-medium text-stone-900">{l.name}</div>
                  {isShort && (
                    <div className="flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle className="size-3.5" />{t('stShort')}
                    </div>
                  )}
                </td>
                <td className={cx('r num whitespace-nowrap', have <= 0 ? 'text-red-700' : 'text-stone-600')}>
                  {item ? fmtStock(item, have, alt) : ''}
                </td>
                <td className="r">
                  <div className="flex items-center justify-end gap-1.5">
                    <NumberInput value={l.qty} onValue={(n) => update(l.key, () => ({ qty: Math.max(0, round3(n)) }))} className="h-8 w-24 text-end" aria-label={t('qty')} />
                    {hasAlt ? (
                      <Select
                        value={l.factor === 1 ? 'base' : 'alt'}
                        onChange={(e) => setUnit(l, item!, e.target.value === 'alt')}
                        className="h-8 w-auto min-w-16 px-2 text-xs"
                        aria-label={t('unit')}
                      >
                        <option value="base">{item!.unit}</option>
                        <option value="alt">{item!.altUnit}</option>
                      </Select>
                    ) : <span className="w-10 text-start text-xs text-stone-500">{l.unit}</span>}
                  </div>
                </td>
                <td className="r text-stone-600"><Money value={l.rate} symbol={sym} /></td>
                <td className="r font-medium"><Money value={l.amount} symbol={sym} /></td>
                <td>
                  <IconButton label={t('delete')} onClick={() => onChange(lines.filter((x) => x.key !== l.key))} className="hover:text-red-700">
                    <Trash2 className="size-4" />
                  </IconButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
