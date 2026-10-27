import type { ReactNode } from 'react'
import type { Firm } from '../../lib/types'

/**
 * A4 statement layout for printNode (party khata, cash book, bank book).
 * It renders outside the app providers, so every text arrives already translated.
 */
export interface SheetColumn { label: string; right?: boolean }

export function StatementSheet({ firm, title, meta, columns, rows, foot, summary, dir, ntnLabel, generated }: {
  firm: Firm
  title: string
  /** label / value pairs under the title (party, period ...) */
  meta: [string, ReactNode][]
  columns: SheetColumn[]
  rows: ReactNode[][]
  foot?: ReactNode[]
  /** boxes under the table (closing balance) */
  summary?: [string, ReactNode][]
  dir: 'ltr' | 'rtl'
  ntnLabel: string
  generated: string
}) {
  const contact = [firm.address, firm.city].filter(Boolean).join(', ')
  return (
    <div dir={dir} className="bg-white p-2 text-[12px] text-black" style={{ fontFamily: 'Inter, "Noto Nastaliq Urdu", sans-serif' }}>
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex items-start gap-3">
          {firm.logo && <img src={firm.logo} alt="" className="size-14 object-contain" />}
          <div>
            <div className="text-lg font-bold">{firm.name}</div>
            {contact && <div>{contact}</div>}
            {firm.phone && <div className="num">{firm.phone}</div>}
            {firm.ntn && <div>{ntnLabel}: <span className="num">{firm.ntn}</span></div>}
          </div>
        </div>
        <div className="text-end">
          <div className="text-base font-bold uppercase tracking-wide">{title}</div>
          <div className="mt-1 text-[11px] text-neutral-600">{generated}</div>
        </div>
      </header>

      <div className="my-3 grid grid-cols-2 gap-x-6 gap-y-1">
        {meta.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <span className="text-neutral-600">{k}:</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={'border border-neutral-400 bg-neutral-100 px-1.5 py-1 font-semibold ' + (c.right ? 'text-end' : 'text-start')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={'border border-neutral-300 px-1.5 py-1 ' + (columns[j]?.right ? 'num text-end whitespace-nowrap' : 'text-start')}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr>
              {foot.map((cell, j) => (
                <td key={j} className={'border border-neutral-400 bg-neutral-100 px-1.5 py-1 font-bold ' + (columns[j]?.right ? 'num text-end whitespace-nowrap' : 'text-start')}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>

      {summary && summary.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="min-w-64 border border-black">
            {summary.map(([k, v], i) => (
              <div key={i} className="flex justify-between gap-6 border-b border-neutral-300 px-3 py-1.5 last:border-b-0">
                <span>{k}</span>
                <span className="num font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
