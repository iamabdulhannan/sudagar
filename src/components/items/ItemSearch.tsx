import { Plus, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Item } from '../../lib/types'
import { fieldCls } from '../ui'
import { ItemFormModal } from './ItemFormModal'
import { exactCodeMatch, fmtStock, searchItems, stockLevel } from './itemUtils'
import { ScanButton } from './ScanButton'

/**
 * Search box for adding items to a bill: matches name, code and barcode, shows stock and price,
 * Enter picks the first match (an exact barcode scan picks at once), and can add a new item inline.
 */
export function ItemSearch({ onPick, side, autoFocus, placeholder, className, showScan = true, allowAdd = true, filter, stock }: {
  onPick: (item: Item) => void
  side: 'sale' | 'purchase'
  autoFocus?: boolean
  placeholder?: string
  className?: string
  /** camera scan button inside the box (shown only where the browser can scan) */
  showScan?: boolean
  /** last option "Add new item" */
  allowAdd?: boolean
  /** only offer items that pass this */
  filter?: (item: Item) => boolean
  /** stock to show per item (e.g. of one godown); default: total stock */
  stock?: Map<ID, number>
}) {
  const { items, qty: totalQty, settings, firm } = useData()
  const qty = stock ?? totalQty
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const active = useMemo(() => items.filter((i) => i.active && (!filter || filter(i))), [items, filter])
  const results = useMemo(() => searchItems(active, q, 30), [active, q])
  const count = results.length + (allowAdd ? 1 : 0) // last option: add new item

  useEffect(() => { setHi(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

  const pick = (item: Item) => {
    onPick(item)
    setQ('')
    setOpen(false)
    setHi(0)
    inputRef.current?.focus()
  }

  const addNew = () => {
    if (!allowAdd) return
    setOpen(false)
    setAdding(q.trim())
  }

  const choose = (idx: number) => {
    if (idx < results.length) pick(results[idx])
    else addNew()
  }

  const onScan = (code: string) => {
    const exact = exactCodeMatch(active, code)
    if (exact) { pick(exact); return }
    setQ(code)
    setOpen(true)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHi((h) => Math.min(h + 1, count - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const exact = exactCodeMatch(active, q)
      if (exact) { pick(exact); return }
      if (!q.trim() && !open) return
      choose(open ? hi : 0)
    } else if (e.key === 'Escape') {
      if (open || q) {
        e.stopPropagation()
        setOpen(false)
        setQ('')
      }
    }
  }

  const price = (i: Item) => (side === 'purchase' ? i.purchasePrice : i.salePrice)

  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => { if (q) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? t('itSearchPh')}
        className={cx(fieldCls, 'ps-9', showScan && 'pe-11')}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${hi}` : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {showScan && <ScanButton onCode={onScan} size="sm" className="absolute end-1.5 top-1/2 -translate-y-1/2" />}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-stone-200 bg-surface py-1 shadow-lg"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-stone-500">{t('noResults')}</li>}
          {results.map((i, idx) => {
            const level = stockLevel(i, qty.get(i.id))
            return (
              <li
                key={i.id}
                id={`${listId}-${idx}`}
                data-idx={idx}
                role="option"
                aria-selected={hi === idx}
                onMouseDown={(e) => { e.preventDefault(); pick(i) }}
                onMouseEnter={() => setHi(idx)}
                className={cx('flex cursor-pointer items-center gap-3 px-3 py-2', hi === idx ? 'bg-brand-50' : 'hover:bg-stone-50')}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-900">{i.name}</div>
                  {(i.code || i.barcode) && <div className="num truncate text-xs text-stone-500">{[i.code, i.barcode].filter(Boolean).join(' · ')}</div>}
                </div>
                <div className="shrink-0 text-end">
                  <div className="num text-sm font-semibold text-stone-800">{fmtMoney(price(i), firm.currencySymbol)}</div>
                  {i.kind === 'product'
                    ? (
                      <div className={cx('num text-xs', level === 'out' ? 'text-red-700' : level === 'low' ? 'text-amber-700' : 'text-stone-500')}>
                        {fmtStock(i, qty.get(i.id) ?? 0, settings.features.altUnits)}
                      </div>
                    )
                    : <div className="text-xs text-stone-400">{t('itService')}</div>}
                </div>
              </li>
            )
          })}
          {allowAdd && <li
            id={`${listId}-${results.length}`}
            data-idx={results.length}
            role="option"
            aria-selected={hi === results.length}
            onMouseDown={(e) => { e.preventDefault(); addNew() }}
            onMouseEnter={() => setHi(results.length)}
            className={cx(
              'flex cursor-pointer items-center gap-2 border-t border-stone-100 px-3 py-2 text-sm font-medium text-brand-700',
              hi === results.length ? 'bg-brand-50' : 'hover:bg-stone-50',
            )}
          >
            <Plus className="size-4" />
            {q.trim() ? t('itAddNamed', { name: q.trim() }) : t('itNew')}
          </li>}
        </ul>
      )}
      {allowAdd && (
        <ItemFormModal
          open={adding !== null}
          defaultName={adding ?? undefined}
          onClose={() => { setAdding(null); setTimeout(() => inputRef.current?.focus(), 0) }}
          onSaved={(item) => pick(item)}
        />
      )}
    </div>
  )
}
