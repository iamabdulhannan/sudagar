import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { Item } from '../../lib/types'
import { Button, Field, Modal, Money, NumberInput, Select, useUi } from '../ui'
import { previewPrices, type PriceBy, type PriceChange, type PriceField, type PriceOp, type PriceRound } from './bulkPrice'
import { itemSummary } from './itemUtils'

const LABEL: Record<PriceField, string> = {
  salePrice: 'itSalePrice', wholesalePrice: 'itWholesalePrice', purchasePrice: 'itPurchasePrice', mrp: 'itMrp',
}

/** change the sale / wholesale / purchase price of many items at once, with a preview */
export function BulkPriceModal({ open, onClose, items, onDone }: { open: boolean; onClose: () => void; items: Item[]; onDone?: () => void }) {
  const { db, settings, firm } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const f = settings.features
  const sym = firm.currencySymbol
  const [c, setC] = useState<PriceChange>({ field: 'salePrice', op: 'increase', by: 'pct', value: 0, round: 'none' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setC({ field: 'salePrice', op: 'increase', by: 'pct', value: 0, round: 'none' })
  }, [open])

  const fields: PriceField[] = ['salePrice', ...(f.wholesale ? ['wholesalePrice' as const] : []), 'purchasePrice', ...(f.mrp ? ['mrp' as const] : [])]
  const rows = useMemo(() => (c.value > 0 || c.op === 'set' ? previewPrices(items, c) : []), [items, c])
  const set = <K extends keyof PriceChange>(k: K, v: PriceChange[K]) => setC((x) => ({ ...x, [k]: v }))

  async function save() {
    if (!rows.length) return
    setSaving(true)
    try {
      const now = Date.now()
      await db.transaction('rw', [db.items, db.audit], async () => {
        for (const r of rows) {
          const cur = await db.items.get(r.item.id)
          if (!cur) continue
          await db.items.put({ ...cur, [c.field]: r.next })
          await db.audit.add({
            at: now, action: 'update', entity: 'item', entityId: r.item.id,
            summary: `${itemSummary(r.item)} ${c.field} ${r.old} -> ${r.next}`,
          })
        }
      })
      toast(t('itBulkDone', { n: rows.length }))
      onDone?.()
      onClose()
    } catch {
      toast(t('somethingWrong'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('itBulkTitle', { n: items.length })}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving} disabled={!rows.length}>{t('itBulkSave', { n: rows.length })}</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('itBulkField')}>
            <Select value={c.field} onChange={(e) => set('field', e.target.value as PriceField)}>
              {fields.map((k) => <option key={k} value={k}>{t(LABEL[k])}</option>)}
            </Select>
          </Field>
          <Field label={t('itBulkOp')}>
            <Select value={c.op} onChange={(e) => set('op', e.target.value as PriceOp)}>
              <option value="increase">{t('itBulkIncrease')}</option>
              <option value="decrease">{t('itBulkDecrease')}</option>
              <option value="set">{t('itBulkSet')}</option>
            </Select>
          </Field>
          <Field label={c.op === 'set' ? t('itBulkNewPrice') : t('itBulkBy')}>
            <div className="flex gap-2">
              <NumberInput value={c.value} onValue={(n) => set('value', Math.max(0, n))} autoFocus />
              {c.op !== 'set' && (
                <Select value={c.by} onChange={(e) => set('by', e.target.value as PriceBy)} className="w-28 shrink-0">
                  <option value="pct">%</option>
                  <option value="amount">{sym}</option>
                </Select>
              )}
            </div>
          </Field>
          <Field label={t('itBulkRound')}>
            <Select value={c.round} onChange={(e) => set('round', e.target.value as PriceRound)}>
              <option value="none">{t('itBulkRoundNone')}</option>
              <option value="1">{t('itBulkRoundN', { n: 1 })}</option>
              <option value="5">{t('itBulkRoundN', { n: 5 })}</option>
              <option value="10">{t('itBulkRoundN', { n: 10 })}</option>
            </Select>
          </Field>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('itBulkPreview')}</h3>
          {rows.length === 0 ? (
            <p className="rounded-lg bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">{t('itBulkNoChange')}</p>
          ) : (
            <div className="table-wrap max-h-72 overflow-y-auto rounded-lg border border-stone-200">
              <table className="tbl">
                <thead>
                  <tr><th>{t('name')}</th><th className="r">{t('itBulkOld')}</th><th className="w-6" /><th className="r">{t('itBulkNew')}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.item.id}>
                      <td className="font-medium">{r.item.name}</td>
                      <td className="r text-stone-500"><Money value={r.old} symbol={sym} /></td>
                      <td className="text-stone-400"><ArrowRight className="size-3.5 rtl:rotate-180" /></td>
                      <td className={cx('r font-semibold', r.next > r.old ? 'text-emerald-700' : 'text-red-700')}><Money value={r.next} symbol={sym} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && rows.length < items.length && (
            <p className="num mt-2 text-xs text-stone-500">{t('itBulkSkipped', { n: items.length - rows.length })}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
