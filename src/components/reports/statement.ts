import type { RowStyle } from './ReportTable'

/** one line of a financial statement (P&L, balance sheet) */
export interface StmtRow {
  label: string
  amount?: number
  /** share of net sales, P&L only */
  share?: number
  style?: RowStyle
  href?: string
}
