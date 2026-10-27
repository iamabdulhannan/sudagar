import { MAIN_GODOWN } from '../../lib/db'
import { fmtMoney, round2, round3 } from '../../lib/format'
import type { BomLine, Godown, ID, Item, Txn, TxnLine } from '../../lib/types'

/**
 * Pure helpers of the stock module (godowns, transfers, manufacturing, catalogue).
 * Nothing here touches React or the database, so it is easy to test.
 */

/** godown → item → qty, from godownStock's item → godown → qty */
export function godownQty(stock: Map<ID, Map<ID, number>>, godownId: ID): Map<ID, number> {
  const out = new Map<ID, number>()
  for (const [itemId, m] of stock) out.set(itemId, m.get(godownId || MAIN_GODOWN) ?? 0)
  return out
}

/** cost of 1 base unit: weighted average cost, or the purchase price when there is no cost yet */
export function unitCost(item: Item | undefined, avgCost: number | undefined): number {
  if (!item) return 0
  return avgCost && avgCost > 0 ? avgCost : item.purchasePrice || item.openingCost || 0
}

/** materials needed to make `qty` units from a bill of materials (base units of each component) */
export function bomMaterials(bom: BomLine[] | undefined, qty: number): BomLine[] {
  if (!bom?.length || !(qty > 0)) return []
  return bom.filter((b) => b.qty > 0).map((b) => ({ itemId: b.itemId, qty: round3(b.qty * qty) }))
}

/**
 * would adding `componentId` to the bill of materials of `itemId` make a loop?
 * (the component, or anything it is made from, is made from the item itself)
 */
export function makesLoop(itemId: ID, componentId: ID, itemById: Map<ID, Item>, seen = new Set<ID>()): boolean {
  if (componentId === itemId) return true
  if (seen.has(componentId)) return false
  seen.add(componentId)
  const bom = itemById.get(componentId)?.bom ?? []
  return bom.some((b) => makesLoop(itemId, b.itemId, itemById, seen))
}

/** how many whole units can be made from the stock available (Infinity when the BOM is empty) */
export function canMake(bom: BomLine[] | undefined, available: (itemId: ID) => number): number {
  const parts = (bom ?? []).filter((b) => b.qty > 0)
  if (!parts.length) return Infinity
  return Math.max(0, Math.min(...parts.map((b) => Math.floor(round3(available(b.itemId) / b.qty)))))
}

export interface Shortage { itemId: ID; need: number; have: number }

/** items whose total quantity on the lines (base units) is more than what is available */
export function shortages(lines: Pick<TxnLine, 'itemId' | 'qty' | 'factor'>[], available: (itemId: ID) => number, isProduct: (itemId: ID) => boolean): Shortage[] {
  const need = new Map<ID, number>()
  for (const l of lines) {
    if (!l.itemId || !isProduct(l.itemId)) continue
    need.set(l.itemId, round3((need.get(l.itemId) ?? 0) + (Number(l.qty) || 0) * (l.factor || 1)))
  }
  const out: Shortage[] = []
  for (const [itemId, n] of need) {
    const have = available(itemId)
    if (n > have + 0.0005) out.push({ itemId, need: n, have })
  }
  return out
}

export interface CostPreview { materials: number; charges: number; total: number; unitCost: number }

/** cost of a manufacturing entry: materials at their rates plus making charges, and the cost of 1 unit made */
export function costPreview(lines: Pick<TxnLine, 'qty' | 'rate'>[], charges: number, outputQty: number): CostPreview {
  const materials = round2(lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0))
  const c = round2(Math.max(0, charges || 0))
  const total = round2(materials + c)
  return { materials, charges: c, total, unitCost: outputQty > 0 ? round2(total / outputQty) : 0 }
}

// ---------- godown-wise stock summary ----------

export interface GodownSummaryRow {
  godown: Godown
  /** products with stock above 0 here */
  items: number
  /** products below 0 here (sold or moved out before being received) */
  negative: number
  /** base units in stock (positive only) */
  qty: number
  /** value of the positive stock at average cost */
  value: number
}

export function godownSummary(
  items: Item[], stock: Map<ID, Map<ID, number>>, godowns: Godown[], cost: (item: Item) => number,
): { rows: GodownSummaryRow[]; total: Omit<GodownSummaryRow, 'godown'> } {
  const rows = new Map<ID, GodownSummaryRow>(godowns.map((g) => [g.id, { godown: g, items: 0, negative: 0, qty: 0, value: 0 }]))
  for (const item of items) {
    if (item.kind !== 'product') continue
    const m = stock.get(item.id)
    if (!m) continue
    for (const [gid, q] of m) {
      const r = rows.get(gid)
      if (!r) continue
      if (q > 0) {
        r.items++
        r.qty = round3(r.qty + q)
        r.value = round2(r.value + q * cost(item))
      } else if (q < 0) r.negative++
    }
  }
  const list = [...rows.values()].filter((r) => r.godown.active || r.items || r.negative)
  const total = list.reduce((a, r) => ({ items: a.items + r.items, negative: a.negative + r.negative, qty: round3(a.qty + r.qty), value: round2(a.value + r.value) }), { items: 0, negative: 0, qty: 0, value: 0 })
  return { rows: list, total }
}

// ---------- production register ----------

export interface ProductionRow {
  txn: Txn
  itemId?: ID
  qty: number
  materials: number
  charges: number
  total: number
  unitCost: number
}

export interface ProductionByItem { itemId: ID; qty: number; materials: number; charges: number; total: number; unitCost: number; entries: number }

/** manufacturing entries in a date range (oldest first) with totals and a summary per item made */
export function productionRegister(txns: Txn[], from?: string, to?: string) {
  const rows: ProductionRow[] = txns
    .filter((t) => t.type === 'manufacture' && !t.cancelled && (!from || t.date >= from) && (!to || t.date <= to))
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => {
      const qty = t.outputQty || 0
      const materials = round2(t.subtotal)
      const charges = round2(t.charges || 0)
      const total = round2(materials + charges)
      return { txn: t, itemId: t.outputItemId, qty, materials, charges, total, unitCost: qty > 0 ? round2(total / qty) : 0 }
    })
  const by = new Map<ID, ProductionByItem>()
  for (const r of rows) {
    if (!r.itemId) continue
    const b = by.get(r.itemId) ?? { itemId: r.itemId, qty: 0, materials: 0, charges: 0, total: 0, unitCost: 0, entries: 0 }
    b.qty = round3(b.qty + r.qty)
    b.materials = round2(b.materials + r.materials)
    b.charges = round2(b.charges + r.charges)
    b.total = round2(b.total + r.total)
    b.entries++
    b.unitCost = b.qty > 0 ? round2(b.total / b.qty) : 0
    by.set(r.itemId, b)
  }
  const totals = rows.reduce((a, r) => ({ materials: round2(a.materials + r.materials), charges: round2(a.charges + r.charges), total: round2(a.total + r.total) }), { materials: 0, charges: 0, total: 0 })
  return { rows, byItem: [...by.values()].sort((a, b) => b.total - a.total), totals }
}


// ---------- catalogue ----------

export type CataloguePrice = 'retail' | 'wholesale' | 'none'

export function cataloguePrice(item: Item, price: CataloguePrice): number | undefined {
  if (price === 'none') return undefined
  if (price === 'wholesale') return item.wholesalePrice || item.salePrice
  return item.salePrice
}

/**
 * a plain-text price list for WhatsApp: title, one line per item grouped by category, and the firm's phone.
 * `labels` carries the translated words so this stays pure.
 */
export function catalogueText(opts: {
  firmName: string
  phone?: string
  title: string
  date: string
  groups: { name: string; items: Item[] }[]
  price: CataloguePrice
  symbol: string
  showCode: boolean
  stockNote?: (item: Item) => string
  labels: { phone: string; per: string }
}): string {
  const lines: string[] = [`*${opts.firmName}*`, opts.title, opts.date, '']
  for (const g of opts.groups) {
    if (!g.items.length) continue
    if (g.name) lines.push(`*${g.name}*`)
    for (const i of g.items) {
      const p = cataloguePrice(i, opts.price)
      const code = opts.showCode && i.code ? ` (${i.code})` : ''
      const priceText = p !== undefined ? `: ${fmtMoney(p, opts.symbol)} ${opts.labels.per} ${i.unit}` : ''
      const note = opts.stockNote?.(i)
      lines.push(`- ${i.name}${code}${priceText}${note ? ` [${note}]` : ''}`)
    }
    lines.push('')
  }
  if (opts.phone) lines.push(`${opts.labels.phone}: ${opts.phone}`)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** WhatsApp share link with no phone number, so the user picks the chat */
export const waShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
