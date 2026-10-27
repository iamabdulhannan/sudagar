import { EllipsisVertical, Eye, Pencil, Printer } from 'lucide-react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { fmtDate } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { Badge, IconButton, Money } from '../ui'
import type { ListColumns, ListRow } from './columns'
import { Menu } from './Menu'
import { isStockDoc } from './logic'
import { isSplit } from './payLogic'
import { ChequeBadge, StatusBadge } from './StatusBadge'
import { useTxnActions } from './useTxnActions'
import { useSplitText } from './ViewPanels'

/** transactions as a table (sm and up) and as cards (phones) */
export function TxnTable({ rows, cols }: { rows: ListRow[]; cols: ListColumns }) {
  const { t } = useI18n()
  const { firm } = useData()
  const act = useTxnActions()
  const splitText = useSplitText()
  const sym = firm.currencySymbol
  const struck = (r: ListRow) => (r.t.cancelled ? 'line-through text-stone-400' : '')

  const more = (r: ListRow) => (
    <Menu label={t('more')} items={act.rowMenu(r.t)} className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
      <EllipsisVertical className="size-4" />
    </Menu>
  )

  return (
    <>
      <div className="table-wrap hidden rounded-xl border border-stone-200 bg-surface shadow-sm sm:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('number')}</th>
              {cols.party && <th>{t('txParty')}</th>}
              {cols.extra.map((k) => <th key={k}>{t(k)}</th>)}
              <th className="r">{t('total')}</th>
              {cols.paid && <th className="r">{t(cols.paidKey)}</th>}
              {cols.due && <th className="r">{t('txBalanceDue')}</th>}
              {cols.status && <th>{t('status')}</th>}
              <th className="r no-print"><span className="sr-only">{t('actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t.id} className="cursor-pointer" onClick={() => act.view(r.t)}>
                <td className="num whitespace-nowrap text-stone-600">{fmtDate(r.t.date)}</td>
                <td className="whitespace-nowrap">
                  <span className={cx('num font-medium text-brand-700', struck(r))}>{r.t.number}</span>
                  {r.t.pos && <Badge className="ms-1.5">POS</Badge>}
                  {r.t.cancelled && !cols.status && <StatusBadge status="cancelled" className="ms-1.5" />}
                </td>
                {cols.party && <td className={cx('max-w-56 truncate', struck(r))}>{r.party || <span className="text-stone-400">-</span>}</td>}
                {r.extra.map((v, i) => (
                  <td key={i} className={cx('max-w-48 truncate text-stone-600', struck(r))}>
                    {cols.extra[i] === 'txChequeStatus' ? <ChequeBadge txn={r.t} /> : v}
                  </td>
                ))}
                <td className={cx('r font-semibold', struck(r))}><Money value={r.t.total} symbol={sym} /></td>
                {cols.paid && (
                  <td className="r text-stone-600">
                    <Money value={r.paid} symbol={sym} />
                    {isSplit(r.t) && <div className="max-w-48 truncate text-[11px] text-stone-500" title={splitText(r.t)}>{splitText(r.t)}</div>}
                  </td>
                )}
                {cols.due && <td className={cx('r', r.due > 0.001 ? 'font-semibold text-red-700' : 'text-stone-400')}><Money value={r.due} symbol={sym} /></td>}
                {cols.status && <td><StatusBadge status={r.status} /></td>}
                <td className="r no-print" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <IconButton label={t('txView')} onClick={() => act.view(r.t)}><Eye className="size-4" /></IconButton>
                    <IconButton label={t('print')} onClick={() => act.print(r.t)}><Printer className="size-4" /></IconButton>
                    {!r.t.cancelled && !isStockDoc(r.t.type) && <IconButton label={t('edit')} onClick={() => act.edit(r.t)}><Pencil className="size-4" /></IconButton>}
                    {more(r)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.t.id} className="rounded-xl border border-stone-200 bg-surface shadow-sm">
            <div className="flex items-start gap-2 p-3">
              <button type="button" onClick={() => act.view(r.t)} className="min-w-0 flex-1 cursor-pointer text-start">
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('truncate font-semibold text-stone-900', struck(r))}>{r.party || r.extra[0] || r.t.number}</span>
                  <Money value={r.t.total} symbol={sym} className={cx('font-bold', struck(r))} />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span className="num">{r.t.number} · {fmtDate(r.t.date)}</span>
                  {cols.due && r.due > 0.001 && <span className="text-red-700">{t('txDue')}: <Money value={r.due} symbol={sym} /></span>}
                </div>
                {(r.status || r.extra.length > 0 || isSplit(r.t)) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    <StatusBadge status={r.status ?? (r.t.cancelled ? 'cancelled' : undefined)} />
                    <ChequeBadge txn={r.t} />
                    {r.extra.filter((v, i) => v && cols.extra[i] !== 'txChequeStatus').slice(0, 2).map((v, i) => <span key={i} className="truncate">{v}</span>)}
                    {isSplit(r.t) && <span className="truncate">{splitText(r.t)}</span>}
                  </div>
                )}
              </button>
              {more(r)}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
