import type { FirmData } from '../../lib/data'
import { MAIN_GODOWN } from '../../lib/db'
import { fmtDate, fmtQty } from '../../lib/format'
import type { InvoiceDue } from '../../lib/ledger'
import type { Txn, TxnType } from '../../lib/types'
import { amountPaid, balanceDue, docStatus, isDraftDoc, isInvoice, isReturn, type DocStatus } from './logic'

/** one list row, worked out once and shared by the table, the cards and the CSV */
export interface ListRow {
  t: Txn
  party: string
  status?: DocStatus
  paid: number
  due: number
  /** type-specific columns, same order as listColumns().extra */
  extra: string[]
}

export interface ListColumns {
  party: boolean
  /** i18n keys of the type-specific columns */
  extra: string[]
  paid: boolean
  due: boolean
  status: boolean
  /** i18n key of the "paid" column */
  paidKey: string
}

export function listColumns(type: TxnType, data: FirmData): ListColumns {
  const extra: string[] = []
  if (isInvoice(type) && data.settings.features.dueDates) extra.push('txDueDate')
  if (isReturn(type)) extra.push('txAgainstInvoice')
  if (type === 'expense') extra.push('txExpenseHead')
  if (type === 'other_income') extra.push('txIncomeHead', 'txAccount')
  if (type === 'payment_in' || type === 'payment_out') extra.push('txAccount', 'txMode', 'txChequeRef', 'txChequeStatus')
  if (type === 'transfer') extra.push('txFromAccount', 'txToAccount')
  if (type === 'capital_in' || type === 'drawing') extra.push('txAccount', 'txMode', 'notes')
  if (type === 'stock_transfer') extra.push('txFromGodown', 'txToGodown', 'txLinesCount')
  if (type === 'manufacture') extra.push('txItemMade', 'txQtyMade', 'txLinesCount')
  if (type === 'purchase') extra.push('txSupplierBillNo')
  const money = isInvoice(type) || isReturn(type) || type === 'expense'
  return {
    party: !['transfer', 'other_income', 'capital_in', 'drawing', 'stock_transfer', 'manufacture'].includes(type),
    extra,
    paid: money,
    due: money,
    status: isInvoice(type) || isDraftDoc(type),
    paidKey: type === 'sale' ? 'txReceived' : type === 'sale_return' ? 'txRefunded' : 'paid',
  }
}

export function buildRow(t: Txn, cols: ListColumns, data: FirmData, dues: Map<string, InvoiceDue>, todayStr: string, tr: (k: string) => string): ListRow {
  const acc = (id?: string) => (id ? data.accountById.get(id)?.name ?? '' : '')
  const godown = (id?: string) => data.godowns.find((g) => g.id === (id || MAIN_GODOWN))?.name ?? ''
  const cat = (id?: string) => (id ? data.moneyCategories.find((c) => c.id === id)?.name ?? '' : tr('la_other'))
  const party = t.partyId ? data.partyById.get(t.partyId)?.name ?? '' : t.partyName || (t.type === 'sale' || t.type === 'estimate' || t.type === 'sale_return' ? tr('walkIn') : '')
  const extra = cols.extra.map((k) => {
    switch (k) {
      case 'txDueDate': return fmtDate(t.dueDate)
      case 'txAgainstInvoice': return (t.againstId && data.txnById.get(t.againstId)?.number) || t.refNo || ''
      case 'txExpenseHead': case 'txIncomeHead': return cat(t.categoryId)
      case 'txAccount': case 'txFromAccount': return acc(t.accountId)
      case 'txToAccount': return acc(t.toAccountId)
      case 'txMode': return t.paymentMode ? tr('pm_' + t.paymentMode) : ''
      case 'txChequeRef': case 'txSupplierBillNo': return t.refNo ?? ''
      case 'txChequeStatus': return t.paymentMode === 'cheque' && t.chequeStatus ? tr(t.chequeStatus === 'open' ? (t.type === 'payment_in' ? 'chq_open_in' : 'chq_open_out') : 'chq_' + t.chequeStatus) : ''
      case 'notes': return t.notes ?? ''
      case 'txFromGodown': return godown(t.godownId)
      case 'txToGodown': return godown(t.toGodownId)
      case 'txLinesCount': return String(t.lines.length)
      case 'txItemMade': return (t.outputItemId && data.itemById.get(t.outputItemId)?.name) || ''
      case 'txQtyMade': {
        const it = t.outputItemId ? data.itemById.get(t.outputItemId) : undefined
        return t.outputQty ? `${fmtQty(t.outputQty)} ${it?.unit ?? ''}`.trim() : ''
      }
      default: return ''
    }
  })
  return { t, party, status: docStatus(t, dues, todayStr), paid: t.cancelled ? 0 : amountPaid(t, dues), due: balanceDue(t, dues), extra }
}
