import { ArrowLeft, FileDown, Printer } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../../lib/csv'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { cx } from '../../lib/cx'
import { fmtDate, fmtDateTime } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { TXN_META } from '../../lib/txn'
import type { TxnType } from '../../lib/types'
import { DateRange, resolveRange, type Range } from '../DateRange'
import { printNode } from '../PrintPortal'
import { Button, Card, Field, Input, Select } from '../ui'
import { PrintReport } from './PrintReport'
import { docToCsv, fmtCell, ReportTable, type ReportDoc } from './ReportTable'

/** period filter state for a report (default: this month) */
export function useRange(period: Range['period'] = 'month') {
  const [range, setRange] = useState<Range>({ period })
  const { from, to } = useMemo(() => resolveRange(range), [range])
  return { range, setRange, from, to }
}

/** "1 Oct 2026 to 31 Oct 2026", "As of 19 Oct 2026" or "All dates" */
export function usePeriodLabel() {
  const { t } = useI18n()
  return {
    range: (from?: string, to?: string) => {
      if (!from && !to) return t('rp_allDates')
      if (from === to) return fmtDate(from)
      if (!from) return t('rp_upTo', { date: fmtDate(to) })
      if (!to) return t('rp_since', { date: fmtDate(from) })
      return t('rp_period', { from: fmtDate(from), to: fmtDate(to) })
    },
    asOf: (d: string) => t('rp_asOf', { date: fmtDate(d) }),
  }
}

/** the human label of a transaction type */
export const typeLabel = (t: (k: string) => string, type: TxnType | string) =>
  type === 'opening' ? t('opening') : type === 'adjustment' ? t('la_stock_adjust') : t(TXN_META[type as TxnType]?.label ?? type)

// ---------- filter controls ----------

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <Field label={label} className={cx('min-w-0', className)}>{children}</Field>
}

export function RangeFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t } = useI18n()
  return <FilterField label={t('rp_periodLabel')}><DateRange value={value} onChange={onChange} /></FilterField>
}

export function DateFilter({ label, value, onChange }: { label?: string; value: string; onChange: (d: string) => void }) {
  const { t } = useI18n()
  return (
    <FilterField label={label ?? t('rp_asOfLabel')}>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value || today())} className="w-auto" />
    </FilterField>
  )
}

export function PartyFilter({ value, onChange, kind }: { value: string; onChange: (id: string) => void; kind?: 'customer' | 'supplier' }) {
  const { t } = useI18n()
  const { parties } = useData()
  const list = parties.filter((p) => !kind || p.kind === kind || p.kind === 'both')
  return (
    <FilterField label={t('rp_party')}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-44">
        <option value="">{t('rp_allParties')}</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
    </FilterField>
  )
}

export function CategoryFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useI18n()
  const { categories } = useData()
  return (
    <FilterField label={t('rp_category')}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-40">
        <option value="">{t('rp_allCategories')}</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </FilterField>
  )
}

export function ChoiceFilter<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: [T, string][]
}) {
  return (
    <FilterField label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-auto min-w-36">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    </FilterField>
  )
}

export function CheckFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex h-10 cursor-pointer items-center gap-2 self-end text-sm text-stone-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-700" />
      {label}
    </label>
  )
}

// ---------- the page ----------

const toneCls = {
  good: 'text-emerald-700', bad: 'text-red-700', warn: 'text-amber-700', brand: 'text-brand-700', neutral: 'text-stone-900',
}

/**
 * Page frame shared by every report: back link, title, filters, Print and CSV,
 * summary figures and the tables. `extra` is shown on screen only.
 */
export function ReportShell({ title, period, filters, doc, fileName, extra }: {
  title: string
  /** shown under the title and on the printout */
  period: string
  filters?: ReactNode
  doc: ReportDoc
  fileName: string
  extra?: ReactNode
}) {
  const { t, dir } = useI18n()
  const { firm } = useData()
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
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/reports" className="mb-1 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-brand-700">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('navReports')}
          </Link>
          <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-sm text-stone-500">{period}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={print}><Printer className="size-4" /> {t('print')}</Button>
          <Button variant="secondary" onClick={csv}><FileDown className="size-4" /> {t('exportCsv')}</Button>
        </div>
      </div>

      {filters && (
        <Card className="no-print" padded={false}>
          <div className="flex flex-wrap items-end gap-3 p-3">{filters}</div>
        </Card>
      )}

      {!!doc.summary?.length && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {doc.summary.map((sm) => (
            <div key={sm.label} className="rounded-xl border border-stone-200 bg-surface p-3 shadow-sm">
              <div className="text-xs font-medium text-stone-500">{sm.label}</div>
              <div className={cx('num mt-0.5 text-lg font-bold', toneCls[sm.tone ?? 'neutral'])}>{fmtCell(sm.kind, sm.value, symbol)}</div>
            </div>
          ))}
        </div>
      )}

      {extra}

      {doc.sections.map((s, i) => (
        <Card key={i} title={s.title} padded={false}>
          <ReportTable s={s} symbol={symbol} totalLabel={total} />
        </Card>
      ))}
    </div>
  )
}
