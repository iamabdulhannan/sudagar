import { Gift, Minus, PauseCircle, Plus, ShoppingBasket, Trash2, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { fmtMoney, fmtQty, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { pointsValue } from '../../lib/loyalty'
import type { ID, Txn } from '../../lib/types'
import { PartyPicker } from '../parties/PartyPicker'
import { Button, IconButton, NumberInput, Select } from '../ui'
import type { CartLine, PosDraft } from './cart'

export interface CartActions {
  setQty: (key: string, qty: number) => void
  step: (key: string, by: 1 | -1) => void
  setUnit: (key: string, alt: boolean) => void
  setRate: (key: string, rate: number) => void
  setLineDiscount: (key: string, pct: number) => void
  remove: (key: string) => void
  setParty: (id: ID | undefined) => void
  setDiscount: (mode: 'pct' | 'amt', value: number) => void
  /** loyalty points to spend on the bill */
  setPoints: (points: number) => void
  hold: () => void
  clear: () => void
  pay: () => void
}

/** the right side of the POS: customer, bill lines, totals and the pay button */
export function CartPanel({ draft, txn, over, actions, customerRef, discountRef, onCloseSheet, loyalty }: {
  draft: PosDraft
  txn: Txn
  /** loyalty points of the chosen customer (when loyalty is on) */
  loyalty?: { available: number; max: number }
  /** line keys whose item is short of stock */
  over: Set<string>
  actions: CartActions
  customerRef: RefObject<HTMLDivElement | null>
  discountRef: RefObject<HTMLDivElement | null>
  /** phones: close the bottom sheet */
  onCloseSheet?: () => void
}) {
  const { settings, firm, itemById } = useData()
  const { t } = useI18n()
  const f = settings.features
  const sym = firm.currencySymbol
  const count = round2(draft.lines.reduce((a, l) => a + l.qty, 0))
  const pointsOff = txn.pointsRedeemed ? pointsValue(txn.pointsRedeemed, settings) : 0
  const billDiscount = round2(txn.discount - pointsOff)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-stone-200 p-3">
        <div ref={customerRef} className="min-w-0 flex-1">
          <PartyPicker value={draft.partyId} onChange={actions.setParty} side="sale" allowWalkIn />
        </div>
        {onCloseSheet && <IconButton label={t('close')} onClick={onCloseSheet} className="lg:hidden"><X className="size-5" /></IconButton>}
      </div>
      {loyalty && (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-amber-50 px-3 py-2 text-sm">
          <Gift className="size-4 shrink-0 text-amber-700" />
          <span className="min-w-0 flex-1 text-stone-700">
            <span className="num font-semibold text-stone-900">{t('posPoints', { n: loyalty.available })}</span>
            <span className="num ms-1 text-xs text-stone-500">({fmtMoney(pointsValue(loyalty.available, settings), sym)})</span>
          </span>
          {loyalty.max > 0 && (
            <label className="flex items-center gap-1 text-xs font-medium text-stone-600">
              {t('posRedeem')}
              <NumberInput
                value={txn.pointsRedeemed ?? 0}
                onValue={(n) => actions.setPoints(Math.min(loyalty.max, Math.max(0, Math.floor(n))))}
                className="h-8 w-20 text-end"
                aria-label={t('posRedeem')}
              />
              <button type="button" onClick={() => actions.setPoints(loyalty.max)} className="rounded-md border border-amber-300 bg-surface px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer">
                {t('posMax')}
              </button>
            </label>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {draft.lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center text-stone-400">
            <ShoppingBasket className="size-10" />
            <p className="text-sm">{t('posEmptyCart')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {draft.lines.map((l, idx) => (
              <Line
                key={l.key}
                n={idx + 1}
                line={l}
                short={over.has(l.key)}
                alt={f.altUnits ? itemById.get(l.itemId ?? '') : undefined}
                lineDiscount={f.lineDiscount}
                sym={sym}
                actions={actions}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-stone-200 bg-stone-50 p-3">
        <dl className="space-y-1 text-sm">
          <Row label={t('posSubtotal', { n: fmtQty(count) })} value={fmtMoney(txn.subtotal - txn.taxTotal, sym)} />
          {f.tax && txn.taxTotal > 0 && <Row label={settings.taxLabel} value={fmtMoney(txn.taxTotal, sym)} />}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-stone-600">{t('posDiscount')}</dt>
            <dd ref={discountRef} className="flex items-center gap-1">
              <div className="flex overflow-hidden rounded-md border border-stone-300 text-xs font-semibold">
                {(['pct', 'amt'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => actions.setDiscount(m, 0)}
                    className={cx('px-2 py-1 cursor-pointer', draft.discountMode === m ? 'bg-stone-800 text-white' : 'bg-surface text-stone-600')}
                  >
                    {m === 'pct' ? '%' : sym}
                  </button>
                ))}
              </div>
              <NumberInput
                value={draft.discountMode === 'pct' ? draft.discountPct : draft.discount}
                onValue={(n) => actions.setDiscount(draft.discountMode, n)}
                className="h-8 w-24 text-end"
                aria-label={t('posDiscount')}
              />
            </dd>
          </div>
          {billDiscount > 0 && draft.discountMode === 'pct' && (
            <Row label={<span className="num">{fmtQty(draft.discountPct)}%</span>} value={`- ${fmtMoney(billDiscount, sym)}`} tone="text-red-700" />
          )}
          {pointsOff > 0 && (
            <Row label={t('posPointsUsed', { n: txn.pointsRedeemed ?? 0 })} value={`- ${fmtMoney(pointsOff, sym)}`} tone="text-red-700" />
          )}
          {txn.roundOff !== 0 && <Row label={t('posRoundOff')} value={fmtMoney(txn.roundOff, sym)} />}
        </dl>
        <div className="mt-2 flex items-end justify-between gap-2 border-t border-stone-200 pt-2">
          <span className="text-sm font-semibold text-stone-700">{t('total')}</span>
          <span className="num text-3xl font-extrabold text-stone-900">{fmtMoney(txn.total, sym)}</span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-2">
          <Button variant="secondary" onClick={actions.clear} disabled={!draft.lines.length} title={`${t('posClear')} (Esc)`}>
            <Trash2 className="size-4" />
          </Button>
          <Button variant="secondary" onClick={actions.hold} disabled={!draft.lines.length} title={`${t('posHold')} (F8)`}>
            <PauseCircle className="size-4" />{t('posHold')}
          </Button>
          <Button variant="success" size="lg" onClick={actions.pay} disabled={!draft.lines.length} title="F9">
            {t('posPay')} <span className="num">{fmtMoney(txn.total, sym)}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-stone-600">{label}</dt>
      <dd className={cx('num font-medium text-stone-800', tone)}>{value}</dd>
    </div>
  )
}

function Line({ n, line: l, short, alt, lineDiscount, sym, actions }: {
  n: number
  line: CartLine
  short: boolean
  /** the item, when alt units are on (to offer its second unit) */
  alt?: { unit: string; altUnit?: string; altFactor?: number }
  lineDiscount: boolean
  sym: string
  actions: CartActions
}) {
  const { t } = useI18n()
  const hasAlt = !!alt?.altUnit && !!alt.altFactor
  return (
    <li className={cx('px-3 py-2', short && 'bg-amber-50')}>
      <div className="flex items-start gap-2">
        <span className="num mt-0.5 w-5 shrink-0 text-xs text-stone-400">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-stone-900" title={l.name}>{l.name}</div>
          {short && <div className="text-xs text-amber-700">{t('posLowStockLine')}</div>}
        </div>
        <span className="num shrink-0 text-sm font-semibold text-stone-900">{fmtMoney(l.amount, sym)}</span>
        <button type="button" onClick={() => actions.remove(l.key)} className="shrink-0 rounded p-0.5 text-stone-400 hover:text-red-700 cursor-pointer" aria-label={t('delete')}>
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 ps-7">
        <div className="flex items-center">
          <button type="button" onClick={() => actions.step(l.key, -1)} className="grid size-8 place-items-center rounded-s-md border border-stone-300 bg-surface text-stone-600 hover:bg-stone-100 cursor-pointer" aria-label="-1">
            <Minus className="size-3.5" />
          </button>
          <NumberInput value={l.qty} onValue={(q) => actions.setQty(l.key, q)} className="h-8 w-14 rounded-none border-x-0 px-1 text-center" aria-label={t('qty')} />
          <button type="button" onClick={() => actions.step(l.key, 1)} className="grid size-8 place-items-center rounded-e-md border border-stone-300 bg-surface text-stone-600 hover:bg-stone-100 cursor-pointer" aria-label="+1">
            <Plus className="size-3.5" />
          </button>
        </div>
        {hasAlt ? (
          <Select
            value={l.factor === 1 ? 'base' : 'alt'}
            onChange={(e) => actions.setUnit(l.key, e.target.value === 'alt')}
            className="h-8 w-auto min-w-16 px-2 text-xs"
            aria-label={t('unit')}
          >
            <option value="base">{alt!.unit}</option>
            <option value="alt">{alt!.altUnit}</option>
          </Select>
        ) : <span className="text-xs text-stone-500">{l.unit}</span>}
        <span className="text-xs text-stone-400">×</span>
        <NumberInput value={l.rate} onValue={(r) => actions.setRate(l.key, r)} className={cx('h-8 w-20 px-2 text-end', l.manualRate && 'border-brand-600')} aria-label={t('rate')} />
        {lineDiscount && (
          <label className="flex items-center gap-1 text-xs text-stone-500">
            {t('posDisc')}
            <NumberInput value={l.discountPct} onValue={(p) => actions.setLineDiscount(l.key, p)} className="h-8 w-12 px-1 text-end" aria-label={t('posLineDiscount')} />
            %
          </label>
        )}
      </div>
    </li>
  )
}
