import { Gift } from 'lucide-react'
import { useEffect, useState } from 'react'
import { updateSettings, useData } from '../../lib/data'
import { fmtMoney, fmtNum } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { Button, Field, NumberInput, useUi } from '../ui'

/** earn rate and point value; shown under Features when loyalty is on */
export function LoyaltySettings() {
  const { t } = useI18n()
  const { settings, db, firm } = useData()
  const { toast } = useUi()
  const sym = firm.currencySymbol
  const [earnPer, setEarnPer] = useState(settings.loyalty.earnPer)
  const [pointValue, setPointValue] = useState(settings.loyalty.pointValue)
  useEffect(() => { setEarnPer(settings.loyalty.earnPer); setPointValue(settings.loyalty.pointValue) }, [settings.loyalty])
  const dirty = earnPer !== settings.loyalty.earnPer || pointValue !== settings.loyalty.pointValue
  const valid = earnPer > 0 && pointValue >= 0

  // example: a bill of 10x the earn rate
  const bill = Math.max(1, earnPer) * 10
  const points = earnPer > 0 ? Math.floor(bill / earnPer) : 0
  const worth = points * pointValue
  const back = bill ? (worth / bill) * 100 : 0

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-stone-900"><Gift className="size-4 text-brand-700" />{t('ly_settings')}</h3>
      <p className="mb-3 text-sm text-stone-500">{t('ly_settingsText')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ly_earnPer', { sym })} hint={t('ly_earnPerHint')} error={earnPer > 0 ? undefined : t('errAmount')}>
          <NumberInput value={earnPer} onValue={(n) => setEarnPer(Math.max(0, n))} />
        </Field>
        <Field label={t('ly_pointValue', { sym })} hint={t('ly_pointValueHint')}>
          <NumberInput value={pointValue} onValue={(n) => setPointValue(Math.max(0, n))} />
        </Field>
      </div>
      {earnPer > 0 && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {t('ly_example', { bill: fmtMoney(bill, sym), points: fmtNum(points), worth: fmtMoney(worth, sym), pct: fmtNum(back) })}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!dirty || !valid}
          onClick={async () => { await updateSettings(db, { loyalty: { earnPer, pointValue } }); toast(t('setSaved')) }}
        >
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
