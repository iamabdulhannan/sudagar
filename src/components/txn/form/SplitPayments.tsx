import { Plus, X } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { useData } from '../../../lib/data'
import { round2 } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import type { PaymentMode, PaymentSplit } from '../../../lib/types'
import { Button, IconButton, Input, Money, NumberInput, Select } from '../../ui'
import { splitRemaining, splitSum } from '../payLogic'
import { AccountPicker, MODES, modeFor } from './PaymentFields'
import type { DraftApi } from './useDraft'

/** rows of mode + account + amount (+ ref no); paid now is their sum */
export function SplitPayments({ api }: { api: DraftApi }) {
  const { t } = useI18n()
  const { firm } = useData()
  const { draft: d, update } = api
  const rows = d.payments ?? []
  const sym = firm.currencySymbol
  const left = splitRemaining(d.total, rows)

  const set = (i: number, p: Partial<PaymentSplit>) => update((x) => ({ payments: (x.payments ?? []).map((r, j) => (j === i ? { ...r, ...p } : r)) }))
  const remove = (i: number) => update((x) => ({ payments: (x.payments ?? []).filter((_, j) => j !== i) }))
  const add = () => update((x) => {
    const ps = x.payments ?? []
    const last = ps[ps.length - 1]
    return { payments: [...ps, { accountId: last?.accountId ?? x.accountId ?? '', mode: 'cash', amount: Math.max(0, splitRemaining(x.total, ps)) }] }
  })
  const fill = (i: number) => update((x) => {
    const ps = x.payments ?? []
    const rest = splitRemaining(x.total, ps)
    return { payments: ps.map((r, j) => (j === i ? { ...r, amount: Math.max(0, round2(r.amount + rest)) } : r)) }
  })

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-stone-200 bg-surface p-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Select value={r.mode} onChange={(e) => set(i, { mode: e.target.value as PaymentMode })} className="h-9 px-2 text-[13px]" aria-label={t('txMode')}>
                {MODES.map((m) => <option key={m} value={m}>{t('pm_' + m)}</option>)}
              </Select>
              <AccountPicker value={r.accountId || undefined} onChange={(id, kind) => set(i, { accountId: id, mode: r.mode === 'cash' || r.mode === 'bank' || r.mode === 'wallet' ? modeFor(kind) : r.mode })} className="h-9 px-2 text-[13px]" />
              <NumberInput value={r.amount} onValue={(n) => set(i, { amount: Math.max(0, n) })} className="h-9 px-2 text-end font-semibold" aria-label={t('amount')} placeholder="0" />
              <Input value={r.refNo ?? ''} onChange={(e) => set(i, { refNo: e.target.value || undefined })} className="h-9 px-2 text-[13px]" placeholder={t('txRefShort')} aria-label={t('txChequeRef')} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <IconButton label={t('txRemoveLine')} onClick={() => remove(i)} disabled={rows.length <= 1} className="size-8 text-stone-400 hover:text-red-700"><X className="size-4" /></IconButton>
              {left > 0.001 && <button type="button" onClick={() => fill(i)} className="cursor-pointer rounded px-1 text-[11px] font-medium text-brand-700 hover:underline">{t('txFillRest')}</button>}
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={add}><Plus className="size-4" />{t('txAddPaymentRow')}</Button>
        <div className="text-end text-xs">
          <div className="text-stone-500">{t('txAllocated')}: <Money value={splitSum(rows)} symbol={sym} className="font-semibold text-stone-800" /></div>
          <div className={cx(left < -0.001 ? 'text-red-700' : left > 0.001 ? 'text-amber-700' : 'text-emerald-700')}>
            {left < -0.001 ? t('txOverAllocated') : t('txRemaining')}: <Money value={Math.abs(left)} symbol={sym} className="font-semibold" />
          </div>
        </div>
      </div>
    </div>
  )
}
