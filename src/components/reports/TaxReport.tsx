import { useMemo } from 'react'
import { useData } from '../../lib/data'
import { round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { taxReport, type TaxRateRow } from '../../lib/reports'
import { RangeFilter, ReportShell, usePeriodLabel, useRange } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** tax charged on sales against tax paid on purchases, by rate; returns are taken off */
export default function TaxReport() {
  const { t } = useI18n()
  const data = useData()
  const { range, setRange, from, to } = useRange()
  const label = usePeriodLabel()
  const res = useMemo(() => taxReport(data, from, to), [data, from, to])
  const tax = data.settings.taxLabel
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_taxCollected'), value: res.collected, kind: 'money' },
      { label: t('rp_taxPaid'), value: res.paid, kind: 'money' },
      { label: res.net >= 0 ? t('rp_netTaxPayable') : t('rp_netTaxCredit'), value: Math.abs(res.net), kind: 'money', tone: res.net > 0 ? 'bad' : 'good' },
      { label: t('rp_taxableSales'), value: res.salesTaxable, kind: 'money' },
    ],
    sections: [section<TaxRateRow>({
      cols: [
        { key: 'rate', label: t('rp_taxRate'), kind: 'pct', value: (r) => r.rate },
        { key: 'salesTaxable', label: t('rp_taxableSales'), kind: 'money', value: (r) => r.salesTaxable },
        { key: 'salesTax', label: t('rp_taxCollected'), kind: 'money', value: (r) => r.salesTax },
        { key: 'purchaseTaxable', label: t('rp_taxablePurchases'), kind: 'money', value: (r) => r.purchaseTaxable },
        { key: 'purchaseTax', label: t('rp_taxPaid'), kind: 'money', value: (r) => r.purchaseTax },
        { key: 'net', label: t('rp_net'), kind: 'money', value: (r) => round2(r.salesTax - r.purchaseTax), tone: true },
      ],
      rows: res.rows,
      foot: { salesTaxable: res.salesTaxable, salesTax: res.collected, purchaseTaxable: res.purchaseTaxable, purchaseTax: res.paid, net: res.net },
      empty: t('rp_noData'),
      rowKey: (r) => String(r.rate),
      note: t('rp_taxNote'),
    })],
  }
  return (
    <ReportShell
      title={`${t('rp_tax')} (${tax})`}
      period={label.range(from, to)}
      fileName="tax-report"
      doc={doc}
      filters={<RangeFilter value={range} onChange={setRange} />}
    />
  )
}
