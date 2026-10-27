import type { FirmData } from '../../lib/data'
import { fmtQty, round3 } from '../../lib/format'
import type { ID, Item } from '../../lib/types'

/** stock level of a product: services have none */
export type StockLevel = 'ok' | 'low' | 'out' | 'none'

export function stockLevel(item: Item, qty: number | undefined): StockLevel {
  if (item.kind !== 'product') return 'none'
  const q = qty ?? 0
  if (q <= 0) return 'out'
  if (item.minStock !== undefined && item.minStock > 0 && q <= item.minStock) return 'low'
  return 'ok'
}

/**
 * quantity in words with the alt unit split: 40 pcs with 1 carton = 12 pcs gives "3 carton 4 pcs".
 * Without an alt unit (or with altUnits off) it is "40 pcs".
 */
export function fmtStock(item: Item, qty: number, altUnits: boolean): string {
  const q = round3(qty)
  if (!altUnits || !item.altUnit || !item.altFactor || item.altFactor <= 1 || Math.abs(q) < item.altFactor) {
    return `${fmtQty(q)} ${item.unit}`
  }
  const sign = q < 0 ? '-' : ''
  const abs = Math.abs(q)
  const big = Math.floor(abs / item.altFactor)
  const rest = round3(abs - big * item.altFactor)
  return `${sign}${fmtQty(big)} ${item.altUnit}${rest ? ` ${fmtQty(rest)} ${item.unit}` : ''}`
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/** does the item match a search text (name, code or barcode)? */
export function matchItem(item: Item, q: string): boolean {
  const s = norm(q)
  if (!s) return true
  return norm(item.name).includes(s) || norm(item.code).includes(s) || norm(item.barcode).includes(s)
}

/** an item whose barcode or code is exactly the text (what a scanner types) */
export function exactCodeMatch(items: Item[], q: string): Item | undefined {
  const s = norm(q)
  if (!s) return undefined
  return items.find((i) => norm(i.barcode) === s) ?? items.find((i) => norm(i.code) === s)
}

/** search ranking: exact code / barcode, then names starting with the text, then the rest */
export function searchItems(items: Item[], q: string, limit = 50): Item[] {
  const s = norm(q)
  if (!s) return items.slice(0, limit)
  const scored: [number, Item][] = []
  for (const i of items) {
    const name = norm(i.name), code = norm(i.code), bar = norm(i.barcode)
    let score = -1
    if (bar === s || code === s) score = 0
    else if (name.startsWith(s) || code.startsWith(s)) score = 1
    else if (name.split(/\s+/).some((w) => w.startsWith(s))) score = 2
    else if (name.includes(s) || code.includes(s) || bar.includes(s)) score = 3
    if (score >= 0) scored.push([score, i])
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
  return scored.slice(0, limit).map((x) => x[1])
}

/** has the item been used on any transaction or adjustment? (then it cannot be deleted) */
export function isItemUsed(data: FirmData, id: ID): boolean {
  return data.txns.some((t) => t.lines.some((l) => l.itemId === id)) || data.adjustments.some((a) => a.itemId === id)
}

/** text printed under / encoded in the barcode of a label */
export const labelCode = (item: Item) => (item.barcode || item.code || '').trim()

/** a short summary for audit rows */
export const itemSummary = (item: Item) => `${item.name}${item.code ? ` (${item.code})` : ''}`

/** days from today to a YYYY-MM-DD date (negative = past) */
export function daysUntil(date: string, from = new Date()): number {
  const d = new Date(date + 'T00:00:00')
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((d.getTime() - f.getTime()) / 86400000)
}
