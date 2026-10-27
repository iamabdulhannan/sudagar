import { ArrowLeftRight, ArrowRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { fmtDate } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Txn } from '../../lib/types'
import { DateRange, resolveRange, type Range } from '../DateRange'
import { Badge, Button, Empty, Money } from '../ui'
import { GodownSelect, useGodownName } from './StockBits'
import { StockTxnView } from './StockTxnView'
import { TransferForm } from './TransferForm'

/** list of stock transfers with filters, plus the new / edit form */
export function TransferList() {
  const { txns, firm } = useData()
  const { t } = useI18n()
  const godownName = useGodownName()
  const [range, setRange] = useState<Range>({ period: 'all' })
  const [godown, setGodown] = useState<ID>('')
  const [viewing, setViewing] = useState<Txn | null>(null)
  const [form, setForm] = useState<{ initial?: Txn } | null>(null)
  const { from, to } = useMemo(() => resolveRange(range), [range])

  const rows = useMemo(() => txns.filter((x) => {
    if (x.type !== 'stock_transfer') return false
    if (from && x.date < from) return false
    if (to && x.date > to) return false
    if (godown && (x.godownId || 'main') !== godown && (x.toGodownId || 'main') !== godown) return false
    return true
  }), [txns, from, to, godown])

  const newBtn = <Button onClick={() => setForm({})}><Plus className="size-4" />{t('stNewTransfer')}</Button>

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <DateRange value={range} onChange={setRange} />
        <GodownSelect value={godown} onChange={setGodown} all className="w-auto min-w-40" />
        <div className="ms-auto">{newBtn}</div>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<ArrowLeftRight className="size-6" />} title={t('stNoTransfers')} text={t('stNoTransfersText')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('date')}</th><th>{t('number')}</th><th>{t('stFromTo')}</th>
                <th className="r">{t('stLines')}</th><th className="r">{t('stTransferValue')}</th><th>{t('note')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} onClick={() => setViewing(x)} className="cursor-pointer">
                  <td className="num whitespace-nowrap">{fmtDate(x.date)}</td>
                  <td className="num font-medium text-brand-700">
                    {x.number}
                    {x.cancelled && <Badge tone="bad" className="ms-1">{t('cancelled')}</Badge>}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {godownName(x.godownId)}<ArrowRight className="size-3.5 text-stone-400 rtl:rotate-180" />{godownName(x.toGodownId)}
                    </span>
                  </td>
                  <td className="r num">{x.lines.length}</td>
                  <td className="r"><Money value={x.total} symbol={firm.currencySymbol} /></td>
                  <td className="max-w-56 truncate text-stone-600">{x.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StockTxnView txn={viewing} onClose={() => setViewing(null)} onEdit={(x) => { setViewing(null); setForm({ initial: x }) }} />
      <TransferForm open={!!form} initial={form?.initial} onClose={() => setForm(null)} />
    </div>
  )
}
