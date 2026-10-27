import { ListOrdered } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useBooks, useData } from '../../lib/data'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnPath } from '../../lib/paths'
import { TXN_META } from '../../lib/txn'
import type { Party, Txn, TxnType } from '../../lib/types'
import { ChequeBadge } from '../txn/StatusBadge'
import { Badge, Empty, Select } from '../ui'

/** every document of a party (including estimates and orders), newest first */
export function PartyTxns({ party }: { party: Party }) {
  const { t } = useI18n()
  const { txns, firm } = useData()
  const books = useBooks()
  const [type, setType] = useState<TxnType | ''>('')
  const all = useMemo(() => txns.filter((x) => x.partyId === party.id), [txns, party.id])
  const types = useMemo(() => [...new Set(all.map((x) => x.type))], [all])
  const list = type ? all.filter((x) => x.type === type) : all

  if (all.length === 0) return <Empty icon={<ListOrdered className="size-7" />} title={t('pt_noTxns')} text={t('pt_noTxnsText')} />

  const status = (x: Txn) => {
    if (x.cancelled) return <Badge>{t('cancelled')}</Badge>
    if (x.paymentMode === 'cheque' && x.chequeStatus) return <ChequeBadge txn={x} />
    if (!TXN_META[x.type].posts) return x.status === 'converted' ? <Badge tone="good">{t('converted')}</Badge> : <Badge tone="info">{t('open')}</Badge>
    const d = books.dues.get(x.id)
    if (!d) return null
    return d.status === 'paid' ? <Badge tone="good">{t('paid')}</Badge> : d.status === 'partial' ? <Badge tone="warn">{t('partial')}</Badge> : <Badge tone="info">{t('unpaid')}</Badge>
  }

  return (
    <div>
      <div className="p-4">
        <Select value={type} onChange={(e) => setType(e.target.value as TxnType | '')} className="w-auto min-w-48" aria-label={t('type')}>
          <option value="">{t('pt_allTypes')}</option>
          {types.map((k) => <option key={k} value={k}>{t('tp_' + k)}</option>)}
        </Select>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('type')}</th>
              <th>{t('number')}</th>
              <th className="r">{t('amount')}</th>
              <th>{t('status')}</th>
              <th>{t('notes')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className={cx(x.cancelled && 'opacity-60')}>
                <td className="num whitespace-nowrap">{fmtDate(x.date)}</td>
                <td>{t('tt_' + x.type)}</td>
                <td className="num"><Link to={txnPath(x.type, x.id)} className="text-brand-700 hover:underline">{x.number}</Link></td>
                <td className={cx('r num', x.cancelled && 'line-through')}>{fmtMoney(x.total, firm.currencySymbol)}</td>
                <td>{status(x)}</td>
                <td className="max-w-64 truncate text-stone-500">{x.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
