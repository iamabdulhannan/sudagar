import { ChevronDown, Phone, Plus, User, X } from 'lucide-react'
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { useBooks, useData } from '../../lib/data'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Party, PartyKind } from '../../lib/types'
import { fieldCls } from '../ui'
import { BalanceText } from './PartyBits'
import { PartyFormModal } from './PartyFormModal'
import { balanceDir, isCustomer, isSupplier, matchParty } from './partyUtils'

type Side = 'sale' | 'purchase' | 'money'

type Opt =
  | { k: 'walkin' }
  | { k: 'party'; p: Party; bal: number }
  | { k: 'add'; name: string }

const MAX = 60

/** searchable party select with current balance; can add a new party inline */
export function PartyPicker({ value, onChange, side, allowWalkIn, autoFocus, className }: {
  value?: ID
  onChange: (id: ID | undefined) => void
  /** which parties to list first and which kind a new party gets */
  side: Side
  /** show a "Walk-in customer" choice (value undefined) */
  allowWalkIn?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const { parties, partyById, firm } = useData()
  const books = useBooks()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)
  // a party saved a moment ago may not be in useData() yet
  const [fresh, setFresh] = useState<Party | null>(null)

  const selected = value ? partyById.get(value) ?? (fresh?.id === value ? fresh : undefined) : undefined
  const bal = (id: ID) => books.balances.get(`party:${id}`) ?? 0

  const options = useMemo<Opt[]>(() => {
    const rank = (k: PartyKind) => {
      if (side === 'sale') return isCustomer(k) ? 0 : 1
      if (side === 'purchase') return isSupplier(k) ? 0 : 1
      return 0
    }
    const list = parties
      .filter((p) => (p.active || p.id === value) && matchParty(p, q))
      .sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name))
      .slice(0, MAX)
      .map((p): Opt => ({ k: 'party', p, bal: books.balances.get(`party:${p.id}`) ?? 0 }))
    const out: Opt[] = []
    if (allowWalkIn && !q.trim()) out.push({ k: 'walkin' })
    out.push(...list)
    out.push({ k: 'add', name: q.trim() })
    return out
  }, [parties, q, side, allowWalkIn, value, books])

  const show = (o = true) => { setOpen(o); if (o) setActive(0) }
  const close = () => { setOpen(false); setEditing(false); setQ('') }

  const choose = (o: Opt) => {
    if (o.k === 'add') { setAdding(o.name); setOpen(false); return }
    onChange(o.k === 'walkin' ? undefined : o.p.id)
    close()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) show()
      else setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Home' && open) {
      e.preventDefault(); setActive(0)
    } else if (e.key === 'End' && open) {
      e.preventDefault(); setActive(options.length - 1)
    } else if (e.key === 'Enter') {
      // never submit the surrounding form from here
      e.preventDefault()
      if (open && options[active]) choose(options[active])
      else show()
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
      else if (editing) { e.stopPropagation(); close() }
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const optId = (i: number) => `${listId}-o${i}`
  const newKind: PartyKind = side === 'purchase' ? 'supplier' : 'customer'

  const modal = (
    <PartyFormModal
      open={adding !== null}
      onClose={() => setAdding(null)}
      kind={newKind}
      defaultName={adding ?? ''}
      onSaved={(p) => { setFresh(p); onChange(p.id); close() }}
    />
  )

  // ---- selected party: name, phone and balance with a clear button
  if (selected && !editing) {
    const b = bal(selected.id)
    return (
      <div className={cx('relative', className)}>
        <div className={cx(fieldCls, 'flex h-auto min-h-10 items-center gap-2 py-1.5')}>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-start cursor-pointer"
            onClick={() => { setEditing(true); show(); requestAnimationFrame(() => inputRef.current?.focus()) }}
            aria-label={t('pt_changeParty')}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
              {selected.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-stone-900">{selected.name}</span>
              {selected.phone && (
                <span className="num flex items-center gap-1 text-xs text-stone-500"><Phone className="size-3" />{selected.phone}</span>
              )}
            </span>
            <BalanceText value={b} symbol={firm.currencySymbol} className="text-xs" />
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="grid size-7 shrink-0 place-items-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
            aria-label={t('pt_clearParty')}
            title={t('pt_clearParty')}
          >
            <X className="size-4" />
          </button>
        </div>
        {!!selected.creditLimit && b > selected.creditLimit && (
          <p className="mt-1 text-xs text-red-700">{t('pt_overLimit', { limit: fmtMoney(selected.creditLimit, firm.currencySymbol) })}</p>
        )}
        {modal}
      </div>
    )
  }

  return (
    <div className={cx('relative', className)}>
      <div className="relative">
        <User className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? optId(active) : undefined}
          autoFocus={autoFocus || editing}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => show()}
          onClick={() => { if (!open) show() }}
          onBlur={() => { setOpen(false); if (editing) close() }}
          onKeyDown={onKey}
          placeholder={allowWalkIn ? t('pt_pickerWalkInPh') : t('pt_pickerPh')}
          className={cx(fieldCls, 'ps-9 pe-8')}
        />
        <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          // keep focus in the input while clicking an option
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-stone-200 bg-surface p-1 shadow-xl"
        >
          {options.length === 1 && q.trim() && (
            <li className="px-3 py-2 text-sm text-stone-500">{t('noResults')}</li>
          )}
          {options.map((o, i) => (
            <li
              key={o.k === 'party' ? o.p.id : o.k}
              id={optId(i)}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={cx(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                i === active ? 'bg-brand-50' : 'hover:bg-stone-50',
                o.k === 'add' && 'border-t border-stone-100 font-medium text-brand-700',
              )}
            >
              {o.k === 'walkin' && (
                <span className="flex items-center gap-2 text-stone-700"><User className="size-4 text-stone-400" />{t('walkIn')}</span>
              )}
              {o.k === 'party' && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">
                      {o.p.name}
                      {o.p.kind !== 'both' && ((side === 'sale' && o.p.kind === 'supplier') || (side === 'purchase' && o.p.kind === 'customer')) && (
                        <span className="ms-1.5 text-[11px] font-normal text-stone-400">({t('pk_' + o.p.kind)})</span>
                      )}
                    </span>
                    {(o.p.phone || o.p.city) && (
                      <span className="block truncate text-xs text-stone-500">
                        <span className="num">{o.p.phone}</span>{o.p.phone && o.p.city ? ', ' : ''}{o.p.city}
                      </span>
                    )}
                  </span>
                  {balanceDir(o.bal) !== 'settled' && <BalanceText value={o.bal} symbol={firm.currencySymbol} className="text-xs" />}
                </>
              )}
              {o.k === 'add' && (
                <span className="flex items-center gap-2"><Plus className="size-4" />{o.name ? t('pt_addNewNamed', { name: o.name }) : t('pt_addNewParty')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {modal}
    </div>
  )
}
