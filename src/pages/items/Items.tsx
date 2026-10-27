import { scanLookup, useBarcodeScanner } from '../../lib/scanner'
import { Boxes, Download, FolderTree, Package, Plus, Printer, Tag, TrendingUp, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ImportItems } from '../../components/items/ImportItems'
import { BulkPriceModal } from '../../components/items/BulkPriceModal'
import { CategoryManager } from '../../components/items/CategoryManager'
import { ItemFormModal } from '../../components/items/ItemFormModal'
import { LabelsModal } from '../../components/items/LabelsModal'
import { ITEM_CSV_HEADERS, itemToRow } from '../../components/items/itemCsv'
import { fmtStock, matchItem, stockLevel, type StockLevel } from '../../components/items/itemUtils'
import { Badge, Button, Card, Empty, Money, PageHeader, SearchInput, Select, Stat, Tabs, useUi } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { cx } from '../../lib/cx'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import type { ID, Item, ItemKind } from '../../lib/types'

type StockFilter = 'all' | 'in' | 'low' | 'out'
type ActiveFilter = 'active' | 'inactive' | 'all'

const PAGE = 200

export default function Items() {
  const data = useData()
  const { items, categories, qty, settings, firm } = data
  const books = useBooks()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { toast } = useUi()
  // scan a product's barcode on this page to open it
  useBarcodeScanner((code) => {
    const hit = scanLookup(items, code)
    if (hit) navigate(itemPath(hit.item.id))
    else toast(t('posNotFound', { q: code }), 'error')
  })
  const [params, setParams] = useSearchParams()

  const kind: ItemKind = params.get('kind') === 'service' ? 'service' : 'product'
  const stock = (['in', 'low', 'out'].includes(params.get('stock') ?? '') ? params.get('stock') : 'all') as StockFilter
  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k) }
    setParams(p, { replace: true })
  }

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [active, setActive] = useState<ActiveFilter>('active')
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<Set<ID>>(new Set())
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [managing, setManaging] = useState(false)
  const [labels, setLabels] = useState<Item[] | null>(null)
  const [bulk, setBulk] = useState<Item[] | null>(null)

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const sym = firm.currencySymbol
  const alt = settings.features.altUnits

  const levels = useMemo(() => new Map(items.map((i) => [i.id, stockLevel(i, qty.get(i.id))])), [items, qty])

  const summary = useMemo(() => {
    let value = 0, low = 0, out = 0
    for (const i of items) {
      if (i.kind !== 'product') continue
      value += books.stock.get(i.id)?.value ?? 0
      if (!i.active) continue
      const l = levels.get(i.id)
      if (l === 'low') low++
      if (l === 'out') out++
    }
    return { count: items.length, value: round2(value), low, out }
  }, [items, books, levels])

  const counts = useMemo(() => ({
    product: items.filter((i) => i.kind === 'product').length,
    service: items.filter((i) => i.kind === 'service').length,
  }), [items])

  const rows = useMemo(() => items.filter((i) => {
    if (i.kind !== kind) return false
    if (active !== 'all' && i.active !== (active === 'active')) return false
    if (cat === '-' ? !!i.categoryId : cat && i.categoryId !== cat) return false
    if (kind === 'product' && stock !== 'all') {
      const l = levels.get(i.id) as StockLevel
      if (stock === 'in' && l === 'out') return false
      if (stock === 'low' && l !== 'low') return false
      if (stock === 'out' && l !== 'out') return false
    }
    return matchItem(i, q)
  }), [items, kind, active, cat, stock, levels, q])

  const shown = rows.slice(0, limit)
  const allSelected = shown.length > 0 && shown.every((i) => selected.has(i.id))
  const toggle = (id: ID) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) shown.forEach((i) => n.delete(i.id)); else shown.forEach((i) => n.add(i.id))
    return n
  })
  const selectedItems = items.filter((i) => selected.has(i.id))

  function exportCsv() {
    downloadCsv(`items-${today()}`, [...ITEM_CSV_HEADERS, 'stock_qty', 'stock_value', 'active'], rows.map((i) => [
      ...itemToRow(i, i.categoryId ? catName.get(i.categoryId) ?? '' : ''),
      i.kind === 'product' ? qty.get(i.id) ?? 0 : '',
      i.kind === 'product' ? round2(books.stock.get(i.id)?.value ?? 0) : '',
      i.active ? 'yes' : 'no',
    ]))
  }

  const statusBadge = (i: Item) => {
    const l = levels.get(i.id)
    return (
      <span className="flex flex-wrap gap-1">
        {!i.active && <Badge>{t('inactive')}</Badge>}
        {l === 'out' && <Badge tone="bad">{t('itOut')}</Badge>}
        {l === 'low' && <Badge tone="warn">{t('itLow')}</Badge>}
      </span>
    )
  }

  const qtyCls = (i: Item) => {
    const l = levels.get(i.id)
    return cx('num', l === 'out' ? 'text-red-700' : l === 'low' ? 'text-amber-700' : 'text-stone-800')
  }

  return (
    <div>
      <PageHeader
        title={t('navItems')}
        actions={<>
          {selected.size > 0 && <>
            <Button variant="secondary" onClick={() => setBulk(selectedItems)}>
              <TrendingUp className="size-4" />{t('itBulkN', { n: selected.size })}
            </Button>
            <Button variant="secondary" onClick={() => setLabels(selectedItems)}>
              <Printer className="size-4" />{t('itLabelsN', { n: selected.size })}
            </Button>
          </>}
          <Button variant="secondary" onClick={() => setManaging(true)}><FolderTree className="size-4" /><span className="hidden sm:inline">{t('itCategories')}</span></Button>
          <Button variant="secondary" onClick={() => setImporting(true)}><Upload className="size-4" /><span className="hidden sm:inline">{t('itImport')}</span></Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /><span className="hidden sm:inline">{t('exportCsv')}</span></Button>
          <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('itNew')}</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('itCount')} value={summary.count} icon={<Package className="size-4" />} />
        <Stat label={t('itStockValue')} value={<Money value={summary.value} symbol={sym} />} tone="brand" icon={<Boxes className="size-4" />} />
        <Stat label={t('itLowStock')} value={summary.low} tone={summary.low ? 'warn' : 'neutral'} onClick={() => setParam({ kind: null, stock: 'low' })} />
        <Stat label={t('itOutOfStock')} value={summary.out} tone={summary.out ? 'bad' : 'neutral'} onClick={() => setParam({ kind: null, stock: 'out' })} />
      </div>

      <Card padded={false}>
        <Tabs
          className="px-3 pt-1"
          value={kind}
          onChange={(v) => { setParam({ kind: v === 'service' ? 'service' : null }); setLimit(PAGE) }}
          tabs={[
            { value: 'product', label: t('itProducts'), count: counts.product },
            { value: 'service', label: t('itServices'), count: counts.service },
          ]}
        />
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_150px]">
          <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(PAGE) }} placeholder={t('itSearchPh')} />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('itCategory')}>
            <option value="">{t('itAllCategories')}</option>
            <option value="-">{t('itNoCategory')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {kind === 'product' ? (
            <Select value={stock} onChange={(e) => setParam({ stock: e.target.value === 'all' ? null : e.target.value })} aria-label={t('itStock')}>
              <option value="all">{t('itStockAll')}</option>
              <option value="in">{t('itStockIn')}</option>
              <option value="low">{t('itStockLow')}</option>
              <option value="out">{t('itStockOut')}</option>
            </Select>
          ) : <div className="hidden lg:block" />}
          <Select value={active} onChange={(e) => setActive(e.target.value as ActiveFilter)} aria-label={t('status')}>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
            <option value="all">{t('all')}</option>
          </Select>
        </div>

        {rows.length === 0 ? (
          <Empty
            icon={<Tag className="size-6" />}
            title={items.length ? t('noResults') : t('itEmptyTitle')}
            text={items.length ? undefined : t('itEmptyText')}
            action={!items.length && <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('itNew')}</Button>}
          />
        ) : (
          <>
            {/* desktop table */}
            <div className="table-wrap hidden md:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('itSelectAll')} className="size-4 accent-brand-700" /></th>
                    <th>{t('name')}</th>
                    <th>{t('itCategory')}</th>
                    <th className="r">{t('itSalePrice')}</th>
                    <th className="r">{t('itPurchasePrice')}</th>
                    {kind === 'product' && <><th className="r">{t('itStock')}</th><th className="r">{t('itStockValue')}</th></>}
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => (
                    <tr key={i.id} onClick={() => navigate(itemPath(i.id))} className={cx('cursor-pointer', !i.active && 'opacity-60')}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} aria-label={i.name} className="size-4 accent-brand-700" />
                      </td>
                      <td>
                        <div className="font-medium text-stone-900">{i.name}</div>
                        {(i.code || i.barcode) && <div className="num text-xs text-stone-500">{[i.code, i.barcode].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td className="text-stone-600">{i.categoryId ? catName.get(i.categoryId) : ''}</td>
                      <td className="r"><Money value={i.salePrice} symbol={sym} /></td>
                      <td className="r text-stone-600"><Money value={i.purchasePrice} symbol={sym} /></td>
                      {kind === 'product' && <>
                        <td className={cx('r whitespace-nowrap', qtyCls(i))}>{fmtStock(i, qty.get(i.id) ?? 0, alt)}</td>
                        <td className="r"><Money value={books.stock.get(i.id)?.value ?? 0} symbol={sym} /></td>
                      </>}
                      <td>{statusBadge(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* phone cards */}
            <ul className="divide-y divide-stone-100 md:hidden">
              {shown.map((i) => (
                <li key={i.id} className={cx('flex items-start gap-3 px-3 py-3', !i.active && 'opacity-60')}>
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} aria-label={i.name} className="mt-1 size-4 accent-brand-700" />
                  <button type="button" onClick={() => navigate(itemPath(i.id))} className="min-w-0 flex-1 text-start cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-stone-900">{i.name}</div>
                        <div className="truncate text-xs text-stone-500">
                          {[i.code, i.categoryId ? catName.get(i.categoryId) : ''].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <Money value={i.salePrice} symbol={sym} className="shrink-0 font-semibold" />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                      {i.kind === 'product'
                        ? <span className={qtyCls(i)}>{fmtStock(i, qty.get(i.id) ?? 0, alt)}</span>
                        : <span className="text-stone-500">{t('itService')}</span>}
                      {statusBadge(i)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-3 py-2 text-xs text-stone-500">
              <span className="num">{t('itShowing', { n: shown.length, total: rows.length })}</span>
              {rows.length > limit && <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>{t('more')}</Button>}
            </div>
          </>
        )}
      </Card>

      <ItemFormModal open={adding} onClose={() => setAdding(false)} />
      <ImportItems open={importing} onClose={() => setImporting(false)} />
      <CategoryManager open={managing} onClose={() => setManaging(false)} />
      <LabelsModal open={!!labels} items={labels ?? []} onClose={() => setLabels(null)} />
      <BulkPriceModal open={!!bulk} items={bulk ?? []} onClose={() => setBulk(null)} onDone={() => setSelected(new Set())} />
    </div>
  )
}
