import { FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { downloadCsv } from '../../lib/csv'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDateTime } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { printNode } from '../PrintPortal'
import { PrintReport } from '../reports/PrintReport'
import { docToCsv, fmtCell, ReportTable, type ReportDoc } from '../reports/ReportTable'
import { Button } from '../ui'

const toneCls = { good: 'text-emerald-700', bad: 'text-red-700', warn: 'text-amber-700', brand: 'text-brand-700', neutral: 'text-stone-900' }

/** a report shown inside a page tab: filters, Print / CSV, summary figures and tables (same data drives all three) */
export function StockReport({ title, period, filters, doc, fileName }: {
  title: string
  period: string
  filters?: ReactNode
  doc: ReportDoc
  fileName: string
}) {
  const { firm } = useData()
  const { t, dir } = useI18n()
  const symbol = firm.currencySymbol
  const total = t('total')

  const print = () => printNode(
    <PrintReport
      firm={firm} title={title} period={period} doc={doc} dir={dir}
      labels={{ total, phone: t('phone'), ntn: t('ntn'), printedOn: t('rp_printedOn', { when: fmtDateTime(Date.now()) }) }}
    />,
    'A4',
  )
  const csv = () => {
    const { header, rows } = docToCsv(title, period, doc, total)
    downloadCsv(`${fileName}-${today()}`, header, rows)
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-end gap-2">
        {filters}
        <div className="ms-auto flex gap-2">
          <Button variant="secondary" onClick={print}><Printer className="size-4" />{t('print')}</Button>
          <Button variant="secondary" onClick={csv}><FileDown className="size-4" />{t('exportCsv')}</Button>
        </div>
      </div>
      {period && <p className="text-sm text-stone-500">{period}</p>}
      {!!doc.summary?.length && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {doc.summary.map((sm) => (
            <div key={sm.label} className="rounded-xl border border-stone-200 bg-surface p-3">
              <div className="text-xs font-medium text-stone-500">{sm.label}</div>
              <div className={cx('num mt-0.5 text-lg font-bold', toneCls[sm.tone ?? 'neutral'])}>{fmtCell(sm.kind, sm.value, symbol)}</div>
            </div>
          ))}
        </div>
      )}
      {doc.sections.map((s, i) => (
        <div key={i} className="rounded-xl border border-stone-200">
          {s.title && <h3 className="border-b border-stone-100 px-3 py-2 text-sm font-semibold text-stone-800">{s.title}</h3>}
          <ReportTable s={s} symbol={symbol} totalLabel={total} />
        </div>
      ))}
    </div>
  )
}
