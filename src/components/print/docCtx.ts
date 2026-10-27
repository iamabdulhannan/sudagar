import type { FirmData } from '../../lib/data'
import { fmtDate, fmtFixed, fmtMoney } from '../../lib/format'
import { translate, type Lang } from '../../lib/i18n'
import type { Books } from '../../lib/ledger'
import { TXN_META } from '../../lib/txn'
import type { InvoiceTheme, Party, PrintSize, Txn } from '../../lib/types'
import { balanceDue, docTitleKey, isInvoice } from '../txn/logic'

/**
 * Everything a printed template needs, passed as plain values: templates are also rendered
 * by printNode in a separate React root, where the app's contexts (i18n, data) do not exist.
 */
export interface DocCtx {
  data: FirmData
  txn: Txn
  books: Books
  lang: Lang
  tr: (key: string, vars?: Record<string, string | number>) => string
  /** money with symbol, e.g. Rs 1,250 */
  money: (n: number) => string
  /** two decimals without symbol, for tables */
  fixed: (n: number) => string
  date: (d?: string) => string
  party?: Party
  /** party name to print (walk-in name or "Walk-in customer") */
  partyName: string
  title: string
  /** still open on this document */
  due: number
  /** party's total balance after everything (+ they owe us, - we owe them) */
  partyBalance?: number
  accent: string
  /** A4 / A5 layout: classic, modern, compact or bold */
  theme: InvoiceTheme
  /** class names of an A4 / A5 sheet */
  sheetCls: (a5?: boolean) => string
}

/** the app language, read from <html lang> (works outside React) */
export function currentLang(): Lang {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ur' ? 'ur' : 'en'
}

export function makeCtx(data: FirmData, txn: Txn, books: Books, lang: Lang, theme?: InvoiceTheme): DocCtx {
  const th = theme ?? data.settings.invoiceTheme ?? 'classic'
  const tr = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const party = txn.partyId ? data.partyById.get(txn.partyId) : undefined
  const sym = data.firm.currencySymbol
  const posts = TXN_META[txn.type].posts && !txn.cancelled
  return {
    data, txn, books, lang, tr,
    money: (n) => fmtMoney(n, sym),
    fixed: fmtFixed,
    date: fmtDate,
    party,
    partyName: party?.name ?? txn.partyName ?? (TXN_META[txn.type].side === 'sale' ? tr('walkIn') : ''),
    title: tr(docTitleKey(txn.type, data.settings.features)),
    due: isInvoice(txn.type) || posts ? balanceDue(txn, books.dues) : 0,
    partyBalance: party && posts ? books.balances.get(`party:${party.id}`) ?? 0 : undefined,
    accent: data.settings.invoiceColor || '#0f766e',
    theme: th,
    sheetCls: (a5) => 'sdoc sheet th-' + th + (a5 ? ' a5' : ''),
  }
}

/** word used by amountInWords for the firm's currency */
export function currencyWord(currency: string) {
  return currency === 'PKR' || currency === 'INR' ? 'Rupees' : currency
}

/** paper size for printNode */
export const PAGE: Record<PrintSize, 'A4' | 'A5' | '80mm' | '58mm'> = { a4: 'A4', a5: 'A5', thermal80: '80mm', thermal58: '58mm' }

export const isThermal = (s: PrintSize) => s === 'thermal80' || s === 'thermal58'

/** time of day from a timestamp, 14:05 */
export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
