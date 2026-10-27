import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { fmtDate, fmtMoney, fmtNum, fmtQty, round2, round3 } from '../../lib/format'

/**
 * A report is described as data (columns + rows), so the same description drives the
 * screen table, the printed A4 page and the CSV file. Nothing here uses hooks: the
 * printed copy is rendered outside the app's providers (see PrintPortal).
 */

export type ColKind = 'text' | 'money' | 'qty' | 'pct' | 'date' | 'int'

export interface Col<R> {
  key: string
  label: string
  kind?: ColKind
  value: (r: R) => string | number | undefined
  /** link target on screen (plain text on paper) */
  href?: (r: R) => string | undefined
  /** small second line under the value */
  sub?: (r: R) => string | undefined
  /** red when negative */
  tone?: boolean
  /** keep the column out of the CSV */
  noCsv?: boolean
  /** narrow or wide hints */
  className?: string
}

export type RowStyle = 'head' | 'indent' | 'total' | 'grand' | 'muted' | 'bad' | undefined

export interface Section<R> {
  title?: string
  cols: Col<R>[]
  rows: R[]
  /** totals row, by column key; the first column shows `footLabel` (or "Total") */
  foot?: Record<string, string | number>
  footLabel?: string
  rowStyle?: (r: R) => RowStyle
  rowKey?: (r: R, i: number) => string
  empty?: string
  note?: string
}

export interface SummaryItem {
  label: string
  value: string | number
  kind?: ColKind
  tone?: 'good' | 'bad' | 'warn' | 'brand' | 'neutral'
}

export interface ReportDoc {
  summary?: SummaryItem[]
  sections: Section<any>[]
}

/** typed helper so rows and columns agree; returns a section that fits ReportDoc */
export const section = <R,>(s: Section<R>) => s

const isNum = (k?: ColKind) => k === 'money' || k === 'qty' || k === 'pct' || k === 'int'

/** format one value for screen and paper */
export function fmtCell(kind: ColKind | undefined, v: string | number | undefined, symbol: string): string {
  if (v === undefined || v === '') return ''
  if (typeof v === 'string' && kind !== 'date') return v
  switch (kind) {
    case 'money': return fmtMoney(Number(v), symbol)
    case 'qty': return fmtQty(Number(v))
    case 'pct': return fmtNum(Number(v)) + '%'
    case 'int': return String(Math.round(Number(v)))
    case 'date': return fmtDate(String(v))
    default: return String(v)
  }
}

/** value for the CSV file: plain numbers (no symbol or commas) so Excel can add them up */
export function csvCell(kind: ColKind | undefined, v: string | number | undefined): string | number {
  if (v === undefined) return ''
  if (typeof v === 'number') return kind === 'qty' ? round3(v) : round2(v)
  return v
}

const rowCls: Record<NonNullable<RowStyle>, string> = {
  head: 'font-semibold text-stone-900 bg-stone-50',
  indent: '',
  total: 'font-semibold',
  grand: 'font-bold text-stone-900 bg-brand-50',
  muted: 'text-stone-500',
  bad: 'text-red-700',
}

export function ReportTable<R>({ s, symbol, plain, totalLabel }: { s: Section<R>; symbol: string; plain?: boolean; totalLabel: string }) {
  const cell = (c: Col<R>, r: R): ReactNode => {
    const v = c.value(r)
    const text = fmtCell(c.kind, v, symbol)
    const href = !plain && c.href ? c.href(r) : undefined
    const sub = c.sub?.(r)
    const neg = c.tone && typeof v === 'number' && v < 0
    const body = href
      ? <Link to={href} className="font-medium text-brand-700 hover:underline">{text}</Link>
      : <span className={cx(neg && 'text-red-700')}>{text}</span>
    return sub ? <>{body}<span className="block text-xs text-stone-500">{sub}</span></> : body
  }
  return (
    <div className={cx(!plain && 'table-wrap')}>
      <table className="tbl">
        <thead>
          <tr>
            {s.cols.map((c) => (
              <th key={c.key} className={cx(isNum(c.kind) && 'r', c.className)}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.length === 0 && (
            <tr><td colSpan={s.cols.length} className="py-10 text-center text-stone-500">{s.empty ?? '-'}</td></tr>
          )}
          {s.rows.map((r, i) => {
            const st = s.rowStyle?.(r)
            return (
              <tr key={s.rowKey ? s.rowKey(r, i) : i} className={cx(st && rowCls[st])}>
                {s.cols.map((c, ci) => (
                  <td key={c.key} className={cx(isNum(c.kind) && 'r num', c.kind === 'date' && 'num whitespace-nowrap', ci === 0 && st === 'indent' && 'ps-8', c.className)}>
                    {cell(c, r)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {s.foot && s.rows.length > 0 && (
          <tfoot>
            <tr>
              {s.cols.map((c, ci) => {
                const v = s.foot![c.key]
                return (
                  <td key={c.key} className={cx(isNum(c.kind) && 'r num', c.className)}>
                    {ci === 0 && v === undefined ? (s.footLabel ?? totalLabel) : fmtCell(c.kind, v, symbol)}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        )}
      </table>
      {s.note && <p className="mt-2 px-1 text-xs text-stone-500">{s.note}</p>}
    </div>
  )
}

/** all sections of a report flattened into CSV rows */
export function docToCsv(title: string, period: string, doc: ReportDoc, totalLabel: string): { header: string[]; rows: (string | number)[][] } {
  const rows: (string | number)[][] = []
  if (period) rows.push([period])
  for (const sm of doc.summary ?? []) rows.push([sm.label, csvCell(sm.kind, sm.value)])
  if (doc.summary?.length) rows.push([])
  for (const s of doc.sections) {
    const cols = s.cols.filter((c) => !c.noCsv)
    if (s.title) rows.push([s.title])
    rows.push(cols.map((c) => c.label))
    for (const r of s.rows) rows.push(cols.map((c) => csvCell(c.kind, c.value(r))))
    if (s.foot && s.rows.length) rows.push(cols.map((c, i) => (s.foot![c.key] !== undefined ? csvCell(c.kind, s.foot![c.key]) : i === 0 ? s.footLabel ?? totalLabel : '')))
    rows.push([])
  }
  return { header: [title], rows }
}
