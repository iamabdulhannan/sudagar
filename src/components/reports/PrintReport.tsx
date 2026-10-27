import type { Firm } from '../../lib/types'
import { fmtCell, ReportTable, type ReportDoc } from './ReportTable'

/** words the printed page needs (it is rendered outside the i18n provider) */
export interface PrintLabels {
  total: string
  phone: string
  ntn: string
  printedOn: string
}

/** firm letterhead + report title and period, for printed reports */
export function PrintHeader({ firm, title, period, labels, dir }: { firm: Firm; title: string; period: string; labels: PrintLabels; dir: 'ltr' | 'rtl' }) {
  const contact = [firm.address, firm.city].filter(Boolean).join(', ')
  return (
    <header dir={dir} style={{ borderBottom: '2px solid #0f766e', paddingBottom: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {firm.logo && <img src={firm.logo} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{firm.name}</div>
          {contact && <div style={{ fontSize: 11, color: '#444' }}>{contact}</div>}
          <div style={{ fontSize: 11, color: '#444' }}>
            {firm.phone && <span>{labels.phone}: <span className="num">{firm.phone}</span></span>}
            {firm.phone && firm.ntn && <span>{'  |  '}</span>}
            {firm.ntn && <span>{labels.ntn}: <span className="num">{firm.ntn}</span></span>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'end' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>{title}</div>
        {period && <div style={{ fontSize: 11, color: '#444' }}>{period}</div>}
        <div style={{ fontSize: 10, color: '#777' }}>{labels.printedOn}</div>
      </div>
    </header>
  )
}

/** the whole report on paper: header, summary figures and every table */
export function PrintReport({ firm, title, period, doc, labels, dir }: {
  firm: Firm; title: string; period: string; doc: ReportDoc; labels: PrintLabels; dir: 'ltr' | 'rtl'
}) {
  const symbol = firm.currencySymbol
  return (
    <div dir={dir} style={{ color: '#111', background: '#fff', fontSize: 12 }}>
      <PrintHeader firm={firm} title={title} period={period} labels={labels} dir={dir} />
      {!!doc.summary?.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
          {doc.summary.map((sm) => (
            <div key={sm.label} style={{ border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px' }}>
              <div style={{ fontSize: 10, color: '#555' }}>{sm.label}</div>
              <div className="num" style={{ fontSize: 13, fontWeight: 700 }}>{fmtCell(sm.kind, sm.value, symbol)}</div>
            </div>
          ))}
        </div>
      )}
      {doc.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 14, breakInside: 'auto' }}>
          {s.title && <div style={{ fontWeight: 700, fontSize: 13, margin: '4px 0' }}>{s.title}</div>}
          <ReportTable s={s} symbol={symbol} plain totalLabel={labels.total} />
        </div>
      ))}
    </div>
  )
}
