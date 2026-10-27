import { Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { BomLine, ID, Item } from '../../lib/types'
import { ItemSearch } from '../items/ItemSearch'
import { IconButton, Money, NumberInput } from '../ui'
import { makesLoop, unitCost } from './stockLogic'

/** bill of materials of one item: components and the quantity of each used to make 1 unit */
export function BomEditor({ itemId, unit, value, onChange }: {
  itemId: ID
  /** unit of the item being made */
  unit: string
  value: BomLine[]
  onChange: (v: BomLine[]) => void
}) {
  const { itemById, firm } = useData()
  const books = useBooks()
  const { t } = useI18n()
  const sym = firm.currencySymbol

  const cost = useCallback((id: ID) => unitCost(itemById.get(id), books.stock.get(id)?.avgCost), [itemById, books])
  const filter = useCallback((i: Item) => i.kind === 'product' && !makesLoop(itemId, i.id, itemById), [itemId, itemById])
  const perUnit = useMemo(() => round2(value.reduce((a, b) => a + b.qty * cost(b.itemId), 0)), [value, cost])

  const add = (i: Item) => {
    if (value.some((b) => b.itemId === i.id)) return
    onChange([...value, { itemId: i.id, qty: 1 }])
  }
  const setQty = (idx: number, qty: number) => onChange(value.map((b, i) => (i === idx ? { ...b, qty: Math.max(0, qty) } : b)))
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">{t('stBomHint', { unit: unit || '-' })}</p>
      {value.length > 0 && (
        <div className="table-wrap rounded-lg border border-stone-200">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('stMaterial')}</th>
                <th className="r">{t('stQtyPerUnit', { unit: unit || '-' })}</th>
                <th className="r">{t('stCostEach')}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {value.map((b, idx) => {
                const item = itemById.get(b.itemId)
                return (
                  <tr key={b.itemId}>
                    <td className="font-medium">{item?.name ?? t('stMissingItem')}</td>
                    <td className="r">
                      <div className="flex items-center justify-end gap-1.5">
                        <NumberInput value={b.qty} onValue={(n) => setQty(idx, n)} className="h-8 w-24 text-end" aria-label={t('qty')} />
                        <span className="w-10 text-start text-xs text-stone-500">{item?.unit}</span>
                      </div>
                    </td>
                    <td className="r"><Money value={round2(b.qty * cost(b.itemId))} symbol={sym} /></td>
                    <td>
                      <IconButton label={t('delete')} onClick={() => remove(idx)} className="hover:text-red-700"><Trash2 className="size-4" /></IconButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{t('stBomCost', { unit: unit || '-' })}</td>
                <td className="r num"><Money value={perUnit} symbol={sym} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <ItemSearch onPick={add} side="purchase" allowAdd={false} showScan={false} filter={filter} placeholder={t('stAddMaterial')} />
    </div>
  )
}
