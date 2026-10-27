import { PackageOpen, Wrench } from 'lucide-react'
import { memo } from 'react'
import { cx } from '../../lib/cx'
import { fmtMoney, fmtQty } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Item } from '../../lib/types'
import { fmtStock, stockLevel } from '../items/itemUtils'

/** tiles of items to tap into the bill; tinted when stock is low or out */
export const ItemGrid = memo(function ItemGrid({ items, qty, inCart, sym, altUnits, onAdd }: {
  items: Item[]
  qty: Map<ID, number>
  /** quantity of each item already on the bill */
  inCart: Map<ID, number>
  sym: string
  altUnits: boolean
  onAdd: (item: Item) => void
}) {
  const { t } = useI18n()
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-stone-400">
        <PackageOpen className="size-10" />
        <p className="text-sm">{t('noResults')}</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((i) => {
        const level = stockLevel(i, qty.get(i.id))
        const n = inCart.get(i.id)
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => onAdd(i)}
            className={cx(
              'relative flex min-h-24 flex-col justify-between rounded-xl border p-2.5 text-start shadow-sm transition cursor-pointer',
              'hover:border-brand-500 hover:shadow active:scale-[0.98]',
              level === 'out' ? 'border-red-200 bg-red-50' : level === 'low' ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-surface',
              !!n && 'ring-2 ring-brand-600',
            )}
          >
            {n ? <span className="num absolute -top-2 end-2 rounded-full bg-brand-700 px-1.5 text-[11px] font-bold text-white">{fmtQty(n)}</span> : null}
            <span className="line-clamp-2 text-sm leading-snug font-medium text-stone-900">{i.name}</span>
            <span className="mt-1.5 flex items-end justify-between gap-1">
              <span className="num text-sm font-bold text-brand-800">{fmtMoney(i.salePrice, sym)}</span>
              {i.kind === 'product' ? (
                <span className={cx('num truncate text-[11px]', level === 'out' ? 'text-red-700' : level === 'low' ? 'text-amber-700' : 'text-stone-500')}>
                  {fmtStock(i, qty.get(i.id) ?? 0, altUnits)}
                </span>
              ) : <Wrench className="size-3.5 text-stone-400" aria-label={t('itService')} />}
            </span>
          </button>
        )
      })}
    </div>
  )
})
