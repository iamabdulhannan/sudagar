import { Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { useData } from '../../../lib/data'
import { fmtDate, fmtMoney, fmtQty } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { TXN_META } from '../../../lib/txn'
import type { ID, Party, TxnLine, TxnType } from '../../../lib/types'
import { Button, IconButton, Input, Money, NumberInput, Select } from '../../ui'
import { autoRate, changeUnit } from '../logic'
import { rateForFactor, type LastRate } from '../payLogic'

const cell = 'h-9 px-2'

/** a blank free-text line (expense heads, one-off services) */
export const freeLine = (taxRate = 0): TxnLine => ({
  name: '', qty: 1, unit: '', factor: 1, rate: 0, priceIncludesTax: false,
  discountPct: 0, discount: 0, taxRate, taxAmount: 0, amount: 0,
})

/**
 * Editable grid of document lines: a table on wide screens, cards on phones.
 * Amounts are recalculated by the parent (calcTotals) after each change.
 */
export function LinesEditor({ lines, onChange, type, party, original, stock, lastRates, lastKey }: {
  lines: TxnLine[]
  onChange: (lines: TxnLine[]) => void
  type: TxnType
  party?: Party
  /** saved document when editing, to show stock including what it took */
  original?: { lines: TxnLine[]; type: TxnType; cancelled?: boolean }
  /** stock on hand per item (e.g. of the chosen godown); defaults to the total */
  stock?: Map<ID, number>
  /** last rate per item for the chosen party, shown under the rate */
  lastRates?: Map<ID, LastRate>
  /** i18n key of the last rate hint (txLastSold / txLastBought) */
  lastKey?: string
}) {
  const { t } = useI18n()
  const { settings, itemById, qty: totalQty, firm } = useData()
  const qty = stock ?? totalQty
  const f = settings.features
  const expense = type === 'expense'
  const show = {
    disc: f.lineDiscount && !expense,
    tax: f.tax && !expense,
    batch: f.batches && !expense,
    serial: f.serials && !expense,
  }
  const reduces = TXN_META[type].stock === -1
  const sym = firm.currencySymbol

  const patch = (i: number, p: Partial<TxnLine>) => {
    const old = lines[i]
    let next: TxnLine = { ...old, ...p }
    const item = old.itemId ? itemById.get(old.itemId) : undefined
    // keep the automatic price in step with the quantity (wholesale from a minimum quantity)
    if (item && 'qty' in p && Math.abs(autoRate(item, type, party, old, settings) - old.rate) < 0.001) {
      next = { ...next, rate: autoRate(item, type, party, next, settings) }
    }
    onChange(lines.map((l, j) => (j === i ? next : l)))
  }
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i))

  /** stock on hand for a line's item, adding back what the saved document took */
  const stockOf = (itemId: string) => {
    let n = qty.get(itemId) ?? 0
    if (original && !original.cancelled && TXN_META[original.type].stock === -1) {
      for (const l of original.lines) if (l.itemId === itemId) n += l.qty * (l.factor || 1)
    }
    return n
  }

  const fields = (l: TxnLine, i: number) => {
    const item = l.itemId ? itemById.get(l.itemId) : undefined
    const alt = f.altUnits && item?.altUnit && item.altFactor
    const stock = item && item.kind === 'product' ? stockOf(item.id) : undefined
    const short = reduces && stock !== undefined && l.qty * (l.factor || 1) > stock + 0.0005
    const taxOpts = [...new Set([0, ...settings.taxRates, l.taxRate])].sort((a, b) => a - b)
    const last = l.itemId ? lastRates?.get(l.itemId) : undefined
    const lastRate = last ? rateForFactor(last, l.factor || 1) : 0
    return {
      name: (
        <div>
          <Input value={l.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder={expense ? t('txExpenseItemPh') : t('txItemName')} className={cell} aria-label={t('txItemName')} />
          {stock !== undefined && (
            <div className={cx('mt-0.5 text-[11px]', short ? 'font-medium text-red-700' : 'text-stone-500')}>
              {t('txInStock')}: <span className="num">{fmtQty(stock)} {item!.unit}</span>
            </div>
          )}
        </div>
      ),
      desc: <Input value={l.description ?? ''} onChange={(e) => patch(i, { description: e.target.value || undefined })} placeholder={t('txDescription')} className="h-8 px-2 text-xs" aria-label={t('txDescription')} />,
      qty: <NumberInput value={l.qty} onValue={(n) => patch(i, { qty: n })} className={cx(cell, 'text-end', short && 'border-red-400')} aria-label={t('qty')} />,
      unit: alt ? (
        <Select value={l.unit} onChange={(e) => onChange(lines.map((x, j) => (j === i ? changeUnit(x, item, e.target.value) : x)))} className={cx(cell, 'pe-6')} aria-label={t('unit')}>
          <option value={item!.unit}>{item!.unit}</option>
          <option value={item!.altUnit}>{item!.altUnit} ({fmtQty(item!.altFactor!)} {item!.unit})</option>
        </Select>
      ) : item ? (
        <span className="block px-1 text-sm text-stone-600">{l.unit}</span>
      ) : (
        <Input value={l.unit} onChange={(e) => patch(i, { unit: e.target.value })} placeholder={t('unit')} className={cell} aria-label={t('unit')} />
      ),
      rate: (
        <div>
          <NumberInput value={l.rate} onValue={(n) => patch(i, { rate: n })} className={cx(cell, 'text-end')} aria-label={t('rate')} />
          {show.tax && l.priceIncludesTax && l.taxRate > 0 && <div className="mt-0.5 text-[11px] text-stone-500">{t('txInclTax')}</div>}
          {last && (
            <button
              type="button"
              onClick={() => patch(i, { rate: lastRate })}
              disabled={Math.abs(lastRate - l.rate) < 0.005}
              title={t('txApplyRate')}
              className="mt-0.5 block max-w-40 cursor-pointer text-start text-[11px] leading-tight text-sky-700 hover:underline disabled:cursor-default disabled:text-stone-500 disabled:no-underline"
            >
              {t(lastKey ?? 'txLastSold', { rate: fmtMoney(lastRate, sym), date: fmtDate(last.date) })}
            </button>
          )}
        </div>
      ),
      disc: (
        <div className="flex gap-1">
          <NumberInput value={l.discountPct} onValue={(n) => patch(i, { discountPct: n })} placeholder="%" className={cx(cell, 'w-14 text-end')} aria-label={t('txDiscountPct')} />
          <NumberInput value={l.discount} onValue={(n) => patch(i, { discount: n, discountPct: 0 })} className={cx(cell, 'w-20 text-end')} aria-label={t('txDiscount')} />
        </div>
      ),
      tax: (
        <Select value={String(l.taxRate)} onChange={(e) => patch(i, { taxRate: Number(e.target.value) })} className={cx(cell, 'pe-6')} aria-label={t('txTaxPct')}>
          {taxOpts.map((r) => <option key={r} value={r}>{r}%</option>)}
        </Select>
      ),
      batch: (
        <div className="flex gap-1">
          <Input value={l.batch ?? ''} onChange={(e) => patch(i, { batch: e.target.value || undefined })} placeholder={t('txBatch')} className={cx(cell, 'w-24')} aria-label={t('txBatch')} />
          <Input type="date" value={l.expiry ?? ''} onChange={(e) => patch(i, { expiry: e.target.value || undefined })} className={cx(cell, 'w-36')} aria-label={t('txExpiry')} />
        </div>
      ),
      serial: <Input value={l.serial ?? ''} onChange={(e) => patch(i, { serial: e.target.value || undefined })} placeholder={t('txSerialPh')} className={cell} aria-label={t('txSerial')} />,
      amount: <Money value={l.amount} symbol={sym} className="font-semibold" />,
      remove: <IconButton label={t('txRemoveLine')} onClick={() => remove(i)} className="text-stone-400 hover:text-red-700"><X className="size-4" /></IconButton>,
    }
  }

  if (!lines.length) return null

  return (
    <>
      <div className="table-wrap hidden md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="min-w-56">{expense ? t('details') : t('txItemName')}</th>
              <th className="w-24 r">{t('qty')}</th>
              <th className="w-28">{t('unit')}</th>
              <th className="w-28 r">{t('rate')}</th>
              {show.disc && <th className="r">{t('txDiscount')} (% / {sym})</th>}
              {show.tax && <th className="w-24">{t('txTaxPct')}</th>}
              {show.batch && <th>{t('txBatch')} / {t('txExpiry')}</th>}
              {show.serial && <th className="min-w-32">{t('txSerial')}</th>}
              <th className="r">{t('amount')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const c = fields(l, i)
              return (
                <tr key={i} className="align-top">
                  <td className="num pt-4 text-stone-500">{i + 1}</td>
                  <td><div className="space-y-1">{c.name}{c.desc}</div></td>
                  <td>{c.qty}</td>
                  <td>{c.unit}</td>
                  <td>{c.rate}</td>
                  {show.disc && <td>{c.disc}</td>}
                  {show.tax && <td>{c.tax}</td>}
                  {show.batch && <td>{c.batch}</td>}
                  {show.serial && <td>{c.serial}</td>}
                  <td className="r pt-4">{c.amount}</td>
                  <td>{c.remove}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-stone-100 md:hidden">
        {lines.map((l, i) => {
          const c = fields(l, i)
          return (
            <li key={i} className="space-y-2 py-3">
              <div className="flex items-start gap-2">
                <span className="num mt-2 w-5 shrink-0 text-xs text-stone-400">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">{c.name}{c.desc}</div>
                {c.remove}
              </div>
              <div className="grid grid-cols-3 gap-2 ps-7">
                <Labeled label={t('qty')}>{c.qty}</Labeled>
                <Labeled label={t('unit')}>{c.unit}</Labeled>
                <Labeled label={t('rate')}>{c.rate}</Labeled>
                {show.disc && <Labeled label={t('txDiscount')} className="col-span-2">{c.disc}</Labeled>}
                {show.tax && <Labeled label={t('txTaxPct')}>{c.tax}</Labeled>}
                {show.batch && <Labeled label={`${t('txBatch')} / ${t('txExpiry')}`} className="col-span-3">{c.batch}</Labeled>}
                {show.serial && <Labeled label={t('txSerial')} className="col-span-3">{c.serial}</Labeled>}
              </div>
              <div className="flex justify-end gap-2 ps-7 text-sm">
                <span className="text-stone-500">{t('amount')}</span>{c.amount}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-0.5 text-[11px] font-medium text-stone-500">{label}</div>
      {children}
    </div>
  )
}

/** "add a free-text line" button */
export function AddLineButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Plus className="size-4" />{label}
    </Button>
  )
}
