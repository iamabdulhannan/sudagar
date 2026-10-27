import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { MAIN_GODOWN, today } from '../../lib/db'
import { godownStock } from '../../lib/ledger'
import { round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { blankTxn, calcLine, calcTotals, saveTxn, TxnError } from '../../lib/txn'
import type { ID, Item, Txn } from '../../lib/types'
import { ItemSearch } from '../items/ItemSearch'
import { fmtStock } from '../items/itemUtils'
import { Button, Field, Input, Modal, Money, Textarea, useUi } from '../ui'
import { GodownSelect } from './StockBits'
import { fromStockLines, StockLines, stockLine, toStockLines, type StockLine } from './StockLines'
import { godownQty, shortages } from './stockLogic'
import { useCost } from './useStock'

/** move stock from one godown to another (new or edit) */
export function TransferForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Txn; onSaved?: (t: Txn) => void }) {
  const { db, items, txns, adjustments, godowns, settings, itemById, firm } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const cost = useCost()
  const [from, setFrom] = useState<ID>(MAIN_GODOWN)
  const [to, setTo] = useState<ID>(MAIN_GODOWN)
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<StockLine[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const other = godowns.find((g) => g.active && g.id !== MAIN_GODOWN)?.id ?? MAIN_GODOWN
    setFrom(initial?.godownId || MAIN_GODOWN)
    setTo(initial ? initial.toGodownId || MAIN_GODOWN : other)
    setDate(initial?.date ?? today())
    setLines(initial ? toStockLines(initial.lines) : [])
    setNote(initial?.notes ?? '')
    setError('')
    // reset only when the form opens
  }, [open, initial])

  // when editing, the entry's own movement is left out so its stock counts as available
  const stock = useMemo(
    () => godownStock(items, initial ? txns.filter((x) => x.id !== initial.id) : txns, adjustments),
    [items, txns, adjustments, initial],
  )
  const available = useMemo(() => godownQty(stock, from), [stock, from])
  const short = useMemo(
    () => shortages(lines, (id) => available.get(id) ?? 0, (id) => itemById.get(id)?.kind === 'product'),
    [lines, available, itemById],
  )
  const value = lines.reduce((a, l) => a + l.amount, 0)

  const add = (item: Item) => {
    setError('')
    const existing = lines.find((l) => l.itemId === item.id && l.factor === 1)
    if (existing) setLines(lines.map((l) => (l.key === existing.key ? { ...calcLine({ ...l, qty: round3(l.qty + 1) }, false), key: l.key } : l)))
    else setLines([...lines, stockLine(item, cost.ofItem(item), 1)])
  }

  async function save() {
    if (from === to) { setError(t('errGodowns')); return }
    if (!lines.length) { setError(t('errNoLines')); return }
    if (short.length && settings.negativeStock === 'block') { setError(t('stShortBlocked')); return }
    setSaving(true)
    try {
      const base = initial ?? blankTxn('stock_transfer', settings)
      const draft = calcTotals({
        ...base, date,
        godownId: from === MAIN_GODOWN ? undefined : from,
        toGodownId: to === MAIN_GODOWN ? undefined : to,
        lines: fromStockLines(lines).filter((l) => l.qty > 0),
        notes: note.trim() || undefined,
        accountId: undefined, paymentMode: undefined, received: 0, payments: undefined, dueDate: undefined,
      }, settings)
      const saved = await saveTxn(db, draft)
      toast(t('stTransferSaved', { no: saved.number }))
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof TxnError ? t(err.problem.key, err.problem.vars) : t('somethingWrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={initial ? t('stEditTransfer', { no: initial.number }) : t('stNewTransfer')}
      footer={<>
        <span className="me-auto self-center text-sm text-stone-600">
          {t('stTransferValue')}: <Money value={value} symbol={firm.currencySymbol} className="font-semibold text-stone-900" />
        </span>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving}>{t('save')}</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr_160px]">
          <Field label={t('stFromGodown')}>
            <GodownSelect value={from} onChange={(v) => { setFrom(v); setError('') }} />
          </Field>
          <ArrowRight className="mb-2.5 hidden size-5 text-stone-400 sm:block rtl:rotate-180" />
          <Field label={t('stToGodown')}>
            <GodownSelect value={to} onChange={(v) => { setTo(v); setError('') }} />
          </Field>
          <Field label={t('date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <ItemSearch
          onPick={add}
          side="purchase"
          allowAdd={false}
          filter={(i) => i.kind === 'product'}
          stock={available}
          placeholder={t('stAddItemPh')}
        />

        <StockLines lines={lines} onChange={(l) => { setLines(l); setError('') }} available={available} cost={cost.byId} needLabel={t('stMoveQty')} />

        {short.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">{t('stShortTitle')}</div>
              <ul className="mt-0.5 text-xs">
                {short.map((s) => {
                  const item = itemById.get(s.itemId)!
                  return <li key={s.itemId} className="num">{t('stShortLine', { name: item.name, need: fmtStock(item, s.need, settings.features.altUnits), have: fmtStock(item, s.have, settings.features.altUnits) })}</li>
                })}
              </ul>
            </div>
          </div>
        )}

        <Field label={t('note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      </div>
    </Modal>
  )
}
