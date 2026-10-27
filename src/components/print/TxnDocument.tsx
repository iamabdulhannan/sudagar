import { useMemo } from 'react'
import type { FirmData } from '../../lib/data'
import type { Lang } from '../../lib/i18n'
import { computeBooks, type Books } from '../../lib/ledger'
import type { InvoiceTheme, PrintSize, Txn } from '../../lib/types'
import { isItemDoc, isStockDoc } from '../txn/logic'
import { currentLang, makeCtx } from './docCtx'
import { DOC_CSS } from './docStyles'
import { InvoiceSheet } from './InvoiceSheet'
import { StockSheet } from './StockSheet'
import { ThermalReceipt } from './ThermalReceipt'
import { VoucherSheet } from './VoucherSheet'

/**
 * A printable document (invoice, receipt or voucher). Uses no React context, so the same
 * component renders the on-screen preview and the printed copy (printNode).
 */
export function TxnDocument({ data, txn, size, books, lang, theme }: {
  data: FirmData
  txn: Txn
  /** defaults to settings.printSize */
  size?: PrintSize
  /** pass useBooks() when available; computed otherwise */
  books?: Books
  lang?: Lang
  /** A4 / A5 design; defaults to settings.invoiceTheme (lets settings preview a design before saving) */
  theme?: InvoiceTheme
}) {
  const b = useMemo(() => books ?? computeBooks(data), [books, data])
  const ctx = makeCtx(data, txn, b, lang ?? currentLang(), theme)
  const sz = size ?? data.settings.printSize
  let body
  if (sz === 'thermal80' || sz === 'thermal58') body = <ThermalReceipt ctx={ctx} narrow={sz === 'thermal58'} />
  else if (isStockDoc(txn.type)) body = <StockSheet ctx={ctx} a5={sz === 'a5'} />
  else if (isItemDoc(txn.type)) body = <InvoiceSheet ctx={ctx} a5={sz === 'a5'} />
  else body = <VoucherSheet ctx={ctx} a5={sz === 'a5'} />
  return (
    <>
      <style>{DOC_CSS}</style>
      {body}
    </>
  )
}
