import { round2 } from '../../lib/format'
import type { Item } from '../../lib/types'

/** bulk price update for many items at once (pure, used by BulkPriceModal and tests) */

export type PriceField = 'salePrice' | 'wholesalePrice' | 'purchasePrice' | 'mrp'
/** set to a value, or raise / lower the current price */
export type PriceOp = 'set' | 'increase' | 'decrease'
export type PriceBy = 'amount' | 'pct'
/** round the new price to the nearest 1, 5 or 10 (none keeps 2 decimals) */
export type PriceRound = 'none' | '1' | '5' | '10'

export interface PriceChange { field: PriceField; op: PriceOp; by: PriceBy; value: number; round: PriceRound }

export function newPrice(old: number, c: Omit<PriceChange, 'field'>): number {
  const v = Number(c.value) || 0
  let n: number
  if (c.op === 'set') n = v
  else {
    const delta = c.by === 'pct' ? (old * v) / 100 : v
    n = c.op === 'increase' ? old + delta : old - delta
  }
  n = Math.max(0, n)
  const step = c.round === 'none' ? 0 : Number(c.round)
  return step ? Math.round(n / step) * step : round2(n)
}

export interface PriceRow { item: Item; old: number; next: number }

/** old and new price of each item; items whose price does not change are left out */
export function previewPrices(items: Item[], c: PriceChange): PriceRow[] {
  return items
    .map((item) => {
      const old = item[c.field] ?? 0
      return { item, old, next: newPrice(old, c) }
    })
    .filter((r) => Math.abs(r.next - r.old) > 0.0001)
}
