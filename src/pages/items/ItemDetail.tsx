import { ArrowLeft, ClipboardList, Factory, Pencil, Power, Printer, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdjustmentModal } from '../../components/items/AdjustmentModal'
import { ItemBatches, ItemAdjustments, ItemMovements } from '../../components/items/ItemTabs'
import { ItemFormModal } from '../../components/items/ItemFormModal'
import { LabelsModal } from '../../components/items/LabelsModal'
import { ItemGodowns } from '../../components/stock/ItemGodowns'
import { fmtStock, isItemUsed, itemSummary, stockLevel } from '../../components/items/itemUtils'
import { Badge, Button, Empty, Money, PageHeader, Stat, Tabs, useUi } from '../../components/ui'
import { useBooks, useData } from '../../lib/data'
import { fmtNum, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Item } from '../../lib/types'

export default function ItemDetail() {
  const { id } = useParams()
  const { itemById } = useData()
  const { t } = useI18n()
  const item = id ? itemById.get(id) : undefined
  if (!item) {
    return (
      <Empty
        icon={<ClipboardList className="size-6" />}
        title={t('itNotFound')}
        action={<Link to="/items" className="text-sm font-medium text-brand-700 hover:underline">{t('back')}</Link>}
      />
    )
  }
  return <ItemView key={item.id} item={item} />
}

type Tab = 'txns' | 'adjustments' | 'batches' | 'godowns'

function ItemView({ item }: { item: Item }) {
  const data = useData()
  const { db, qty, settings, firm, categories, adjustments } = data
  const books = useBooks()
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const f = settings.features
  const sym = firm.currencySymbol
  const [tab, setTab] = useState<Tab>('txns')
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [labels, setLabels] = useState(false)

  const isProduct = item.kind === 'product'
  const onHand = qty.get(item.id) ?? 0
  const st = books.stock.get(item.id)
  const avgCost = st && st.avgCost > 0 ? st.avgCost : item.purchasePrice
  const level = stockLevel(item, onHand)
  const category = categories.find((c) => c.id === item.categoryId)?.name
  const adjCount = useMemo(() => adjustments.filter((a) => a.itemId === item.id).length, [adjustments, item.id])

  // margin on the price before tax
  const netSale = f.tax && item.priceIncludesTax ? item.salePrice / (1 + (item.taxRate || 0) / 100) : item.salePrice
  const cost = isProduct ? avgCost : item.purchasePrice
  const margin = netSale > 0 ? round2(((netSale - cost) / netSale) * 100) : 0

  async function toggleActive() {
    await db.transaction('rw', [db.items, db.audit], async () => {
      await db.items.update(item.id, { active: !item.active })
      await db.audit.add({ at: Date.now(), action: 'update', entity: 'item', entityId: item.id, summary: `${itemSummary(item)} ${item.active ? 'deactivated' : 'activated'}` })
    })
    toast(item.active ? t('itDeactivated') : t('itActivated'))
  }

  async function remove() {
    if (isItemUsed(data, item.id)) {
      const ok = await confirm({ title: t('itCannotDelete'), text: t('itCannotDeleteText'), okLabel: item.active ? t('itDeactivate') : t('close') })
      if (ok && item.active) await toggleActive()
      return
    }
    if (!(await confirm({ title: t('itDeleteTitle', { name: item.name }), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    await db.transaction('rw', [db.items, db.audit], async () => {
      await db.items.delete(item.id)
      await db.audit.add({ at: Date.now(), action: 'delete', entity: 'item', entityId: item.id, summary: itemSummary(item) })
    })
    toast(t('deleted'))
    navigate('/items')
  }

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'txns', label: t('itTabTxns') },
    ...(isProduct ? [{ value: 'adjustments' as Tab, label: t('itTabAdjustments'), count: adjCount }] : []),
    ...(isProduct && f.batches ? [{ value: 'batches' as Tab, label: t('itTabBatches') }] : []),
    ...(isProduct && f.godowns ? [{ value: 'godowns' as Tab, label: t('itTabGodowns') }] : []),
  ]

  return (
    <div>
      <PageHeader
        back={
          <Link to="/items" className="mb-1 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('navItems')}
          </Link>
        }
        title={<span className="flex flex-wrap items-center gap-2">{item.name}{!item.active && <Badge>{t('inactive')}</Badge>}</span>}
        subtitle={[item.code, item.barcode, category, t(isProduct ? 'itProduct' : 'itService'), item.location].filter(Boolean).join(' · ')}
        actions={<>
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" />{t('edit')}</Button>
          {isProduct && <Button variant="secondary" onClick={() => setAdjusting(true)}><SlidersHorizontal className="size-4" />{t('itAdjust')}</Button>}
          {isProduct && f.manufacturing && !!item.bom?.length && (
            <Link to={`/manufacturing?make=${item.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-surface px-4 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50">
              <Factory className="size-4" />{t('stMake')}
            </Link>
          )}
          <Button variant="secondary" onClick={() => setLabels(true)}><Printer className="size-4" /><span className="hidden sm:inline">{t('itPrintLabels')}</span></Button>
          <Button variant="secondary" onClick={toggleActive}><Power className="size-4" /><span className="hidden sm:inline">{item.active ? t('itDeactivate') : t('itActivate')}</span></Button>
          <Button variant="ghost" onClick={remove} className="text-red-700 hover:bg-red-50"><Trash2 className="size-4" /><span className="hidden sm:inline">{t('delete')}</span></Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {isProduct && (
          <Stat
            label={t('itStock')}
            value={fmtStock(item, onHand, f.altUnits)}
            tone={level === 'out' ? 'bad' : level === 'low' ? 'warn' : 'neutral'}
            hint={item.minStock ? t('itMinStockIs', { n: fmtNum(item.minStock), unit: item.unit }) : undefined}
          />
        )}
        {isProduct && <Stat label={t('itStockValue')} value={<Money value={st?.value ?? 0} symbol={sym} />} tone="brand" />}
        <Stat label={isProduct ? t('itAvgCost') : t('itPurchasePrice')} value={<Money value={cost} symbol={sym} />} hint={isProduct ? t('itPerUnit', { unit: item.unit }) : undefined} />
        <Stat
          label={t('itSalePrice')}
          value={<Money value={item.salePrice} symbol={sym} />}
          hint={f.wholesale && item.wholesalePrice ? `${t('itWholesalePrice')}: ${fmtNum(item.wholesalePrice)}` : undefined}
        />
        <Stat label={t('itMargin')} value={`${fmtNum(margin)}%`} tone={margin < 0 ? 'bad' : margin > 0 ? 'good' : 'neutral'} />
      </div>

      <div className="rounded-xl border border-stone-200 bg-surface shadow-sm">
        <Tabs className="px-3 pt-1" value={tab} onChange={setTab} tabs={tabs} />
        {tab === 'txns' && <ItemMovements item={item} />}
        {tab === 'adjustments' && <ItemAdjustments item={item} onAdd={() => setAdjusting(true)} />}
        {tab === 'batches' && <ItemBatches item={item} />}
        {tab === 'godowns' && <ItemGodowns item={item} />}
      </div>

      <ItemFormModal open={editing} initial={item} onClose={() => setEditing(false)} />
      {isProduct && <AdjustmentModal open={adjusting} item={item} onClose={() => setAdjusting(false)} />}
      <LabelsModal open={labels} items={labelItems(item)} onClose={() => setLabels(false)} />
    </div>
  )
}

/** stable array so the labels modal does not reset its counts on every render */
const labelCache = new WeakMap<Item, Item[]>()
function labelItems(item: Item): Item[] {
  let a = labelCache.get(item)
  if (!a) { a = [item]; labelCache.set(item, a) }
  return a
}
