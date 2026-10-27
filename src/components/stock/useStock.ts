import { useCallback, useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { MAIN_GODOWN } from '../../lib/db'
import { godownStock } from '../../lib/ledger'
import type { ID, Item } from '../../lib/types'
import { godownQty, unitCost } from './stockLogic'

/** quantity of every item in every godown (item → godown → base units), rebuilt when data changes */
export function useGodownStock() {
  const { items, txns, adjustments } = useData()
  return useMemo(() => godownStock(items, txns, adjustments), [items, txns, adjustments])
}

/** stock per item in one godown, or the total stock when godowns are off */
export function useStockIn(godownId: ID | undefined) {
  const { qty, settings } = useData()
  const all = useGodownStock()
  return useMemo(
    () => (settings.features.godowns ? godownQty(all, godownId || MAIN_GODOWN) : qty),
    [settings.features.godowns, all, godownId, qty],
  )
}

/** cost of 1 base unit of an item (weighted average, or purchase price before any stock moved) */
export function useCost() {
  const books = useBooks()
  const { itemById } = useData()
  const byId = useCallback((id: ID | undefined) => (id ? unitCost(itemById.get(id), books.stock.get(id)?.avgCost) : 0), [books, itemById])
  const ofItem = useCallback((i: Item) => unitCost(i, books.stock.get(i.id)?.avgCost), [books])
  return { byId, ofItem }
}

/** godowns that can be picked (active ones, plus the one already chosen) */
export function useGodownOptions(current?: ID) {
  const { godowns } = useData()
  return useMemo(() => godowns.filter((g) => g.active || g.id === current || (!current && g.id === MAIN_GODOWN)), [godowns, current])
}
