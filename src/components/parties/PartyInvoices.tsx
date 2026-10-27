import { FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnNewPath, txnPath } from '../../lib/paths'
import type { Party } from '../../lib/types'
import { Badge, Button, Empty, Select } from '../ui'

/** sale and purchase invoices of a party with paid / due and status */
export function PartyInvoices({ party }: { party: Party }) {
  const { t } = useI18n()
  const { txns, firm } = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const [show, setShow] = useState<'all' | 'open'>('all')
  const sym = firm.currencySymbol
  const now = today()

  const all = useMemo(() => txns
    .filter((x) => x.partyId === party.id && (x.type === 'sale' || x.type === 'purchase'))
    .map((x) => {
      const d = x.cancelled ? undefined : books.dues.get(x.id)
      const due = d?.due ?? 0
      return { x, d, due, overdue: !!x.dueDate && x.dueDate < now && due > 0.001 }
    }), [txns, party.id, books, now])

  const list = show === 'open' ? all.filter((r) => r.due > 0.001) : all
  const dueSale = all.filter((r) => r.x.type === 'sale').reduce((a, r) => a + r.due, 0)
  const duePurchase = all.filter((r) => r.x.type === 'purchase').reduce((a, r) => a + r.due, 0)
  const overdueCount = all.filter((r) => r.overdue).length

  if (all.length === 0) {
    return <Empty icon={<FileText className="size-7" />} title={t('pt_noInvoices')} text={t('pt_noInvoicesText')} />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Select value={show} onChange={(e) => setShow(e.target.value as 'all' | 'open')} className="w-auto min-w-40" aria-label={t('status')}>
          <option value="all">{t('pt_allInvoices')}</option>
          <option value="open">{t('pt_unpaidOnly')}</option>
        </Select>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {overdueCount > 0 && <Badge tone="bad">{t('pt_nOverdue', { n: overdueCount })}</Badge>}
          {dueSale > 0 && <span>{t('pt_dueFromSales')}: <b className="num text-emerald-700">{fmtMoney(dueSale, sym)}</b></span>}
          {duePurchase > 0 && <span>{t('pt_dueOnPurchases')}: <b className="num text-red-700">{fmtMoney(duePurchase, sym)}</b></span>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('type')}</th>
              <th>{t('number')}</th>
              <th>{t('pt_dueDate')}</th>
              <th className="r">{t('total')}</th>
              <th className="r">{t('paid')}</th>
              <th className="r">{t('pt_due')}</th>
              <th>{t('status')}</th>
              <th className="no-print" />
            </tr>
          </thead>
          <tbody>
            {list.map(({ x, d, due, overdue }) => (
              <tr key={x.id} className={cx(overdue && 'bg-red-50/70', x.cancelled && 'opacity-60')}>
                <td className="num whitespace-nowrap">{fmtDate(x.date)}</td>
                <td>{t('tt_' + x.type)}</td>
                <td className="num"><Link to={txnPath(x.type, x.id)} className="text-brand-700 hover:underline">{x.number}</Link></td>
                <td className={cx('num whitespace-nowrap', overdue && 'font-semibold text-red-700')}>{fmtDate(x.dueDate)}</td>
                <td className="r num">{fmtMoney(x.total, sym)}</td>
                <td className="r num">{d ? fmtMoney(d.paid, sym) : ''}</td>
                <td className={cx('r num font-medium', due > 0 && (x.type === 'sale' ? 'text-emerald-700' : 'text-red-700'))}>{d ? fmtMoney(due, sym) : ''}</td>
                <td>
                  {x.cancelled ? <Badge tone="neutral">{t('cancelled')}</Badge>
                    : overdue ? <Badge tone="bad">{t('overdue')}</Badge>
                    : d?.status === 'paid' ? <Badge tone="good">{t('paid')}</Badge>
                    : d?.status === 'partial' ? <Badge tone="warn">{t('partial')}</Badge>
                    : <Badge tone="info">{t('unpaid')}</Badge>}
                </td>
                <td className="no-print r">
                  {due > 0.001 && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => navigate(txnNewPath(x.type === 'sale' ? 'payment_in' : 'payment_out', `party=${party.id}`))}
                    >
                      {x.type === 'sale' ? t('pt_receive') : t('pt_pay')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>{t('total')}</td>
              <td className="r num">{fmtMoney(list.reduce((a, r) => a + (r.x.cancelled ? 0 : r.x.total), 0), sym)}</td>
              <td className="r num">{fmtMoney(list.reduce((a, r) => a + (r.d?.paid ?? 0), 0), sym)}</td>
              <td className="r num">{fmtMoney(list.reduce((a, r) => a + r.due, 0), sym)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
