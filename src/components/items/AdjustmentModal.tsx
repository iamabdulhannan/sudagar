import { Minus, Plus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { MAIN_GODOWN, today, uid } from '../../lib/db'
import { round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { AdjustmentReason, ID, Item } from '../../lib/types'
import { GodownSelect } from '../stock/StockBits'
import { useGodownStock } from '../stock/useStock'
import { Button, Field, Input, Modal, NumberInput, Select, Textarea, useUi } from '../ui'
import { fmtStock, itemSummary } from './itemUtils'

export const ADJ_REASONS: AdjustmentReason[] = ['count', 'damage', 'expired', 'gift', 'own_use', 'production', 'other']

/** manual stock change: add or remove a quantity with a reason (saved to db.adjustments) */
export function AdjustmentModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: Item }) {
  const { db, qty, settings } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const f = settings.features
  const [dir, setDir] = useState<1 | -1>(1)
  const [amount, setAmount] = useState(0)
  const [useAlt, setUseAlt] = useState(false)
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState<AdjustmentReason>('count')
  const [batch, setBatch] = useState('')
  const [note, setNote] = useState('')
  const [godown, setGodown] = useState<ID>(MAIN_GODOWN)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const gstock = useGodownStock()

  useEffect(() => {
    if (!open) return
    setDir(1); setAmount(0); setUseAlt(false); setDate(today()); setReason('count'); setBatch(''); setNote(''); setError(''); setGodown(MAIN_GODOWN)
  }, [open])

  const hasAlt = f.altUnits && !!item.altUnit && !!item.altFactor
  const factor = useAlt && hasAlt ? item.altFactor! : 1
  // with godowns on, the stock shown and checked is the chosen godown's
  const current = f.godowns ? gstock.get(item.id)?.get(godown) ?? 0 : qty.get(item.id) ?? 0
  const change = round3(dir * amount * factor)
  const after = round3(current + change)

  async function save() {
    if (!(amount > 0)) { setError(t('itErrQty')); return }
    if (!date) { setError(t('errDate')); return }
    if (after < 0 && settings.negativeStock === 'block') {
      setError(t('errNegativeStock', { name: item.name, qty: fmtStock(item, current, f.altUnits) }))
      return
    }
    setSaving(true)
    try {
      const id = uid()
      await db.transaction('rw', [db.adjustments, db.audit], async () => {
        await db.adjustments.add({
          id, itemId: item.id, date, qty: change, reason,
          godownId: f.godowns && godown !== MAIN_GODOWN ? godown : undefined,
          batch: batch.trim() || undefined, note: note.trim() || undefined, createdAt: Date.now(),
        })
        await db.audit.add({ at: Date.now(), action: 'create', entity: 'adjustment', entityId: id, summary: `${itemSummary(item)} ${change > 0 ? '+' : ''}${change} ${reason}` })
      })
      toast(t('itAdjSaved'))
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
      title={t('itAdjust')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving}>{t('save')}</Button>
      </>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <div className="font-medium text-stone-900">{item.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 text-stone-600">
            <span>{t('itInStock')}: <b className="num">{fmtStock(item, current, f.altUnits)}</b></span>
            {amount > 0 && <span>{t('itAfter')}: <b className={cx('num', after < 0 && 'text-red-700')}>{fmtStock(item, after, f.altUnits)}</b></span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DirButton active={dir === 1} onClick={() => setDir(1)} tone="good" icon={<Plus className="size-4" />} label={t('itAdjAdd')} />
          <DirButton active={dir === -1} onClick={() => setDir(-1)} tone="bad" icon={<Minus className="size-4" />} label={t('itAdjRemove')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('qty')} required error={error || undefined}>
            <div className="flex gap-2">
              <NumberInput value={amount} onValue={(n) => { setAmount(n); setError('') }} autoFocus />
              {hasAlt && (
                <Select value={useAlt ? 'alt' : 'base'} onChange={(e) => setUseAlt(e.target.value === 'alt')} className="w-28 shrink-0">
                  <option value="base">{item.unit}</option>
                  <option value="alt">{item.altUnit}</option>
                </Select>
              )}
              {!hasAlt && <span className="self-center text-sm text-stone-500">{item.unit}</span>}
            </div>
          </Field>
          <Field label={t('date')} required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {f.godowns && (
            <Field label={t('stGodown')}>
              <GodownSelect value={godown} onChange={setGodown} />
            </Field>
          )}
          <Field label={t('itReason')}>
            <Select value={reason} onChange={(e) => setReason(e.target.value as AdjustmentReason)}>
              {ADJ_REASONS.map((r) => <option key={r} value={r}>{t('adjr_' + r)}</option>)}
            </Select>
          </Field>
          {f.batches && (
            <Field label={t('itBatch')} hint={t('optional')}>
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
            </Field>
          )}
          <Field label={t('note')} className="sm:col-span-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function DirButton({ active, onClick, tone, icon, label }: { active: boolean; onClick: () => void; tone: 'good' | 'bad'; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold cursor-pointer',
        active
          ? tone === 'good' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-red-600 bg-red-50 text-red-800'
          : 'border-stone-300 text-stone-600 hover:bg-stone-50',
      )}
    >
      {icon}{label}
    </button>
  )
}
