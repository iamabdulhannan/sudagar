import { useMemo } from 'react'
import { useBooks, useData } from '../../../lib/data'
import { MAIN_GODOWN } from '../../../lib/db'
import { fmtMoney, fmtQty, round2 } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { godownStock } from '../../../lib/ledger'
import type { ID, Txn } from '../../../lib/types'
import { stockShortages, type StockShort } from '../logic'
import { Notice } from './PaymentFields'

export interface FormWarnings {
  shortages: StockShort[]
  /** set when this sale takes the customer over the credit limit */
  credit?: { limit: number; balance: number }
}

/** same godown (empty = main) */
export const sameGodown = (a?: ID, b?: ID) => (a || MAIN_GODOWN) === (b || MAIN_GODOWN)

/** stock on hand per item: in one godown when godowns are on, otherwise in total */
export function useStockIn(godownId?: ID): Map<ID, number> {
  const { settings, items, txns, adjustments, qty } = useData()
  const on = settings.features.godowns
  const all = useMemo(() => (on ? godownStock(items, txns, adjustments) : null), [on, items, txns, adjustments])
  return useMemo(() => {
    if (!all) return qty
    const g = godownId || MAIN_GODOWN
    const m = new Map<ID, number>()
    for (const [id, by] of all) m.set(id, by.get(g) ?? 0)
    return m
  }, [all, qty, godownId])
}

/** stock and credit limit checks for the document being edited */
export function useWarnings(draft: Txn, original?: Txn): FormWarnings {
  const data = useData()
  const books = useBooks()
  const ns = data.settings.negativeStock
  const stock = useStockIn(draft.godownId)
  return useMemo(() => {
    // the saved document's quantities only come back to the godown they left from
    const orig = original && sameGodown(original.godownId, draft.godownId) ? original : undefined
    const shortages = ns === 'allow' ? [] : stockShortages(draft, stock, data.itemById, orig)
    let credit: FormWarnings['credit']
    const party = draft.partyId ? data.partyById.get(draft.partyId) : undefined
    if (party?.creditLimit && party.creditLimit > 0 && draft.type === 'sale') {
      let bal = books.balances.get(`party:${party.id}`) ?? 0
      if (original && !original.cancelled && original.partyId === party.id && original.type === 'sale') bal -= original.total - original.received
      const after = round2(bal + draft.total - draft.received)
      if (after > party.creditLimit + 0.001) credit = { limit: party.creditLimit, balance: after }
    }
    return { shortages, credit }
  }, [draft, original, ns, data, books, stock])
}

export function WarningNotes({ w }: { w: FormWarnings }) {
  const { t } = useI18n()
  const { settings, firm } = useData()
  if (!w.shortages.length && !w.credit) return null
  const block = settings.negativeStock === 'block'
  return (
    <div className="space-y-2">
      {w.shortages.map((s) => (
        <Notice key={s.itemId} tone={block ? 'error' : 'warn'}>
          {t('errNegativeStock', { name: s.name, qty: fmtQty(s.inStock) })} {block ? t('txStockBlocked') : t('txStockWarn')}
        </Notice>
      ))}
      {w.credit && (
        <Notice>{t('txCreditOver', { limit: fmtMoney(w.credit.limit, firm.currencySymbol), balance: fmtMoney(w.credit.balance, firm.currencySymbol) })}</Notice>
      )}
    </div>
  )
}
