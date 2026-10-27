import { Barcode as BarcodeIcon, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { DEFAULT_UNITS, today, uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { Item, ItemKind } from '../../lib/types'
import { Button, Field, IconButton, Input, Modal, NumberInput, Select, Textarea, Toggle, useUi } from '../ui'
import { BomEditor } from '../stock/BomEditor'
import { generateEan13 } from './barcode'
import { itemSummary } from './itemUtils'
import { ScanButton } from './ScanButton'

type Errors = Partial<Record<keyof Item, string>>

const FORM_ID = 'item-form'

/** add or edit an item; fields follow the business's feature switches */
export function ItemFormModal({ open, onClose, initial, defaultName, onSaved }: {
  open: boolean
  onClose: () => void
  initial?: Item
  defaultName?: string
  onSaved?: (i: Item) => void
}) {
  const { db, items, categories, settings } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const f = settings.features

  const blank = (): Item => ({
    id: uid(), kind: 'product', name: defaultName ?? '', unit: 'pcs',
    salePrice: 0, purchasePrice: 0, taxRate: f.tax ? settings.defaultTaxRate : 0, priceIncludesTax: false,
    openingStock: 0, openingDate: today(), active: true, createdAt: Date.now(),
  })

  const [d, setD] = useState<Item>(blank)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setD(initial ? { ...initial } : blank())
    setErrors({})
    setNewCat(null)
  }, [open, initial, defaultName])

  const set = <K extends keyof Item>(k: K, v: Item[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const units = useMemo(() => {
    const s = new Set(DEFAULT_UNITS)
    for (const i of items) { if (i.unit) s.add(i.unit); if (i.altUnit) s.add(i.altUnit) }
    return [...s]
  }, [items])

  const taxRates = useMemo(() => {
    const r = new Set(settings.taxRates)
    r.add(d.taxRate || 0)
    return [...r].sort((a, b) => a - b)
  }, [settings.taxRates, d.taxRate])

  const others = items.filter((i) => i.id !== d.id)
  const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

  function check(x: Item): Errors {
    const e: Errors = {}
    if (!x.name.trim()) e.name = t('errRequired')
    else if (others.some((o) => same(o.name, x.name))) e.name = t('itErrDupName')
    if (!x.unit.trim()) e.unit = t('errRequired')
    const dupBar = x.barcode?.trim() && others.find((o) => same(o.barcode, x.barcode))
    if (dupBar) e.barcode = t('itErrDupBarcode', { name: dupBar.name })
    const dupCode = x.code?.trim() && others.find((o) => same(o.code, x.code))
    if (dupCode) e.code = t('itErrDupCode', { name: dupCode.name })
    for (const k of ['salePrice', 'purchasePrice', 'wholesalePrice', 'wholesaleMinQty', 'mrp', 'openingStock', 'openingCost', 'minStock'] as const) {
      if ((x[k] ?? 0) < 0) e[k] = t('itErrNegative')
    }
    if (f.altUnits && x.altUnit?.trim()) {
      if (same(x.altUnit, x.unit)) e.altUnit = t('itErrAltSame')
      if (!(x.altFactor && x.altFactor > 0)) e.altFactor = t('itErrAltFactor')
    }
    if (x.kind === 'product' && x.openingStock && !x.openingDate) e.openingDate = t('errDate')
    if (x.bom?.some((b) => b.itemId === x.id)) e.bom = t('stErrBomSelf')
    return e
  }

  function clean(x: Item): Item {
    const s = (v?: string) => (v && v.trim() ? v.trim() : undefined)
    const out: Item = {
      ...x,
      name: x.name.trim(), unit: x.unit.trim(), code: s(x.code), barcode: s(x.barcode), location: s(x.location),
      hsn: s(x.hsn), description: s(x.description), altUnit: s(x.altUnit),
      openingDate: x.openingDate || today(),
    }
    if (!out.altUnit) { out.altUnit = undefined; out.altFactor = undefined }
    if (out.kind === 'service') {
      out.openingStock = 0
      out.openingCost = undefined
      out.minStock = undefined
      out.altUnit = undefined
      out.altFactor = undefined
    }
    if (!out.wholesalePrice) { out.wholesalePrice = undefined; out.wholesaleMinQty = undefined }
    if (!out.mrp) out.mrp = undefined
    if (!out.openingCost) out.openingCost = undefined
    if (!out.minStock) out.minStock = undefined
    const bom = out.kind === 'product' ? (out.bom ?? []).filter((b) => b.qty > 0 && b.itemId !== out.id) : []
    out.bom = bom.length ? bom : undefined
    return out
  }

  async function save(again: boolean) {
    const e = check(d)
    if (Object.values(e).some(Boolean)) { setErrors(e); return }
    setSaving(true)
    try {
      const item = clean(d)
      await db.transaction('rw', [db.items, db.audit], async () => {
        await db.items.put(item)
        await db.audit.add({ at: Date.now(), action: initial ? 'update' : 'create', entity: 'item', entityId: item.id, summary: itemSummary(item) })
      })
      toast(t('itSaved'))
      onSaved?.(item)
      if (again) {
        setD({ ...blank(), name: '', kind: item.kind, categoryId: item.categoryId, unit: item.unit, taxRate: item.taxRate })
        setErrors({})
      } else onClose()
    } catch {
      toast(t('somethingWrong'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); save(false) }

  async function addCategory() {
    const name = (newCat ?? '').trim()
    if (!name) { setNewCat(null); return }
    const existing = categories.find((c) => same(c.name, name))
    if (existing) { set('categoryId', existing.id); setNewCat(null); return }
    const id = uid()
    await db.categories.add({ id, name })
    set('categoryId', id)
    setNewCat(null)
  }

  const genBarcode = () => set('barcode', generateEan13(new Set(items.map((i) => i.barcode ?? ''))))

  const isProduct = d.kind === 'product'
  const money = (k: 'salePrice' | 'purchasePrice' | 'wholesalePrice' | 'mrp' | 'openingCost', label: string, hint?: ReactNode) => (
    <Field label={label} error={errors[k]} hint={hint}>
      <NumberInput value={d[k] ?? 0} onValue={(n) => set(k, n)} min={0} />
    </Field>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? t('itEdit') : t('itNew')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        {!initial && !defaultName && !onSaved && <Button variant="secondary" onClick={() => save(true)} disabled={saving}>{t('saveNew')}</Button>}
        <Button type="submit" form={FORM_ID} loading={saving}>{t('save')}</Button>
      </>}
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="inline-flex rounded-lg border border-stone-300 p-0.5" role="radiogroup">
          {(['product', 'service'] as ItemKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={d.kind === k}
              onClick={() => set('kind', k)}
              className={cx('rounded-md px-4 py-1.5 text-sm font-medium cursor-pointer', d.kind === k ? 'bg-primary text-white' : 'text-stone-600 hover:bg-stone-100')}
            >
              {t(k === 'product' ? 'itProduct' : 'itService')}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('itName')} required error={errors.name} className="sm:col-span-2">
            <Input value={d.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label={t('itCode')} error={errors.code}>
            <Input value={d.code ?? ''} onChange={(e) => set('code', e.target.value)} />
          </Field>
          <Field label={t('itBarcode')} error={errors.barcode}>
            <div className="flex gap-2">
              <Input value={d.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} className="num" />
              <ScanButton onCode={(c) => set('barcode', c)} size="lg" className="border border-stone-300" />
              <Button variant="secondary" onClick={genBarcode} title={t('itGenerate')}>
                <BarcodeIcon className="size-4" /><span className="hidden sm:inline">{t('itGenerate')}</span>
              </Button>
            </div>
          </Field>
          <Field label={t('itCategory')}>
            {newCat === null ? (
              <div className="flex gap-2">
                <Select value={d.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || undefined)}>
                  <option value="">{t('itNoCategory')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <IconButton label={t('itAddCategory')} onClick={() => setNewCat('')} className="size-10 shrink-0 border border-stone-300">
                  <Plus className="size-4" />
                </IconButton>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCat}
                  autoFocus
                  placeholder={t('itCategoryName')}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addCategory() }
                    if (e.key === 'Escape') { e.stopPropagation(); setNewCat(null) }
                  }}
                />
                <Button variant="secondary" onClick={addCategory}>{t('add')}</Button>
              </div>
            )}
          </Field>
          <Field label={t('unit')} required error={errors.unit}>
            <Input value={d.unit} onChange={(e) => set('unit', e.target.value)} list="item-units" />
          </Field>
          {f.altUnits && isProduct && <>
            <Field label={t('itAltUnit')} error={errors.altUnit} hint={t('optional')}>
              <Input value={d.altUnit ?? ''} onChange={(e) => set('altUnit', e.target.value)} list="item-units" />
            </Field>
            <Field
              label={t('itAltFactor')}
              error={errors.altFactor}
              hint={d.altUnit && d.altFactor ? t('itAltHint', { alt: d.altUnit, n: d.altFactor, unit: d.unit }) : undefined}
            >
              <NumberInput value={d.altFactor ?? 0} onValue={(n) => set('altFactor', n || undefined)} disabled={!d.altUnit?.trim()} />
            </Field>
          </>}
          <datalist id="item-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
        </div>

        <Section title={t('itSecPricing')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {money('salePrice', t('itSalePrice'))}
            {money('purchasePrice', t('itPurchasePrice'))}
            {f.mrp && money('mrp', t('itMrp'))}
            {f.wholesale && <>
              {money('wholesalePrice', t('itWholesalePrice'))}
              <Field label={t('itWholesaleMinQty')} error={errors.wholesaleMinQty} hint={t('itWholesaleMinHint')}>
                <NumberInput value={d.wholesaleMinQty ?? 0} onValue={(n) => set('wholesaleMinQty', n)} disabled={!d.wholesalePrice} />
              </Field>
            </>}
            {f.tax && <>
              <Field label={`${t('itTaxRate')} (${settings.taxLabel})`}>
                <Select value={String(d.taxRate || 0)} onChange={(e) => set('taxRate', Number(e.target.value))} className="num">
                  {taxRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Toggle checked={d.priceIncludesTax} onChange={(v) => set('priceIncludesTax', v)} label={t('itPriceIncludesTax')} hint={t('itPriceIncludesTaxHint')} />
              </div>
            </>}
          </div>
        </Section>

        {isProduct && (
          <Section title={t('itSecStock')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`${t('itOpeningStock')} (${d.unit || '-'})`} error={errors.openingStock} hint={initial ? t('itOpeningEditHint') : undefined}>
                <NumberInput value={d.openingStock} onValue={(n) => set('openingStock', n)} />
              </Field>
              {money('openingCost', t('itOpeningCost'), t('itOpeningCostHint'))}
              <Field label={t('itOpeningDate')} error={errors.openingDate}>
                <Input type="date" value={d.openingDate} onChange={(e) => set('openingDate', e.target.value)} />
              </Field>
              <Field label={t('itMinStock')} error={errors.minStock} hint={t('itMinStockHint')}>
                <NumberInput value={d.minStock ?? 0} onValue={(n) => set('minStock', n)} />
              </Field>
              <Field label={t('itLocation')}>
                <Input value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} />
              </Field>
            </div>
          </Section>
        )}

        {f.manufacturing && isProduct && (
          <Section title={t('stBomTitle')}>
            <BomEditor itemId={d.id} unit={d.unit} value={d.bom ?? []} onChange={(v) => set('bom', v)} />
            {errors.bom && <p className="mt-2 text-xs text-red-600">{errors.bom}</p>}
          </Section>
        )}

        <Section title={t('itSecMore')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('itHsn')}>
              <Input value={d.hsn ?? ''} onChange={(e) => set('hsn', e.target.value)} />
            </Field>
            <div className="sm:pt-5">
              <Toggle checked={d.active} onChange={(v) => set('active', v)} label={t('itActive')} />
            </div>
            <Field label={t('itDescription')} className="sm:col-span-2">
              <Textarea value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={2} />
            </Field>
          </div>
        </Section>
        {/* lets Enter in any field submit */}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 pt-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}
