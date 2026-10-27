import { ClipboardList, Factory, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/data'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import type { ID, Item } from '../../lib/types'
import { ItemFormModal } from '../items/ItemFormModal'
import { Button, Empty, IconButton, Money } from '../ui'
import { canMake } from './stockLogic'
import { useCost } from './useStock'

/** items that have a bill of materials, the cost of their materials and how many can be made from stock now */
export function BomList({ onMake }: { onMake: (itemId: ID) => void }) {
  const { items, itemById, qty, firm } = useData()
  const { t } = useI18n()
  const cost = useCost()
  const [editing, setEditing] = useState<Item | null>(null)
  const sym = firm.currencySymbol

  const rows = useMemo(() => items.filter((i) => i.kind === 'product' && i.bom?.length).map((i) => ({
    item: i,
    cost: round2(i.bom!.reduce((a, b) => a + b.qty * cost.byId(b.itemId), 0)),
    can: canMake(i.bom, (id) => qty.get(id) ?? 0),
  })), [items, cost, qty])

  if (!rows.length) {
    return <Empty icon={<ClipboardList className="size-6" />} title={t('stNoBoms')} text={t('stNoBomsText')} />
  }

  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('stItem')}</th><th>{t('stMaterials')}</th><th className="r">{t('stBomCostShort')}</th>
            <th className="r">{t('itSalePrice')}</th><th className="r">{t('stCanMake')}</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item.id}>
              <td><Link to={itemPath(r.item.id)} className="font-medium text-stone-900 hover:text-brand-700 hover:underline">{r.item.name}</Link></td>
              <td className="max-w-80 text-xs text-stone-600">
                {r.item.bom!.map((b) => `${itemById.get(b.itemId)?.name ?? '?'} ${b.qty} ${itemById.get(b.itemId)?.unit ?? ''}`).join(', ')}
              </td>
              <td className="r"><Money value={r.cost} symbol={sym} /></td>
              <td className="r text-stone-600"><Money value={r.item.salePrice} symbol={sym} /></td>
              <td className="r num font-semibold">{Number.isFinite(r.can) ? `${r.can} ${r.item.unit}` : '-'}</td>
              <td className="whitespace-nowrap text-end">
                <IconButton label={t('edit')} onClick={() => setEditing(r.item)}><Pencil className="size-4" /></IconButton>
                <Button size="sm" variant="secondary" onClick={() => onMake(r.item.id)}><Factory className="size-3.5" />{t('stMake')}</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ItemFormModal open={!!editing} initial={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  )
}
