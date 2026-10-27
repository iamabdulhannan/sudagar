import { Gift } from 'lucide-react'
import { useMemo } from 'react'
import { useData } from '../../../lib/data'
import { fmtMoney } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { pointsAvailable, pointsValue } from '../../../lib/loyalty'
import { Button, Card, NumberInput } from '../../ui'
import { maxRedeemable, pointsPayable, redeemPatch } from '../payLogic'
import type { DraftApi } from './useDraft'

/** points the customer has, and how many to spend on this bill (their value goes into the discount) */
export function LoyaltyRedeem({ api }: { api: DraftApi }) {
  const { t } = useI18n()
  const { txns, settings, firm } = useData()
  const { draft: d, update, original } = api
  const sym = firm.currencySymbol
  const available = useMemo(() => (d.partyId ? pointsAvailable(txns, settings, d.partyId, original) : 0), [txns, settings, d.partyId, original])
  const used = d.pointsRedeemed || 0
  const max = maxRedeemable(available, pointsPayable(d, settings), settings)
  const set = (n: number) => update((x) => redeemPatch(x, Math.min(Math.max(0, Math.floor(n)), maxRedeemable(available, pointsPayable(x, settings), settings)), settings))

  if (available <= 0 && !used) return null
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Gift className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800">{t('txPointsAvailable', { n: available })}</div>
          <div className="text-xs text-stone-500">{t('txPointsWorth', { amount: fmtMoney(pointsValue(available, settings), sym) })}</div>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          {t('txRedeemPoints')}
          <NumberInput value={used} onValue={set} className="h-9 w-24 px-2 text-end font-semibold" aria-label={t('txRedeemPoints')} />
        </label>
        {max > used && <Button variant="ghost" size="sm" onClick={() => set(max)}>{t('txRedeemMax', { n: max })}</Button>}
      </div>
      {used > 0 && <p className="mt-2 text-xs text-emerald-700">{t('txPointsApplied', { n: used, amount: fmtMoney(pointsValue(used, settings), sym) })}</p>}
    </Card>
  )
}
