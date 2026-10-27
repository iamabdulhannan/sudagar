import { TXN_META } from './txn'
import type { TxnType } from './types'

/** list of one transaction type, e.g. /txns/sale */
export const txnListPath = (type: TxnType) => `/txns/${TXN_META[type].slug}`
/** new transaction form; query like "party=<id>" or "from=<txnId>" */
export const txnNewPath = (type: TxnType, query = '') => `/txn/${TXN_META[type].slug}/new${query ? '?' + query : ''}`
/** one saved transaction (view, with edit / print / convert) */
export const txnPath = (type: TxnType, id: string) => `/txn/${TXN_META[type].slug}/${id}`
export const txnEditPath = (type: TxnType, id: string) => `/txn/${TXN_META[type].slug}/${id}/edit`
export const partyPath = (id: string) => `/parties/${id}`
export const itemPath = (id: string) => `/items/${id}`
export const accountPath = (id: string) => `/cash-bank/${id}`
export const reportPath = (key: string) => `/reports/${key}`

/** only same-site paths are allowed as the page to return to after sign-in */
export const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '')
