import type { FirmData } from '../../lib/data'
import { fmtDate, fmtMoney } from '../../lib/format'
import { translate } from '../../lib/i18n'
import { computeBooks } from '../../lib/ledger'
import type { PrintSize, Txn } from '../../lib/types'
import { printNode } from '../PrintPortal'
import { balanceDue, docTitleKey, normalizePkPhone } from '../txn/logic'
import { PAGE, currentLang } from './docCtx'
import { TxnDocument } from './TxnDocument'

export { TxnDocument }

/** make sure a just-saved transaction is part of the data the template reads */
function withTxn(data: FirmData, txn: Txn): FirmData {
  if (data.txnById.get(txn.id) === txn) return data
  const txns = [txn, ...data.txns.filter((x) => x.id !== txn.id)]
  return { ...data, txns, txnById: new Map(txns.map((x) => [x.id, x])) }
}

/** print an invoice / receipt / voucher in the given size (defaults to settings.printSize) */
export function printTxn(data: FirmData, txn: Txn, size?: PrintSize): void {
  const sz = size ?? data.settings.printSize
  const d = withTxn(data, txn)
  printNode(<TxnDocument data={d} txn={txn} size={sz} lang={currentLang()} />, PAGE[sz])
}

/** the WhatsApp message for a document */
export function whatsappMessage(data: FirmData, txn: Txn): string {
  const lang = currentLang()
  const tr = (k: string, v?: Record<string, string | number>) => translate(lang, k, v)
  const sym = data.firm.currencySymbol
  const d = withTxn(data, txn)
  const books = computeBooks(d)
  const due = balanceDue(txn, books.dues)
  const party = txn.partyId ? data.partyById.get(txn.partyId) : undefined
  const name = party?.name ?? txn.partyName
  const lines = [`*${data.firm.name}*`]
  if (name) lines.push(tr('waDear', { name }))
  lines.push(`${tr(docTitleKey(txn.type, data.settings.features))} ${txn.number}`, `${tr('date')}: ${fmtDate(txn.date)}`)
  if (txn.lines.length) lines.push(`${tr('waItems')}: ${txn.lines.length}`)
  lines.push(`${tr('total')}: ${fmtMoney(txn.total, sym)}`)
  if (txn.type === 'sale' || txn.type === 'purchase' || txn.type === 'sale_return' || txn.type === 'purchase_return' || txn.type === 'expense') {
    lines.push(`${tr('paid')}: ${fmtMoney(txn.total - due, sym)}`)
    if (due > 0.001) lines.push(`*${tr('txBalanceDue')}: ${fmtMoney(due, sym)}*`)
  }
  if (party && (txn.type === 'sale' || txn.type === 'payment_in')) {
    const bal = books.balances.get(`party:${party.id}`) ?? 0
    if (Math.abs(bal) > 0.001) lines.push(`${tr('prPartyBalance')}: ${fmtMoney(Math.abs(bal), sym)} (${tr(bal > 0 ? 'receivable' : 'payable')})`)
  }
  lines.push('', tr('waThanks'))
  if (data.firm.phone) lines.push(data.firm.phone)
  return lines.join('\n')
}

/** open WhatsApp with a short text summary of the transaction for the party's phone */
export function shareTxnWhatsApp(data: FirmData, txn: Txn): void {
  const party = txn.partyId ? data.partyById.get(txn.partyId) : undefined
  const phone = normalizePkPhone(party?.phone || txn.partyPhone)
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(data, txn))}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
