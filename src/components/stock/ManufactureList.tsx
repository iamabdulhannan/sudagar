import { Factory, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { fmtDate, fmtQty, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Txn } from '../../lib/types'
import { DateRange, resolveRange, type Range } from '../DateRange'
import { Badge, Button, Empty, Money } from '../ui'
import { StockTxnView } from './StockTxnView'

/** manufacturing entries: what was made, materials cost, making charges and cost per unit */
export function ManufactureList({ onMake, onEdit }: { onMake: () => void; onEdit: (t: Txn) => void }) {
  const { txns, itemById, firm } = useData()
  const { t } = useI18n()
  const [range, setRange] = useState<Range>({ period: 'all' })
  const [viewing, setViewing] = useState<Txn | null>(null)
  const { from, to } = useMemo(() => resolveRange(range), [range])
  const sym = firm.currencySymbol

  const rows = useMemo(
    () => txns.filter((x) => x.type === 'manufacture' && (!from || x.date >= from) && (!to || x.date <= to)),
    [txns, from, to],
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <DateRange value={range} onChange={setRange} />
        <div className="ms-auto"><Button onClick={onMake}><Plus className="size-4" />{t('stMakeItems')}</Button></div>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<Factory className="size-6" />} title={t('stNoMade')} text={t('stNoMadeText')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('date')}</th><th>{t('number')}</th><th>{t('stItemMade')}</th><th className="r">{t('stQtyMade')}</th>
                <th className="r">{t('stMaterialsCost')}</th><th className="r">{t('stCharges')}</th><th className="r">{t('stUnitCost')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const item = x.outputItemId ? itemById.get(x.outputItemId) : undefined
                const unit = x.outputQty ? round2(x.total / x.outputQty) : 0
                return (
                  <tr key={x.id} onClick={() => setViewing(x)} className="cursor-pointer">
                    <td className="num whitespace-nowrap">{fmtDate(x.date)}</td>
                    <td className="num font-medium text-brand-700">
                      {x.number}
                      {x.cancelled && <Badge tone="bad" className="ms-1">{t('cancelled')}</Badge>}
                    </td>
                    <td className="font-medium">{item?.name ?? '-'}</td>
                    <td className="r num whitespace-nowrap">{fmtQty(x.outputQty ?? 0)} {item?.unit}</td>
                    <td className="r"><Money value={x.subtotal} symbol={sym} /></td>
                    <td className="r text-stone-600"><Money value={x.charges} symbol={sym} /></td>
                    <td className="r font-semibold"><Money value={unit} symbol={sym} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <StockTxnView txn={viewing} onClose={() => setViewing(null)} onEdit={(x) => { setViewing(null); onEdit(x) }} />
    </div>
  )
}
