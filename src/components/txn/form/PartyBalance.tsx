import { Link } from 'react-router-dom'
import { cx } from '../../../lib/cx'
import { useBooks, useData } from '../../../lib/data'
import { useI18n } from '../../../lib/i18n'
import { partyPath } from '../../../lib/paths'
import type { ID } from '../../../lib/types'
import { Money } from '../../ui'

/** current balance of a party: "To receive Rs 5,000" / "To pay Rs 2,000" */
export function PartyBalance({ partyId, className }: { partyId?: ID; className?: string }) {
  const { t } = useI18n()
  const { partyById, firm } = useData()
  const books = useBooks()
  const p = partyId ? partyById.get(partyId) : undefined
  if (!p) return null
  const bal = books.balances.get(`party:${p.id}`) ?? 0
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500', className)}>
      <span>
        {t('txCurrentBalance')}:{' '}
        <Money value={Math.abs(bal)} symbol={firm.currencySymbol} className={cx('font-semibold', bal > 0.001 ? 'text-red-700' : bal < -0.001 ? 'text-emerald-700' : 'text-stone-700')} />
        {Math.abs(bal) > 0.001 && <span> ({t(bal > 0 ? 'receivable' : 'payable')})</span>}
      </span>
      {p.phone && <span className="num">{p.phone}</span>}
      {p.creditLimit ? <span>{t('txCreditLimit')}: <Money value={p.creditLimit} symbol={firm.currencySymbol} /></span> : null}
      <Link to={partyPath(p.id)} className="text-brand-700 hover:underline">{t('txPartyLedger')}</Link>
    </div>
  )
}
