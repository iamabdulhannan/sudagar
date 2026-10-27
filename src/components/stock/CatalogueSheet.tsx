import type { Firm } from '../../lib/types'

export interface CatalogueEntry { id: string; name: string; code?: string; unit: string; price?: string; note?: string; out?: boolean }
export interface CatalogueGroup { name: string; items: CatalogueEntry[] }

/**
 * A4 catalogue / rate list: firm header with logo and phone, then a grid of items grouped by category.
 * Rendered outside the app providers (printNode), so everything comes in as props.
 */
export function CatalogueSheet({ firm, title, date, groups, labels, dir }: {
  firm: Firm
  title: string
  date: string
  groups: CatalogueGroup[]
  labels: { phone: string; code: string; per: string; count: string }
  dir: 'ltr' | 'rtl'
}) {
  const contact = [firm.address, firm.city].filter(Boolean).join(', ')
  const count = groups.reduce((a, g) => a + g.items.length, 0)
  return (
    <div dir={dir} style={{ color: '#111', background: '#fff', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 11 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: '2px solid #0f766e', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {firm.logo && <img src={firm.logo} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{firm.name}</div>
            {contact && <div style={{ color: '#444' }}>{contact}</div>}
            {firm.phone && <div style={{ color: '#444' }}>{labels.phone}: <b className="num">{firm.phone}</b></div>}
          </div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f766e' }}>{title}</div>
          <div className="num" style={{ color: '#555' }}>{date}</div>
          <div className="num" style={{ color: '#777', fontSize: 10 }}>{labels.count.replace('{n}', String(count))}</div>
        </div>
      </header>
      {groups.map((g) => (
        <section key={g.name || '-'} style={{ marginBottom: 10 }}>
          {g.name && (
            <h2 style={{ fontSize: 12.5, fontWeight: 700, color: '#0f766e', margin: '6px 0', paddingBottom: 2, borderBottom: '1px solid #cfe7e4', breakAfter: 'avoid' }}>{g.name}</h2>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {g.items.map((i) => (
              <div key={i.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px', breakInside: 'avoid', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontWeight: 700, fontSize: 11.5, lineHeight: 1.25 }}>{i.name}</div>
                {i.code && <div className="num" style={{ color: '#666', fontSize: 9.5 }}>{labels.code}: {i.code}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, marginTop: 'auto' }}>
                  {i.price ? (
                    <span className="num" style={{ fontWeight: 800, fontSize: 12.5 }}>
                      {i.price}<span style={{ fontWeight: 500, fontSize: 9.5, color: '#555' }}> {labels.per} {i.unit}</span>
                    </span>
                  ) : <span style={{ color: '#555', fontSize: 9.5 }}>{i.unit}</span>}
                  {i.note && <span style={{ fontSize: 9, fontWeight: 600, color: i.out ? '#b91c1c' : '#047857' }}>{i.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
