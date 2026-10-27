import { ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { round2, round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Item } from '../../lib/types'
import { fmtStock } from '../items/itemUtils'
import { Button, Money } from '../ui'
import { TransferForm } from './TransferForm'
import { useCost, useGodownStock } from './useStock'

/** item detail tab: quantity and value of this item in each godown */
export function ItemGodowns({ item }: { item: Item }) {
  const { godowns, settings, firm } = useData()
  const { t } = useI18n()
  const stock = useGodownStock()
  const cost = useCost()
  const [moving, setMoving] = useState(false)
  const by = stock.get(item.id) ?? new Map<string, number>()
  const rows = godowns.filter((g) => g.active || (by.get(g.id) ?? 0) !== 0)
  const each = cost.ofItem(item)
  const total = round3([...by.values()].reduce((a, v) => a + v, 0))
  const alt = settings.features.altUnits
  const sym = firm.currencySymbol

  return (
    <div>
      <div className="flex justify-end p-3">
        <Button size="sm" variant="secondary" onClick={() => setMoving(true)}><ArrowLeftRight className="size-4" />{t('stNewTransfer')}</Button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>{t('stGodown')}</th><th className="r">{t('itStock')}</th><th className="r">{t('itStockValue')}</th></tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const q = by.get(g.id) ?? 0
              return (
                <tr key={g.id}>
                  <td className="font-medium">{g.name}{!g.active && <span className="ms-1 text-xs text-stone-500">({t('inactive')})</span>}</td>
                  <td className={cx('r num', q < 0 ? 'text-red-700' : q === 0 ? 'text-stone-400' : '')}>{fmtStock(item, q, alt)}</td>
                  <td className="r"><Money value={round2(Math.max(0, q) * each)} symbol={sym} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('total')}</td>
              <td className="r num">{fmtStock(item, total, alt)}</td>
              <td className="r"><Money value={round2(Math.max(0, total) * each)} symbol={sym} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <TransferForm open={moving} onClose={() => setMoving(false)} />
    </div>
  )
}
