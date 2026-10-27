import { BookOpen, Copy, MessageCircle, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { matchItem } from '../../components/items/itemUtils'
import { printNode } from '../../components/PrintPortal'
import { CatalogueSheet, type CatalogueGroup } from '../../components/stock/CatalogueSheet'
import { cataloguePrice, catalogueText, waShareUrl, type CataloguePrice } from '../../components/stock/stockLogic'
import { Button, Card, Empty, Field, Input, Money, PageHeader, SearchInput, Select, Toggle, useUi } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Item } from '../../lib/types'

/** pick items and send a price list / catalogue to customers: printed A4 or a WhatsApp message */
export default function Catalogue() {
  const { items, categories, qty, settings, firm } = useData()
  const { t, dir } = useI18n()
  const { toast } = useUi()
  const f = settings.features
  const sym = firm.currencySymbol

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [inStock, setInStock] = useState(false)
  const [price, setPrice] = useState<CataloguePrice>('retail')
  const [showCode, setShowCode] = useState(false)
  const [showStock, setShowStock] = useState(false)
  const [byCategory, setByCategory] = useState(true)
  const [title, setTitle] = useState('')
  // items are in the list unless unticked
  const [left, setLeft] = useState<Set<ID>>(new Set())

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const inStockNow = (i: Item) => i.kind !== 'product' || (qty.get(i.id) ?? 0) > 0

  const shown = useMemo(() => items.filter((i) => {
    if (!i.active) return false
    if (cat === '-' ? !!i.categoryId : cat && i.categoryId !== cat) return false
    if (inStock && !inStockNow(i)) return false
    return matchItem(i, q)
  }), [items, cat, inStock, q, qty])
  const chosen = shown.filter((i) => !left.has(i.id))

  const toggle = (id: ID) => setLeft((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const all = chosen.length === shown.length
  const toggleAll = () => setLeft((s) => {
    const n = new Set(s)
    if (all) shown.forEach((i) => n.add(i.id)); else shown.forEach((i) => n.delete(i.id))
    return n
  })

  const groups = useMemo(() => {
    if (!byCategory) return [{ name: '', items: chosen }]
    const m = new Map<string, Item[]>()
    for (const i of chosen) {
      const k = i.categoryId ?? ''
      m.set(k, [...(m.get(k) ?? []), i])
    }
    return [...m.entries()]
      .map(([k, list]) => ({ name: k ? catName.get(k) ?? '' : t('ctOther'), items: list }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [chosen, byCategory, catName, t])

  const docTitle = title.trim() || t('ctDefaultTitle')
  const stockNote = (i: Item) => (showStock && i.kind === 'product' ? (inStockNow(i) ? t('ctInStock') : t('ctOutOfStock')) : '')

  function print() {
    if (!chosen.length) return
    const sheetGroups: CatalogueGroup[] = groups.map((g) => ({
      name: g.name,
      items: g.items.map((i) => {
        const p = cataloguePrice(i, price)
        return {
          id: i.id, name: i.name, unit: i.unit, code: showCode ? i.code : undefined,
          price: p !== undefined ? fmtMoney(p, sym) : undefined,
          note: stockNote(i) || undefined, out: !inStockNow(i),
        }
      }),
    }))
    printNode(
      <CatalogueSheet
        firm={firm} title={docTitle} date={fmtDate(today())} groups={sheetGroups} dir={dir}
        labels={{ phone: t('phone'), code: t('ctCode'), per: t('ctPer'), count: t('ctItemsN') }}
      />,
      'A4',
    )
  }

  const message = () => catalogueText({
    firmName: firm.name, phone: firm.phone, title: docTitle, date: fmtDate(today()).replace(/[⁦-⁩]/g, ''),
    groups, price, symbol: sym, showCode, stockNote, labels: { phone: t('phone'), per: t('ctPer') },
  })

  function share() {
    if (!chosen.length) return
    window.open(waShareUrl(message()), '_blank', 'noopener')
  }

  async function copy() {
    if (!chosen.length) return
    try {
      await navigator.clipboard.writeText(message())
      toast(t('ctCopied'))
    } catch {
      toast(t('somethingWrong'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title={t('navCatalogue')}
        subtitle={t('ctSub')}
        actions={<>
          <Button variant="secondary" onClick={copy} disabled={!chosen.length}><Copy className="size-4" /><span className="hidden sm:inline">{t('ctCopyText')}</span></Button>
          <Button variant="success" onClick={share} disabled={!chosen.length}><MessageCircle className="size-4" />{t('ctWhatsApp')}</Button>
          <Button onClick={print} disabled={!chosen.length}><Printer className="size-4" />{t('ctPrint')}</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title={t('ctOptions')} className="h-fit">
          <div className="space-y-3">
            <Field label={t('ctTitle')}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ctDefaultTitle')} />
            </Field>
            <Field label={t('ctPriceShown')}>
              <Select value={price} onChange={(e) => setPrice(e.target.value as CataloguePrice)}>
                <option value="retail">{t('ctRetail')}</option>
                {f.wholesale && <option value="wholesale">{t('ctWholesale')}</option>}
                <option value="none">{t('ctNoPrice')}</option>
              </Select>
            </Field>
            <div className="divide-y divide-stone-100">
              <Toggle checked={byCategory} onChange={setByCategory} label={t('ctGroup')} />
              <Toggle checked={showCode} onChange={setShowCode} label={t('ctShowCode')} />
              <Toggle checked={showStock} onChange={setShowStock} label={t('ctShowStock')} hint={t('ctShowStockHint')} />
            </div>
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">{t('ctShareHint')}</p>
          </div>
        </Card>

        <Card padded={false}>
          <div className="grid gap-2 border-b border-stone-100 p-3 sm:grid-cols-[1fr_200px_auto]">
            <SearchInput value={q} onChange={setQ} placeholder={t('itSearchPh')} />
            <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('itCategory')}>
              <option value="">{t('itAllCategories')}</option>
              <option value="-">{t('itNoCategory')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex items-center"><Toggle checked={inStock} onChange={setInStock} label={t('ctInStockOnly')} /></div>
          </div>
          {shown.length === 0 ? (
            <Empty icon={<BookOpen className="size-6" />} title={items.length ? t('noResults') : t('itEmptyTitle')} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-stone-700">
                  <input type="checkbox" checked={all} onChange={toggleAll} className="size-4 accent-brand-700" />
                  {t('itSelectAll')}
                </label>
                <span className="num text-stone-500">{t('ctChosen', { n: chosen.length, total: shown.length })}</span>
              </div>
              <ul className="grid gap-2 p-3 pt-0 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((i) => {
                  const on = !left.has(i.id)
                  const p = cataloguePrice(i, price)
                  return (
                    <li key={i.id}>
                      <label className={cx('flex cursor-pointer items-start gap-2 rounded-lg border p-2.5', on ? 'border-brand-600 bg-brand-50/40' : 'border-stone-200 opacity-60')}>
                        <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="mt-0.5 size-4 accent-brand-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-900">{i.name}</span>
                          <span className="block truncate text-xs text-stone-500">
                            {[i.code, i.categoryId ? catName.get(i.categoryId) : ''].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          {p !== undefined && <Money value={p} symbol={sym} className="block text-sm font-semibold" />}
                          {i.kind === 'product' && !inStockNow(i) && <span className="block text-[11px] text-red-700">{t('ctOutOfStock')}</span>}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
