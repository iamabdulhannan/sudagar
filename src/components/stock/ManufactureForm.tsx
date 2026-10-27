import { AlertTriangle, Factory, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useData } from '../../lib/data'
import { MAIN_GODOWN, today } from '../../lib/db'
import { fmtMoney, round3 } from '../../lib/format'
import { godownStock, stockQty } from '../../lib/ledger'
import { useI18n } from '../../lib/i18n'
import { blankTxn, calcLine, calcTotals, saveTxn, TxnError } from '../../lib/txn'
import type { ID, Item, Txn } from '../../lib/types'
import { ItemSearch } from '../items/ItemSearch'
import { fmtStock } from '../items/itemUtils'
import { Button, Field, Input, Modal, Money, NumberInput, Select, Textarea, useUi } from '../ui'
import { GodownSelect } from './StockBits'
import { fromStockLines, StockLines, stockLine, toStockLines, type StockLine } from './StockLines'
import { bomMaterials, costPreview, godownQty, shortages } from './stockLogic'
import { useCost } from './useStock'

/** make finished goods: materials from the bill of materials, making charges, cost per unit */
export function ManufactureForm({ open, onClose, initial, defaultItemId }: {
  open: boolean
  onClose: () => void
  initial?: Txn
  /** start with this item to make */
  defaultItemId?: ID
}) {
  const { db, items, txns, adjustments, accounts, settings, itemById, firm } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const cost = useCost()
  const f = settings.features
  const sym = firm.currencySymbol

  const [outputId, setOutputId] = useState<ID | undefined>()
  const [outputQty, setOutputQty] = useState(1)
  const [date, setDate] = useState(today())
  const [godown, setGodown] = useState<ID>(MAIN_GODOWN)
  const [lines, setLines] = useState<StockLine[]>([])
  const [touched, setTouched] = useState(false)
  const [charges, setCharges] = useState(0)
  const [accountId, setAccountId] = useState<ID | undefined>()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const output = outputId ? itemById.get(outputId) : undefined

  const linesFromBom = (item: Item | undefined, qty: number): StockLine[] =>
    bomMaterials(item?.bom, qty).flatMap((m) => {
      const comp = itemById.get(m.itemId)
      return comp ? [stockLine(comp, cost.ofItem(comp), m.qty)] : []
    })

  useEffect(() => {
    if (!open) return
    const first = initial?.outputItemId ?? defaultItemId
    const qty = initial?.outputQty ?? 1
    setOutputId(first)
    setOutputQty(qty)
    setDate(initial?.date ?? today())
    setGodown(initial?.godownId || MAIN_GODOWN)
    setLines(initial ? toStockLines(initial.lines) : linesFromBom(first ? itemById.get(first) : undefined, qty))
    setTouched(!!initial)
    setCharges(initial?.charges ?? 0)
    setAccountId(initial?.accountId ?? settings.defaultAccountId)
    setNote(initial?.notes ?? '')
    setError('')
    // reset only when the form opens
  }, [open, initial, defaultItemId])

  // when editing, the entry itself is left out so its materials count as available
  const others = useMemo(() => (initial ? txns.filter((x) => x.id !== initial.id) : txns), [txns, initial])
  const available = useMemo(
    () => (f.godowns ? godownQty(godownStock(items, others, adjustments), godown) : stockQty(items, others, adjustments)),
    [f.godowns, items, others, adjustments, godown],
  )
  const short = useMemo(
    () => shortages(lines, (id) => available.get(id) ?? 0, (id) => itemById.get(id)?.kind === 'product'),
    [lines, available, itemById],
  )
  const preview = costPreview(lines, charges, outputQty)
  const withBom = useMemo(() => items.filter((i) => i.active && i.kind === 'product' && i.bom?.length), [items])
  const moneyAccounts = accounts.filter((a) => (a.active && a.kind !== 'loan') || a.id === accountId)

  const pickOutput = (item: Item) => {
    setOutputId(item.id)
    setLines(linesFromBom(item, outputQty))
    setTouched(false)
    setError('')
  }
  const changeQty = (q: number) => {
    setOutputQty(q)
    if (!touched) setLines(linesFromBom(output, q))
  }
  const editLines = (l: StockLine[]) => { setLines(l); setTouched(true); setError('') }
  const addMaterial = (item: Item) => {
    const existing = lines.find((l) => l.itemId === item.id && l.factor === 1)
    if (existing) editLines(lines.map((l) => (l.key === existing.key ? { ...calcLine({ ...l, qty: round3(l.qty + 1) }, false), key: l.key } : l)))
    else editLines([...lines, stockLine(item, cost.ofItem(item), 1)])
  }

  async function save() {
    if (!output || !(outputQty > 0)) { setError(t('errOutput')); return }
    if (!lines.some((l) => l.qty > 0)) { setError(t('stErrNoMaterials')); return }
    if (short.length && settings.negativeStock === 'block') { setError(t('stShortBlocked')); return }
    if (charges > 0 && !accountId) { setError(t('errAccount')); return }
    setSaving(true)
    try {
      const base = initial ?? blankTxn('manufacture', settings)
      const draft = calcTotals({
        ...base, date,
        outputItemId: output.id, outputQty: round3(outputQty),
        godownId: f.godowns && godown !== MAIN_GODOWN ? godown : undefined,
        lines: fromStockLines(lines).filter((l) => l.qty > 0),
        charges: Math.max(0, charges),
        accountId: charges > 0 ? accountId : undefined,
        paymentMode: charges > 0 ? 'cash' : undefined,
        received: 0, payments: undefined, dueDate: undefined,
        notes: note.trim() || undefined,
      }, settings)
      const saved = await saveTxn(db, draft)
      toast(t('stMadeSaved', { no: saved.number, qty: `${round3(outputQty)} ${output.unit}`, name: output.name }))
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
      title={initial ? t('stEditMake', { no: initial.number }) : t('stMakeItems')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving}><Factory className="size-4" />{t('save')}</Button>
      </>}
    >
      <div className="space-y-5">
        {/* what is made */}
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
          <Field label={t('stItemMade')} required>
            {output ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border border-brand-600 bg-brand-50 px-3">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-900">{output.name}</span>
                {!initial && (
                  <button type="button" onClick={() => { setOutputId(undefined); setLines([]); setTouched(false) }} className="rounded p-0.5 text-brand-700 hover:bg-brand-100 cursor-pointer" aria-label={t('change')}>
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ) : (
              <ItemSearch onPick={pickOutput} side="purchase" allowAdd={false} showScan filter={(i) => i.kind === 'product'} placeholder={t('stPickItemMade')} autoFocus />
            )}
          </Field>
          <Field label={`${t('stQtyMade')}${output ? ` (${output.unit})` : ''}`} required>
            <NumberInput value={outputQty} onValue={(n) => changeQty(Math.max(0, n))} />
          </Field>
          <Field label={t('date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {!output && withBom.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="self-center text-xs text-stone-500">{t('stWithBom')}:</span>
            {withBom.slice(0, 12).map((i) => (
              <button key={i.id} type="button" onClick={() => pickOutput(i)} className="rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-brand-600 hover:bg-brand-50 cursor-pointer">
                {i.name}
              </button>
            ))}
          </div>
        )}
        {output && !output.bom?.length && <p className="text-xs text-amber-700">{t('stNoBom')}</p>}
        {f.godowns && (
          <Field label={t('stGodown')} hint={t('stMakeGodownHint')} className="sm:max-w-xs">
            <GodownSelect value={godown} onChange={setGodown} />
          </Field>
        )}

        {/* materials */}
        <section className="space-y-2 border-t border-stone-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('stMaterialsUsed')}</h3>
            {touched && !!output?.bom?.length && (
              <Button size="sm" variant="ghost" onClick={() => { setLines(linesFromBom(output, outputQty)); setTouched(false) }}>
                <RefreshCw className="size-3.5" />{t('stRefill')}
              </Button>
            )}
          </div>
          <StockLines lines={lines} onChange={editLines} available={available} cost={cost.byId} needLabel={t('stUseQty')} />
          <ItemSearch
            onPick={addMaterial}
            side="purchase"
            allowAdd={false}
            filter={(i) => i.kind === 'product' && i.id !== outputId}
            stock={available}
            placeholder={t('stAddMaterial')}
          />
          {short.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">{t('stShortTitle')}</div>
                <ul className="mt-0.5 text-xs">
                  {short.map((s) => {
                    const item = itemById.get(s.itemId)!
                    return <li key={s.itemId} className="num">{t('stShortLine', { name: item.name, need: fmtStock(item, s.need, f.altUnits), have: fmtStock(item, s.have, f.altUnits) })}</li>
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* charges and cost */}
        <section className="grid gap-4 border-t border-stone-100 pt-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label={t('stCharges')} hint={t('stChargesHint')}>
              <NumberInput value={charges} onValue={(n) => setCharges(Math.max(0, n))} />
            </Field>
            {charges > 0 && (
              <Field label={t('stPaidFrom')}>
                <Select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value || undefined)}>
                  <option value="">{t('select')}</option>
                  {moneyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label={t('note')}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </Field>
          </div>
          <div className="rounded-xl bg-stone-50 p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('stCostPreview')}</h3>
            <dl className="space-y-1.5 text-sm">
              <Row label={t('stMaterialsCost')} value={<Money value={preview.materials} symbol={sym} />} />
              <Row label={t('stCharges')} value={<Money value={preview.charges} symbol={sym} />} />
              <div className="border-t border-stone-200 pt-1.5">
                <Row label={<b>{t('stTotalCost')}</b>} value={<Money value={preview.total} symbol={sym} className="font-bold" />} />
              </div>
              <div className="mt-2 rounded-lg bg-surface px-3 py-2">
                <Row
                  label={output ? t('stUnitCostOf', { unit: output.unit }) : t('stUnitCost')}
                  value={<Money value={preview.unitCost} symbol={sym} className="text-lg font-bold text-brand-800" />}
                />
                {output && output.salePrice > 0 && preview.unitCost > 0 && (
                  <p className="num mt-1 text-xs text-stone-500">{t('stSaleVsCost', { price: fmtMoney(output.salePrice, sym) })}</p>
                )}
              </div>
            </dl>
          </div>
        </section>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-stone-600">{label}</dt>
      <dd className="num text-stone-900">{value}</dd>
    </div>
  )
}
