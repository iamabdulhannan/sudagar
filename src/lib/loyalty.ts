import { round2 } from './format'
import type { ID, Settings, Txn } from './types'

/**
 * Loyalty points: customers earn 1 point for every `earnPer` spent on a sale (returns take
 * points back) and can spend points as a discount worth `pointValue` each. Nothing is stored
 * except `pointsRedeemed` on the bill; balances are worked out from the transactions.
 */

export function pointsEarned(t: Txn, s: Settings): number {
  if (!s.features.loyalty || !t.partyId || t.cancelled || s.loyalty.earnPer <= 0) return 0
  if (t.type === 'sale') return Math.floor(t.total / s.loyalty.earnPer)
  if (t.type === 'sale_return') return -Math.floor(t.total / s.loyalty.earnPer)
  return 0
}

export interface PointsSummary { earned: number; redeemed: number; balance: number }

export function pointsByParty(txns: Txn[], s: Settings): Map<ID, PointsSummary> {
  const out = new Map<ID, PointsSummary>()
  for (const t of txns) {
    if (!t.partyId || t.cancelled) continue
    const e = pointsEarned(t, s)
    const r = t.type === 'sale' ? t.pointsRedeemed || 0 : 0
    if (!e && !r) continue
    const p = out.get(t.partyId) ?? { earned: 0, redeemed: 0, balance: 0 }
    p.earned += e
    p.redeemed += r
    p.balance = p.earned - p.redeemed
    out.set(t.partyId, p)
  }
  return out
}

/** points a party can spend now; when editing a bill, pass it so its own redeemed points count as available */
export function pointsAvailable(txns: Txn[], s: Settings, partyId: ID, editing?: Txn): number {
  const p = pointsByParty(txns.filter((t) => t.id !== editing?.id), s).get(partyId)
  return Math.max(0, p?.balance ?? 0)
}

/** discount amount for redeeming points */
export const pointsValue = (points: number, s: Settings) => round2(points * s.loyalty.pointValue)
