import { today, uid } from '../../lib/db'
import { round2 } from '../../lib/format'
import type { Category, Item, ItemKind, Settings } from '../../lib/types'

/** columns of the items CSV (import template and export) */
export const ITEM_CSV_HEADERS = [
  'name', 'kind', 'code', 'barcode', 'category', 'unit', 'sale_price', 'purchase_price', 'wholesale_price', 'wholesale_min_qty',
  'mrp', 'tax_rate', 'price_includes_tax', 'opening_stock', 'opening_cost', 'min_stock', 'alt_unit', 'alt_factor',
  'location', 'hsn', 'description',
] as const

type Col = (typeof ITEM_CSV_HEADERS)[number]

export const ITEM_CSV_SAMPLE: string[][] = [
  ['Lux soap 100g', 'product', 'LUX100', '8964000012345', 'Toiletries', 'pcs', '120', '95', '110', '12', '125', '0', 'no', '48', '95', '12', 'carton', '48', 'A1', '', ''],
  ['Mobile repair', 'service', 'SRV-1', '', 'Services', 'job', '1500', '0', '', '', '', '0', 'no', '', '', '', '', '', '', '', 'Labour only'],
]

/** an item as a CSV row in ITEM_CSV_HEADERS order */
export function itemToRow(i: Item, categoryName: string): (string | number)[] {
  return [
    i.name, i.kind, i.code ?? '', i.barcode ?? '', categoryName, i.unit, i.salePrice, i.purchasePrice, i.wholesalePrice ?? '',
    i.wholesaleMinQty ?? '', i.mrp ?? '', i.taxRate, i.priceIncludesTax ? 'yes' : 'no', i.openingStock, i.openingCost ?? '',
    i.minStock ?? '', i.altUnit ?? '', i.altFactor ?? '', i.location ?? '', i.hsn ?? '', i.description ?? '',
  ]
}

export interface RowProblem { key: string; vars?: Record<string, string | number> }

export interface ImportRow {
  /** line number in the file (1 = header) */
  line: number
  item: Item
  categoryName?: string
  problems: RowProblem[]
}

export interface ImportResult {
  rows: ImportRow[]
  /** problem with the whole file (no name column, empty) */
  fileProblem?: RowProblem
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/** turn parsed CSV rows (first row = headers) into items to add, checking each row */
export function readItemRows(csv: string[][], existing: Item[], settings: Settings): ImportResult {
  if (csv.length < 2) return { rows: [], fileProblem: { key: 'itImpEmpty' } }
  const head = csv[0].map((h) => norm(h).replace(/[\s-]+/g, '_'))
  const idx = Object.fromEntries(ITEM_CSV_HEADERS.map((c) => [c, head.indexOf(c)])) as Record<Col, number>
  if (idx.name < 0) return { rows: [], fileProblem: { key: 'itImpNoName' } }

  const names = new Set(existing.map((i) => norm(i.name)))
  const codes = new Set(existing.map((i) => norm(i.code)).filter(Boolean))
  const barcodes = new Set(existing.map((i) => norm(i.barcode)).filter(Boolean))
  const rows: ImportRow[] = []
  const now = Date.now()

  csv.slice(1).forEach((r, n) => {
    const problems: RowProblem[] = []
    const get = (c: Col) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '')
    const number = (c: Col, fallback?: number): number | undefined => {
      const v = get(c).replace(/,/g, '')
      if (!v) return fallback
      const x = Number(v)
      if (!Number.isFinite(x) || x < 0) { problems.push({ key: 'itImpBadNumber', vars: { col: c } }); return fallback }
      return x
    }
    const name = get('name')
    if (!name) problems.push({ key: 'itImpNoItemName' })
    else if (names.has(norm(name))) problems.push({ key: 'itImpExists', vars: { name } })

    const kindRaw = norm(get('kind'))
    let kind: ItemKind = 'product'
    if (kindRaw === 'service' || kindRaw === 's') kind = 'service'
    else if (kindRaw && kindRaw !== 'product' && kindRaw !== 'p') problems.push({ key: 'itImpBadKind' })

    const code = get('code') || undefined
    if (code && codes.has(norm(code))) problems.push({ key: 'itImpDupCode', vars: { code } })
    const barcode = get('barcode') || undefined
    if (barcode && barcodes.has(norm(barcode))) problems.push({ key: 'itImpDupBarcode', vars: { code: barcode } })

    const altUnit = get('alt_unit') || undefined
    const altFactor = number('alt_factor')
    if (altUnit && !(altFactor && altFactor > 0)) problems.push({ key: 'itErrAltFactor' })
    const wholesalePrice = number('wholesale_price')
    const yes = ['yes', 'y', 'true', '1'].includes(norm(get('price_includes_tax')))
    const isProduct = kind === 'product'

    const item: Item = {
      id: uid(), kind, name, code, barcode,
      unit: get('unit') || (isProduct ? 'pcs' : 'job'),
      altUnit: isProduct && altUnit ? altUnit : undefined,
      altFactor: isProduct && altUnit ? altFactor : undefined,
      salePrice: round2(number('sale_price', 0)!),
      purchasePrice: round2(number('purchase_price', 0)!),
      wholesalePrice: wholesalePrice ? round2(wholesalePrice) : undefined,
      wholesaleMinQty: wholesalePrice ? number('wholesale_min_qty') : undefined,
      mrp: number('mrp') || undefined,
      taxRate: number('tax_rate', settings.features.tax ? settings.defaultTaxRate : 0)!,
      priceIncludesTax: yes,
      openingStock: isProduct ? number('opening_stock', 0)! : 0,
      openingCost: isProduct ? number('opening_cost') || undefined : undefined,
      openingDate: today(),
      minStock: isProduct ? number('min_stock') || undefined : undefined,
      location: get('location') || undefined,
      hsn: get('hsn') || undefined,
      description: get('description') || undefined,
      active: true,
      createdAt: now + n,
    }
    if (!problems.length) {
      names.add(norm(name))
      if (code) codes.add(norm(code))
      if (barcode) barcodes.add(norm(barcode))
    }
    rows.push({ line: n + 2, item, categoryName: get('category') || undefined, problems })
  })
  return { rows }
}

/** categories to create for the rows, and the category id each row gets */
export function resolveCategories(rows: ImportRow[], categories: Category[]): { create: Category[]; items: Item[] } {
  const byName = new Map(categories.map((c) => [norm(c.name), c.id]))
  const create: Category[] = []
  const items = rows.map((r) => {
    if (!r.categoryName) return r.item
    let id = byName.get(norm(r.categoryName))
    if (!id) {
      id = uid()
      byName.set(norm(r.categoryName), id)
      create.push({ id, name: r.categoryName })
    }
    return { ...r.item, categoryId: id }
  })
  return { create, items }
}
