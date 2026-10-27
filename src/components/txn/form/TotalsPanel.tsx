import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { useData } from '../../../lib/data'
import { fmtMoney, round2 } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { pointsValue } from '../../../lib/loyalty'
import { TXN_META } from '../../../lib/txn'
import { Money, NumberInput } from '../../ui'
import { paidNowKey } from '../logic'
import { endSplit, manualDiscount, startSplit } from '../payLogic'
import { AccountModeFields } from './PaymentFields'
import { SplitPayments } from './SplitPayments'
import { mustPayInFull, type DraftApi } from './useDraft'

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-1.5', strong && 'text-base font-bold text-stone-900')}>
      <span className={strong ? '' : 'text-sm text-stone-600'}>{label}</span>
      <div className="text-end">{children}</div>
    </div>
  )
}

/** subtotal, discount, charges, tax, round off, grand total, then the payment taken now */
export function TotalsPanel({ api, showTotals = true }: { api: DraftApi; showTotals?: boolean }) {
  const { t } = useI18n()
  const { settings, firm, accounts } = useData()
  const { draft: d, update, fullPay, setFullPay } = api
  const f = settings.features
  const m = TXN_META[d.type]
  const sym = firm.currencySymbol
  const taxShown = f.tax && d.type !== 'expense' && d.taxTotal > 0
  const forced = mustPayInFull(d)
  const due = round2(d.total - d.received)
  const split = !!d.payments
  // redeemed loyalty points sit inside the discount; the inputs show and edit the rest
  const pts = d.pointsRedeemed || 0
  const ptsValue = pointsValue(pts, settings)
  const toggleSplit = (on: boolean) => update((x) => (on ? { payments: startSplit(x, accounts) } : endSplit(x)))

  return (
    <div className="space-y-1">
      {showTotals && (
        <>
          <Row label={taxShown ? t('txSubtotalExTax') : t('txSubtotal')}><Money value={taxShown ? d.subtotal - d.taxTotal : d.subtotal} symbol={sym} /></Row>
          {taxShown && <Row label={settings.taxLabel || t('txTax')}><Money value={d.taxTotal} symbol={sym} /></Row>}
          <Row label={t('txDiscount')}>
            <div className="flex items-center justify-end gap-1.5">
              <NumberInput value={d.discountPct} onValue={(n) => update({ discountPct: Math.max(0, Math.min(100, n)) })} placeholder="%" className="h-8 w-16 px-2 text-end" aria-label={t('txDiscountPct')} disabled={pts > 0} />
              <NumberInput value={pts > 0 ? manualDiscount(d, settings) : d.discount} onValue={(n) => update({ discount: round2(Math.max(0, n) + ptsValue), discountPct: 0 })} className="h-8 w-24 px-2 text-end" aria-label={t('txDiscount')} />
            </div>
          </Row>
          {pts > 0 && <Row label={t('txPointsDiscount', { n: pts })}><Money value={-ptsValue} symbol={sym} /></Row>}
          {f.charges && (
            <Row label={t('txCharges')}>
              <NumberInput value={d.charges} onValue={(n) => update({ charges: n })} className="h-8 w-24 px-2 text-end" aria-label={t('txCharges')} />
            </Row>
          )}
          {f.roundOff && d.roundOff !== 0 && <Row label={t('txRoundOff')}><Money value={d.roundOff} symbol={sym} /></Row>}
          <div className="border-t border-stone-200" />
          <Row label={t('txGrandTotal')} strong><Money value={d.total} symbol={sym} className="text-lg text-brand-700" /></Row>
        </>
      )}

      {m.posts && (
        <div className="mt-2 space-y-3 rounded-lg bg-stone-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!split && (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={forced || fullPay}
                  disabled={forced}
                  onChange={(e) => setFullPay(e.target.checked)}
                />
                {t('txFullPayment')}
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
              <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={split} onChange={(e) => toggleSplit(e.target.checked)} />
              {t('txSplitPayment')}
            </label>
          </div>
          {forced && <p className="text-xs text-stone-500">{t('txWalkInPaid')}</p>}
          {split ? (
            <SplitPayments api={api} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-stone-600">{t(paidNowKey(d.type))}</span>
                <NumberInput
                  value={d.received}
                  onValue={(n) => update({ received: n })}
                  disabled={forced || fullPay}
                  className="h-9 w-32 px-2 text-end font-semibold"
                  aria-label={t(paidNowKey(d.type))}
                />
              </div>
              {(d.received > 0 || forced) && <AccountModeFields draft={d} update={update} />}
            </>
          )}
          {split && <p className="text-xs text-stone-500">{t('txSplitHint', { amount: fmtMoney(d.received, sym) })}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2">
            <span className="text-sm font-semibold text-stone-700">{t('txBalanceDue')}</span>
            <Money value={due} symbol={sym} className={cx('text-base font-bold', due > 0.001 ? 'text-red-700' : 'text-emerald-700')} />
          </div>
        </div>
      )}
    </div>
  )
}
