import { AlertTriangle, PackageCheck, PartyPopper, Receipt, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { fmtDate, fmtMoney, fmtQty } from '../../lib/format'
import { itemPath, reportPath, txnPath } from '../../lib/paths'
import type { ItemProfitRow, LowStockRow, OverdueRow } from '../../lib/reports'
import { TXN_META } from '../../lib/txn'
import type { Txn } from '../../lib/types'
import { Badge, Card } from '../ui'

function ViewAll({ to }: { to: string }) {
  const { t } = useI18n()
  return <Link to={to} className="text-sm font-medium text-brand-700 hover:underline">{t('viewAll')}</Link>
}

function Nothing({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-stone-500">
      <span className="text-stone-300">{icon}</span>
      {text}
    </div>
  )
}

/** best sellers this month: quantity and amount, with a bar for share of the top seller */
export function TopItems({ rows, symbol }: { rows: ItemProfitRow[]; symbol: string }) {
  const { t } = useI18n()
  const max = Math.max(1, ...rows.map((r) => r.sales))
  return (
    <Card title={t('dash_topItems')} actions={<ViewAll to={reportPath('itemprofit')} />} padded={false}>
      {rows.length === 0 ? <Nothing icon={<TrendingUp className="size-8" />} text={t('dash_noSalesMonth')} /> : (
        <ol className="divide-y divide-stone-100">
          {rows.map((r, i) => (
            <li key={r.itemId} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link to={itemPath(r.itemId)} className="min-w-0 truncate font-medium text-stone-800 hover:text-brand-700">
                  <span className="num me-1.5 text-stone-400">{i + 1}</span>{r.name}
                </Link>
                <span className="num shrink-0 font-semibold text-stone-900">{fmtMoney(r.sales, symbol)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, (r.sales / max) * 100)}%` }} />
                </div>
                <span className="num shrink-0 text-xs text-stone-500">{fmtQty(r.qty)} {r.unit}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export function LowStockPanel({ rows }: { rows: LowStockRow[] }) {
  const { t } = useI18n()
  return (
    <Card title={<span className="flex items-center gap-2">{t('dash_lowStock')}{rows.length > 0 && <Badge tone="warn">{rows.length}</Badge>}</span>} actions={<ViewAll to={reportPath('lowstock')} />} padded={false}>
      {rows.length === 0 ? <Nothing icon={<PackageCheck className="size-8" />} text={t('dash_stockOk')} /> : (
        <ul className="divide-y divide-stone-100">
          {rows.slice(0, 6).map((r) => (
            <li key={r.item.id}>
              <Link to={itemPath(r.item.id)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-stone-50">
                <span className="min-w-0 truncate font-medium text-stone-800">{r.item.name}</span>
                <span className="shrink-0 text-end">
                  <span className={`num font-semibold ${r.qty <= 0 ? 'text-red-700' : 'text-amber-700'}`}>{fmtQty(r.qty)} {r.item.unit}</span>
                  <span className="num block text-xs text-stone-500">{t('dash_min', { n: fmtQty(r.min) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function OverduePanel({ rows, symbol }: { rows: OverdueRow[]; symbol: string }) {
  const { t } = useI18n()
  return (
    <Card title={<span className="flex items-center gap-2">{t('dash_overdue')}{rows.length > 0 && <Badge tone="bad">{rows.length}</Badge>}</span>} actions={<ViewAll to={reportPath('aging')} />} padded={false}>
      {rows.length === 0 ? <Nothing icon={<PartyPopper className="size-8" />} text={t('dash_noOverdue')} /> : (
        <ul className="divide-y divide-stone-100">
          {rows.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link to={txnPath(r.type, r.id)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-stone-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-800">{r.partyName || t('walkIn')}</span>
                  <span className="block text-xs text-stone-500">
                    <span className="num">{r.number}</span> · {r.type === 'purchase' ? t('payable') : t('receivable')}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="num block font-semibold text-stone-900">{fmtMoney(r.due, symbol)}</span>
                  <span className="flex items-center justify-end gap-1 text-xs text-red-700"><AlertTriangle className="size-3" />{t('dash_daysLate', { n: r.days })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function RecentTxns({ txns, partyName, symbol }: { txns: Txn[]; partyName: (t: Txn) => string; symbol: string }) {
  const { t } = useI18n()
  return (
    <Card title={t('dash_recent')} actions={<ViewAll to={reportPath('alltxns')} />} padded={false}>
      {txns.length === 0 ? <Nothing icon={<Receipt className="size-8" />} text={t('dash_noTxns')} /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('date')}</th><th>{t('number')}</th><th>{t('type')}</th><th>{t('dash_party')}</th><th className="r">{t('amount')}</th></tr>
            </thead>
            <tbody>
              {txns.map((x) => (
                <tr key={x.id}>
                  <td className="num whitespace-nowrap">{fmtDate(x.date)}</td>
                  <td><Link to={txnPath(x.type, x.id)} className="num font-medium text-brand-700 hover:underline">{x.number || '-'}</Link></td>
                  <td className="whitespace-nowrap">{t(TXN_META[x.type].label)}{x.cancelled && <Badge tone="bad" className="ms-2">{t('cancelled')}</Badge>}</td>
                  <td className="max-w-48 truncate">{partyName(x) || '-'}</td>
                  <td className="r num">{fmtMoney(x.total, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
