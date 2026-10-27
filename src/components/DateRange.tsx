import { useMemo } from 'react'
import { addDays, today } from '../lib/db'
import { monthEnd, monthStart } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { Input, Select } from './ui'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year' | 'all' | 'custom'
export interface Range { period: Period; from?: string; to?: string }

/** resolve a period to dates (the business year is the calendar year; July-June can be added later) */
export function resolveRange(r: Range): { from?: string; to?: string } {
  const d = today()
  switch (r.period) {
    case 'today': return { from: d, to: d }
    case 'yesterday': { const y = addDays(d, -1); return { from: y, to: y } }
    case 'week': {
      const day = new Date(d + 'T00:00:00').getDay() || 7
      return { from: addDays(d, 1 - day), to: d }
    }
    case 'month': return { from: monthStart(d), to: monthEnd(d) }
    case 'lastMonth': { const p = addDays(monthStart(d), -1); return { from: monthStart(p), to: monthEnd(p) } }
    case 'year': return { from: d.slice(0, 4) + '-01-01', to: d.slice(0, 4) + '-12-31' }
    case 'all': return {}
    case 'custom': return { from: r.from, to: r.to }
  }
}

/** period picker used on lists and reports */
export function DateRange({ value, onChange, allowAll = true }: { value: Range; onChange: (r: Range) => void; allowAll?: boolean }) {
  const { t } = useI18n()
  const resolved = useMemo(() => resolveRange(value), [value])
  const opts: [Period, string][] = [
    ['today', t('today')], ['yesterday', t('yesterday')], ['week', t('thisWeek')], ['month', t('thisMonth')],
    ['lastMonth', t('lastMonth')], ['year', t('thisYear')], ...(allowAll ? [['all', t('all')] as [Period, string]] : []), ['custom', t('custom')],
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.period}
        onChange={(e) => {
          const p = e.target.value as Period
          onChange(p === 'custom' ? { period: p, ...resolved } : { period: p })
        }}
        className="w-auto min-w-36"
      >
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      {value.period === 'custom' && (
        <>
          <Input type="date" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-auto" aria-label={t('from')} />
          <span className="text-sm text-stone-500">{t('to')}</span>
          <Input type="date" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-auto" aria-label={t('to')} />
        </>
      )}
    </div>
  )
}
