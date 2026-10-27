import { Minus, Plus } from 'lucide-react'
import { useAccess } from '../../lib/access'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { fmtMoney, fmtNum } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Denoms } from '../../lib/types'
import { NumberInput } from '../ui'

/** who is at the counter: the PIN user, the signed-in account, or the owner */
export function useCashierName() {
  const { user } = useAccess()
  const auth = useAuth()
  const { firm } = useData()
  return user?.name || auth.name || firm.ownerName || 'Owner'
}

/** notes and coins with a count each; the total is the sum */
export function DenomCounter({ value, onChange }: { value: Denoms; onChange: (v: Denoms) => void }) {
  const { t } = useI18n()
  const { settings, firm } = useData()
  const denoms = settings.denominations?.length ? settings.denominations : [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1]
  const set = (d: number, n: number) => onChange({ ...value, [d]: Math.max(0, Math.floor(n || 0)) })
  const total = denoms.reduce((a, d) => a + d * (value[d] || 0), 0)
  return (
    <div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {denoms.map((d) => (
          <div key={d} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-surface px-2 py-1.5">
            <span className="num w-16 shrink-0 text-sm font-semibold text-stone-800">{fmtNum(d)}</span>
            <span className="text-xs text-stone-400">×</span>
            <button type="button" onClick={() => set(d, (value[d] || 0) - 1)} className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label={`- ${d}`}><Minus className="size-4" /></button>
            <NumberInput value={value[d] || 0} onValue={(n) => set(d, n)} className="h-8 w-14 px-1 text-center" aria-label={`${d}`} />
            <button type="button" onClick={() => set(d, (value[d] || 0) + 1)} className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label={`+ ${d}`}><Plus className="size-4" /></button>
            <span className="num ms-auto text-sm text-stone-600">{value[d] ? fmtNum(d * value[d]) : ''}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2">
        <span className="text-sm font-medium text-stone-700">{t('sh_total')}</span>
        <span className="num text-lg font-bold text-stone-900">{fmtMoney(total, firm.currencySymbol)}</span>
      </div>
    </div>
  )
}
