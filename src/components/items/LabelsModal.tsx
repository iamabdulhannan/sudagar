import { AlertTriangle, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useData } from '../../lib/data'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Item } from '../../lib/types'
import { printNode } from '../PrintPortal'
import { Button, Field, Modal, NumberInput, Select, Toggle } from '../ui'
import { Barcode } from './BarcodeSvg'
import { isCode128B } from './barcode'
import { labelCode } from './itemUtils'

type LabelSize = 'medium' | 'small'

/** label sizes on an A4 sheet (10 mm page margin): columns, label width and height in mm */
const SIZES: Record<LabelSize, { cols: number; w: number; h: number; bar: string }> = {
  medium: { cols: 3, w: 63, h: 38, bar: '12mm' },
  small: { cols: 4, w: 47, h: 26, bar: '8mm' },
}

interface LabelData { key: string; name: string; price: string; mrp?: string; code: string }

/** choose how many labels per item and print them on an A4 sheet */
export function LabelsModal({ open, onClose, items }: { open: boolean; onClose: () => void; items: Item[] }) {
  const { firm, settings } = useData()
  const { t } = useI18n()
  const [counts, setCounts] = useState<Record<ID, number>>({})
  const [size, setSize] = useState<LabelSize>('medium')
  const [showFirm, setShowFirm] = useState(true)
  const [showPrice, setShowPrice] = useState(true)

  useEffect(() => {
    if (open) setCounts(Object.fromEntries(items.map((i) => [i.id, 1])))
  }, [open, items])

  const total = items.reduce((a, i) => a + (counts[i.id] ?? 0), 0)

  function print() {
    const labels: LabelData[] = []
    for (const i of items) {
      const n = Math.max(0, Math.floor(counts[i.id] ?? 0))
      for (let k = 0; k < n; k++) {
        labels.push({
          key: `${i.id}-${k}`, name: i.name, code: labelCode(i),
          price: fmtMoney(i.salePrice, firm.currencySymbol),
          mrp: settings.features.mrp && i.mrp ? fmtMoney(i.mrp, firm.currencySymbol) : undefined,
        })
      }
    }
    if (!labels.length) return
    printNode(
      <LabelSheet labels={labels} size={size} firmName={showFirm ? firm.name : ''} showPrice={showPrice} mrpLabel={t('itMrp')} />,
      'A4',
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('itPrintLabels')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={print} disabled={total === 0}><Printer className="size-4" />{t('itPrintN', { n: total })}</Button>
      </>}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label={t('itLabelSize')}>
          <Select value={size} onChange={(e) => setSize(e.target.value as LabelSize)}>
            <option value="medium">{t('itLabelMedium')}</option>
            <option value="small">{t('itLabelSmall')}</option>
          </Select>
        </Field>
        <Toggle checked={showFirm} onChange={setShowFirm} label={t('itLabelFirm')} />
        <Toggle checked={showPrice} onChange={setShowPrice} label={t('itLabelPrice')} />
      </div>
      <div className="table-wrap rounded-lg border border-stone-200">
        <table className="tbl">
          <thead>
            <tr><th>{t('name')}</th><th>{t('itBarcode')}</th><th className="r">{t('itLabelCount')}</th></tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const code = labelCode(i)
              const ok = code && isCode128B(code)
              return (
                <tr key={i.id}>
                  <td className="font-medium">{i.name}</td>
                  <td>
                    {ok
                      ? <span className="num text-stone-600">{code}</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="size-3.5" />{t('itNoBarcode')}</span>}
                  </td>
                  <td className="r">
                    <NumberInput
                      value={counts[i.id] ?? 0}
                      onValue={(n) => setCounts((c) => ({ ...c, [i.id]: Math.max(0, Math.min(500, Math.floor(n))) }))}
                      className="ms-auto h-8 w-20 text-end"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

/** the printed sheet. Rendered outside the app providers, so everything comes in as props. */
export function LabelSheet({ labels, size, firmName, showPrice, mrpLabel }: {
  labels: LabelData[]; size: LabelSize; firmName: string; showPrice: boolean; mrpLabel: string
}) {
  const s = SIZES[size]
  const small = size === 'small'
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: `repeat(${s.cols}, ${s.w}mm)`, gridAutoRows: `${s.h}mm`,
        gap: 0, color: '#000', background: '#fff', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {labels.map((l) => (
        <div
          key={l.key}
          style={{
            boxSizing: 'border-box', padding: small ? '1.5mm 2mm' : '2mm 3mm', border: '0.2mm dashed #bbb',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
            breakInside: 'avoid', pageBreakInside: 'avoid', textAlign: 'center',
          }}
        >
          {firmName && <div style={{ fontSize: small ? '6pt' : '7pt', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firmName}</div>}
          <div style={{ fontSize: small ? '7pt' : '8.5pt', fontWeight: 700, lineHeight: 1.15, maxHeight: '2.3em', overflow: 'hidden' }}>{l.name}</div>
          {showPrice && (
            <div style={{ fontSize: small ? '8pt' : '10pt', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {l.price}
              {l.mrp && <span style={{ fontSize: '6.5pt', fontWeight: 500, marginInlineStart: '2mm' }}>{mrpLabel} {l.mrp}</span>}
            </div>
          )}
          {l.code && isCode128B(l.code) ? (
            <div>
              <Barcode value={l.code} height={s.bar} />
              <div style={{ fontSize: small ? '6pt' : '7pt', letterSpacing: '0.5pt', fontVariantNumeric: 'tabular-nums' }}>{l.code}</div>
            </div>
          ) : <div />}
        </div>
      ))}
    </div>
  )
}
