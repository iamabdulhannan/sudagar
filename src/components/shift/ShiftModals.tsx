import { ArrowDownToLine, ArrowUpFromLine, Landmark, LockOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { openDrawer } from '../../lib/drawer'
import { fmtMoney, round2 } from '../../lib/format'
import { translate, useI18n, type Lang } from '../../lib/i18n'
import { addCashMove, closeShift, countTotal, openShift, registerName, setRegisterName, summarizeShift } from '../../lib/shift'
import type { CashMoveType, Denoms, Shift } from '../../lib/types'
import { printNode } from '../PrintPortal'
import { Button, Field, Input, Modal, NumberInput, Select, Tabs, Textarea, useUi } from '../ui'
import { cx } from '../../lib/cx'
import { DenomCounter, useCashierName } from './DenomCounter'
import { ShiftReport } from './ShiftReport'

/** print an X (so far) or Z (closing) report on the receipt printer */
export function printShiftReport(data: ReturnType<typeof useData>, shift: Shift, kind: 'x' | 'z') {
  const lang = (document.documentElement.lang === 'ur' ? 'ur' : 'en') as Lang
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v)
  const sum = summarizeShift(shift, data.txns)
  printNode(<ShiftReport firm={data.firm} shift={shift} sum={sum} t={t} kind={kind} />, '80mm')
}

/** count or type an amount; returns the counted total and the note count */
function CountOrAmount({ count, setCount, amount, setAmount }: { count: Denoms; setCount: (d: Denoms) => void; amount: number | null; setAmount: (n: number | null) => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'count' | 'amount'>('count')
  return (
    <div>
      <Tabs value={mode} onChange={setMode} className="mb-3" tabs={[{ value: 'count', label: t('sh_count') }, { value: 'amount', label: t('sh_orAmount') }]} />
      {mode === 'count'
        ? <DenomCounter value={count} onChange={(d) => { setCount(d); setAmount(null) }} />
        : <NumberInput value={amount ?? countTotal(count)} onValue={(n) => setAmount(n)} className="h-12 text-lg font-semibold" autoFocus />}
    </div>
  )
}

export function OpenShiftModal({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened: (s: Shift) => void }) {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { toast } = useUi()
  const by = useCashierName()
  const cashAccounts = data.accounts.filter((a) => a.active && a.kind === 'cash')
  const [accountId, setAccountId] = useState(data.settings.defaultAccountId ?? cashAccounts[0]?.id ?? '')
  const [register, setRegister] = useState(registerName())
  const [count, setCount] = useState<Denoms>({})
  const [amount, setAmount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const float = amount ?? countTotal(count)
  const book = books.balances.get(`acc:${accountId}`) ?? 0
  const diff = round2(float - book)
  const sym = data.firm.currencySymbol

  const go = async () => {
    setBusy(true)
    try {
      setRegisterName(register)
      const s = await openShift(data.db, { accountId, float, count: amount === null ? count : undefined, by, bookBalance: book, register: register.trim() || 'Counter 1' })
      toast(t('sh_opened', { no: s.number }))
      onOpened(s)
      onClose()
    } catch (e) { toast(String(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('sh_open')} size="lg" footer={<>
      <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
      <Button onClick={go} loading={busy} disabled={!accountId}>{t('sh_open')}</Button>
    </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('sh_register')}><Input value={register} onChange={(e) => setRegister(e.target.value)} /></Field>
        <Field label={t('sh_drawer')}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-medium text-stone-700">{t('sh_float')}</div>
        <CountOrAmount count={count} setCount={setCount} amount={amount} setAmount={setAmount} />
      </div>
      <p className="mt-3 text-xs text-stone-500">{t('sh_book', { amount: fmtMoney(book, sym) })}</p>
      {Math.abs(diff) >= 0.01 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('sh_openDiff', { amount: fmtMoney(Math.abs(diff), sym), kind: diff > 0 ? t('sh_over') : t('sh_short') })}
        </p>
      )}
    </Modal>
  )
}

const MOVES: { type: CashMoveType; icon: typeof ArrowDownToLine; label: string; text: string }[] = [
  { type: 'pay_in', icon: ArrowDownToLine, label: 'sh_payIn', text: 'sh_payInText' },
  { type: 'pay_out', icon: ArrowUpFromLine, label: 'sh_payOut', text: 'sh_payOutText' },
  { type: 'drop', icon: Landmark, label: 'sh_drop', text: 'sh_dropText' },
  { type: 'no_sale', icon: LockOpen, label: 'sh_noSale', text: 'sh_noSaleText' },
]

export function CashMoveModal({ open, onClose, shift, initial = 'pay_out' }: { open: boolean; onClose: () => void; shift: Shift; initial?: CashMoveType }) {
  const { t } = useI18n()
  const data = useData()
  const { toast } = useUi()
  const by = useCashierName()
  const [type, setType] = useState<CashMoveType>(initial)
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const others = data.accounts.filter((a) => a.active && a.kind !== 'loan' && a.id !== shift.accountId)
  const heads = data.moneyCategories.filter((c) => c.kind === 'expense')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = (ty: CashMoveType) => { setType(ty); setTarget(ty === 'pay_in' ? 'capital' : ty === 'drop' ? others.find((a) => a.kind === 'bank')?.id ?? others[0]?.id ?? '' : (heads.find((h) => h.name === 'Other expenses') ?? heads[0])?.id ?? '') }
  // each time it opens: start on the chosen kind with its default target
  useEffect(() => { if (open) pick(initial) }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const need = type !== 'no_sale'
  const ok = !need || (amount > 0 && !!target)

  const save = async () => {
    setBusy(true)
    try {
      await addCashMove(data.db, shift, { type, amount: need ? amount : 0, reason: reason.trim() || undefined, by, target: target || undefined })
      if (type === 'no_sale' || (data.settings.drawerKick && type !== 'drop')) await openDrawer().catch(() => false)
      toast(t('sh_moveSaved'))
      setAmount(0); setReason('')
      onClose()
    } catch (e) { toast(String(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('sh_shift') + ' ' + shift.number} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
      <Button onClick={save} loading={busy} disabled={!ok}>{t('save')}</Button>
    </>}>
      <div className="grid grid-cols-2 gap-2">
        {MOVES.map((m) => (
          <button key={m.type} type="button" onClick={() => pick(m.type)} aria-pressed={type === m.type}
            className={cx('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-medium cursor-pointer', type === m.type ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600' : 'border-stone-200 text-stone-700 hover:border-stone-300')}>
            <m.icon className="size-4 shrink-0" />{t(m.label)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-500">{t(MOVES.find((m) => m.type === type)!.text)}</p>
      <div className="mt-4 space-y-4">
        {need && <Field label={t('amount')}><NumberInput value={amount} onValue={setAmount} className="h-12 text-lg font-semibold" autoFocus /></Field>}
        {type === 'pay_in' && (
          <Field label={t('sh_from')}>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="capital">{t('sh_fromOwner')}</option>
              {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        {type === 'pay_out' && (
          <Field label={t('sh_for')}>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="drawing">{t('sh_owner')}</option>
            </Select>
          </Field>
        )}
        {type === 'drop' && (
          <Field label={t('sh_to')}>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={t('sh_reason')}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/** blind close: count first, then see expected cash and the difference */
export function CloseShiftModal({ open, onClose, shift, onClosed }: { open: boolean; onClose: () => void; shift: Shift; onClosed: (s: Shift) => void }) {
  const { t } = useI18n()
  const data = useData()
  const { toast } = useUi()
  const by = useCashierName()
  const [count, setCount] = useState<Denoms>({})
  const [amount, setAmount] = useState<number | null>(null)
  const [counted, setCounted] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const total = amount ?? countTotal(count)
  const sum = useMemo(() => (open ? summarizeShift(shift, data.txns) : null), [open, shift, data.txns])
  const sym = data.firm.currencySymbol
  const diff = sum ? round2(total - sum.expected) : 0

  const close = async () => {
    setBusy(true)
    try {
      const closed = await closeShift(data.db, shift, { counted: total, count: amount === null ? count : undefined, by, notes: notes.trim() || undefined })
      toast(t('sh_closed', { no: closed.number }))
      onClosed(closed)
      printShiftReport({ ...data, txns: await data.db.txns.toArray() }, closed, 'z')
      onClose()
    } catch (e) { toast(String(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${t('sh_close')} ${shift.number}`} size="lg" footer={<>
      <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
      {counted
        ? <Button onClick={close} loading={busy}>{t('sh_closeConfirm')}</Button>
        : <Button onClick={() => setCounted(true)}>{t('continue')}</Button>}
    </>}>
      {!counted ? (
        <>
          <p className="mb-3 text-sm text-stone-500">{t('sh_blind')}</p>
          <CountOrAmount count={count} setCount={setCount} amount={amount} setAmount={setAmount} />
        </>
      ) : sum && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-stone-100 p-3"><div className="text-xs text-stone-500">{t('sh_expected')}</div><div className="num text-lg font-bold">{fmtMoney(sum.expected, sym)}</div></div>
            <div className="rounded-xl bg-stone-100 p-3"><div className="text-xs text-stone-500">{t('sh_counted')}</div><div className="num text-lg font-bold">{fmtMoney(total, sym)}</div></div>
            <div className={cx('rounded-xl p-3', diff === 0 ? 'bg-emerald-50 text-emerald-800' : diff > 0 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800')}>
              <div className="text-xs">{t('sh_difference')}</div>
              <div className="num text-lg font-bold">{diff === 0 ? t('sh_exact') : `${diff > 0 ? '+' : ''}${fmtMoney(diff, sym)}`}</div>
              {diff !== 0 && <div className="text-xs">{diff > 0 ? t('sh_over') : t('sh_short')}</div>}
            </div>
          </div>
          <ShiftNumbers shift={shift} />
          <Field label={t('sh_notes')}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          <Button variant="ghost" size="sm" onClick={() => setCounted(false)}>{t('back')}</Button>
        </div>
      )}
    </Modal>
  )
}

/** the summary table shown on screen (close dialog, shift history) */
export function ShiftNumbers({ shift }: { shift: Shift }) {
  const { t } = useI18n()
  const data = useData()
  const sum = useMemo(() => summarizeShift(shift, data.txns), [shift, data.txns])
  const m = (n: number) => fmtMoney(n, data.firm.currencySymbol)
  const c = sum.cash
  const rows: [string, number][] = [
    ['sh_openingFloat', shift.openingFloat], ['sh_cashSales', c.sales], ['sh_refunds', c.refunds], ['sh_receipts', c.receipts],
    ['sh_payments', c.payments], ['sh_other', c.other], ['sh_payIns', c.payIns], ['sh_payOuts', c.payOuts], ['sh_drops', c.drops],
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-stone-200 p-3 text-sm">
        <div className="mb-2 font-semibold text-stone-800">{t('sh_summary')}</div>
        <dl className="space-y-1">
          <div className="flex justify-between"><dt className="text-stone-500">{t('sh_bills')}</dt><dd className="num">{sum.saleCount}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">{t('sh_sales')}</dt><dd className="num font-semibold">{m(sum.saleTotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">{t('sh_returns')}</dt><dd className="num">{m(sum.returnTotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">{t('sh_discounts')}</dt><dd className="num">{m(sum.discountTotal)}</dd></div>
          {sum.creditSales > 0 && <div className="flex justify-between"><dt className="text-stone-500">{t('sh_credit')}</dt><dd className="num">{m(sum.creditSales)}</dd></div>}
          {Object.entries(sum.byMode).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-stone-500">{t('pm_' + k)}</dt><dd className="num">{m(v ?? 0)}</dd></div>)}
        </dl>
      </div>
      <div className="rounded-xl border border-stone-200 p-3 text-sm">
        <div className="mb-2 font-semibold text-stone-800">{t('sh_cashFlow')}</div>
        <dl className="space-y-1">
          {rows.filter(([k, v]) => v !== 0 || k === 'sh_openingFloat' || k === 'sh_cashSales').map(([k, v]) => (
            <div key={k} className="flex justify-between"><dt className="text-stone-500">{t(k)}</dt><dd className="num">{m(v)}</dd></div>
          ))}
          <div className="flex justify-between border-t border-stone-200 pt-1 font-semibold"><dt>{t('sh_expected')}</dt><dd className="num">{m(sum.expected)}</dd></div>
        </dl>
      </div>
    </div>
  )
}
