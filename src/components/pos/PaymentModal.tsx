import { Banknote, CreditCard, Landmark, Plus, Smartphone, Split, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { fmtMoney, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { uid } from '../../lib/db'
import type { Account, AccountKind, ID, Party, PaymentMode, PaymentSplit } from '../../lib/types'
import { Button, Field, IconButton, Modal, NumberInput, Select } from '../ui'
import { quickAmounts, splitTotals } from './cart'

export type PosMethod = 'cash' | 'card' | 'bank' | 'wallet'

const METHODS: { m: PosMethod; icon: ReactNode; kinds: AccountKind[] }[] = [
  { m: 'cash', icon: <Banknote className="size-5" />, kinds: ['cash'] },
  { m: 'card', icon: <CreditCard className="size-5" />, kinds: ['bank'] },
  { m: 'bank', icon: <Landmark className="size-5" />, kinds: ['bank'] },
  { m: 'wallet', icon: <Smartphone className="size-5" />, kinds: ['wallet', 'bank'] },
]

export interface PaymentResult {
  received: number
  accountId?: ID
  paymentMode: PaymentMode
  /** cash handed back to the customer */
  change: number
  /** paid in several ways (only when more than one) */
  payments?: PaymentSplit[]
  /** cash handed over by the customer */
  tendered?: number
}

/** one row of a split payment */
interface SplitRow { key: string; method: PosMethod; accountId?: ID; amount: number }


/** default account for a method: the settings cash account for cash, else the first account of the matching kind */
export function accountFor(m: PosMethod, accounts: Account[], defaultId?: ID): ID | undefined {
  const active = accounts.filter((a) => a.active && a.kind !== 'loan')
  if (m === 'cash') return (defaultId && active.find((a) => a.id === defaultId)?.id) ?? active.find((a) => a.kind === 'cash')?.id ?? active[0]?.id
  for (const k of METHODS.find((x) => x.m === m)!.kinds) {
    const a = active.find((x) => x.kind === k)
    if (a) return a.id
  }
  return active[0]?.id
}

/** take payment for the bill: method, account, cash tendered with change, or on credit for a party */
export function PaymentModal({ open, onClose, total, party, saving, onConfirm }: {
  open: boolean
  onClose: () => void
  total: number
  party?: Party
  saving: boolean
  onConfirm: (p: PaymentResult) => void
}) {
  const { accounts, settings, firm } = useData()
  const { t } = useI18n()
  const sym = firm.currencySymbol
  const [method, setMethod] = useState<PosMethod>('cash')
  const [accountId, setAccountId] = useState<ID | undefined>()
  const [amount, setAmount] = useState(total)
  const [split, setSplit] = useState(false)
  const [rows, setRows] = useState<SplitRow[]>([])
  const amountBox = useRef<HTMLDivElement>(null)
  const focusAmount = () => amountBox.current?.querySelector('input')?.select()

  useEffect(() => {
    if (!open) return
    setMethod('cash')
    setAccountId(accountFor('cash', accounts, settings.defaultAccountId))
    setAmount(total)
    setSplit(false)
    setRows([])
    setTimeout(focusAmount, 30)
    // reset only when the modal opens
  }, [open])

  const row = (m: PosMethod, amt: number): SplitRow => ({ key: uid(), method: m, accountId: accountFor(m, accounts, settings.defaultAccountId), amount: round2(Math.max(0, amt)) })
  const startSplit = () => {
    const first = round2(Math.min(Math.max(amount, 0), total))
    const rest = round2(total - first)
    setRows(rest > 0 ? [row(method, first), row(method === 'cash' ? 'card' : 'cash', rest)] : [row(method, first), row(method === 'cash' ? 'card' : 'cash', 0)])
    setSplit(true)
  }
  const setRow = (key: string, patch: Partial<SplitRow>) => setRows((rs) => rs.map((r) => {
    if (r.key !== key) return r
    const next = { ...r, ...patch }
    if (patch.method && !patch.accountId) next.accountId = accountFor(patch.method, accounts, settings.defaultAccountId)
    return next
  }))
  const sums = splitTotals(rows, total)

  const pick = (m: PosMethod) => {
    setMethod(m)
    setAccountId(accountFor(m, accounts, settings.defaultAccountId))
    if (m !== 'cash' && amount > total) setAmount(total)
    setTimeout(focusAmount, 0)
  }

  const isCash = method === 'cash'
  const received = round2(Math.min(Math.max(amount, 0), total))
  const change = isCash ? round2(Math.max(amount - total, 0)) : 0
  const due = round2(total - received)
  const quick = useMemo(() => quickAmounts(total), [total])
  const activeAccounts = accounts.filter((a) => (a.active && a.kind !== 'loan') || a.id === accountId)

  let problem = ''
  if (split) {
    if (sums.remaining < -0.001) problem = t('errReceived')
    else if (sums.remaining > 0.001 && !party) problem = t('errWalkinUnpaid')
    else if (rows.some((r) => r.amount > 0 && !r.accountId)) problem = t('errAccount')
  } else if (due > 0.001 && !party) problem = t('errWalkinUnpaid')
  else if (!isCash && amount > total + 0.001) problem = t('errReceived')
  else if (received > 0 && !accountId) problem = t('errAccount')

  const confirm = (credit = false) => {
    if (saving) return
    if (credit) {
      if (!party) return
      onConfirm({ received: 0, accountId: undefined, paymentMode: 'cash', change: 0 })
      return
    }
    if (problem) return
    if (split) {
      const paid = rows.filter((r) => r.amount > 0)
      const payments: PaymentSplit[] = paid.map((r) => ({ accountId: r.accountId!, mode: r.method, amount: round2(r.amount) }))
      const cash = paid.filter((r) => r.method === 'cash').reduce((a, r) => a + r.amount, 0)
      if (payments.length <= 1) {
        const p = payments[0]
        onConfirm({ received: p?.amount ?? 0, accountId: p?.accountId, paymentMode: p?.mode ?? 'cash', change: 0, tendered: cash > 0 ? round2(cash) : undefined })
      } else {
        onConfirm({ received: sums.paid, accountId: payments[0].accountId, paymentMode: payments[0].mode, change: 0, payments, tendered: cash > 0 ? round2(cash) : undefined })
      }
      return
    }
    onConfirm({
      received, accountId: received > 0 ? accountId : undefined, paymentMode: method, change,
      tendered: isCash && amount > 0 ? round2(amount) : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('posPayment')}
      footer={<>
        {party && <Button variant="secondary" onClick={() => confirm(true)} disabled={saving}>{t('posOnCredit')}</Button>}
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="success" size="lg" onClick={() => confirm()} loading={saving} disabled={!!problem}>{t('posSaveBill')}</Button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); confirm() }} className="space-y-4">
        <div className="rounded-xl bg-stone-900 px-4 py-3 text-center text-white">
          <div className="text-xs font-medium tracking-wide text-white/60 uppercase">{t('posToPay')}</div>
          <div className="num text-3xl font-bold">{fmtMoney(total, sym)}</div>
        </div>

        {split ? (
          <SplitRows
            rows={rows}
            accounts={activeAccounts}
            sym={sym}
            remaining={sums.remaining}
            onChange={setRow}
            onRemove={(key) => setRows((rs) => rs.filter((r) => r.key !== key))}
            onAdd={() => setRows((rs) => [...rs, row('cash', Math.max(0, sums.remaining))])}
            onSingle={() => { setSplit(false); setTimeout(focusAmount, 0) }}
          />
        ) : <>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('posMethod')}>
            {METHODS.map(({ m, icon }) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => pick(m)}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold cursor-pointer',
                  method === m ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-600 hover:bg-stone-50',
                )}
              >
                {icon}{t('pm_' + m)}
              </button>
            ))}
          </div>

          <Field label={t('posAccount')}>
            <Select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value || undefined)}>
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>

          <Field label={isCash ? t('posTendered') : t('posAmountPaid')}>
            <div ref={amountBox}>
              <NumberInput value={amount} onValue={setAmount} className="h-12 text-xl font-semibold" />
            </div>
          </Field>

          {isCash && (
            <div className="flex flex-wrap gap-2">
              {quick.map((v, i) => (
                <Button key={v} variant="secondary" size="sm" onClick={() => setAmount(v)} className={cx('num', amount === v && 'border-brand-700 text-brand-800')}>
                  {i === 0 ? t('posExact') : fmtMoney(v, sym)}
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className={cx('rounded-xl border px-3 py-2', change > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200')}>
              <div className="text-xs font-medium text-stone-500">{t('posChange')}</div>
              <div className={cx('num text-xl font-bold', change > 0 ? 'text-emerald-700' : 'text-stone-400')}>{fmtMoney(change, sym)}</div>
            </div>
            <div className={cx('rounded-xl border px-3 py-2', due > 0 ? 'border-amber-300 bg-amber-50' : 'border-stone-200')}>
              <div className="text-xs font-medium text-stone-500">{t('posBalanceDue')}</div>
              <div className={cx('num text-xl font-bold', due > 0 ? 'text-amber-700' : 'text-stone-400')}>{fmtMoney(due, sym)}</div>
            </div>
          </div>
          {due > 0 && party && <p className="text-xs text-stone-500">{t('posDueToParty', { name: party.name })}</p>}
          <Button variant="ghost" size="sm" onClick={startSplit} className="w-full border border-dashed border-stone-300">
            <Split className="size-4" />{t('posSplit')}
          </Button>
        </>}
        {split && sums.remaining > 0.001 && party && <p className="text-xs text-stone-500">{t('posDueToParty', { name: party.name })}</p>}
        {problem && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{problem}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

const METHOD_LIST: PosMethod[] = ['cash', 'card', 'bank', 'wallet']

/** split payment: rows of method + account + amount, with what is left to pay */
function SplitRows({ rows, accounts, sym, remaining, onChange, onRemove, onAdd, onSingle }: {
  rows: SplitRow[]
  accounts: Account[]
  sym: string
  remaining: number
  onChange: (key: string, patch: Partial<SplitRow>) => void
  onRemove: (key: string) => void
  onAdd: () => void
  onSingle: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-700">{t('posSplitTitle')}</span>
        <Button variant="ghost" size="xs" onClick={onSingle}>{t('posSingle')}</Button>
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[110px_1fr_110px_auto] items-center gap-1.5">
          <Select value={r.method} onChange={(e) => onChange(r.key, { method: e.target.value as PosMethod })} className="h-9 px-2 text-xs" aria-label={t('posMethod')}>
            {METHOD_LIST.map((m) => <option key={m} value={m}>{t('pm_' + m)}</option>)}
          </Select>
          <Select value={r.accountId ?? ''} onChange={(e) => onChange(r.key, { accountId: e.target.value || undefined })} className="h-9 px-2 text-xs" aria-label={t('posAccount')}>
            <option value="">{t('select')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <NumberInput value={r.amount} onValue={(n) => onChange(r.key, { amount: Math.max(0, n) })} className="h-9 text-end" aria-label={t('amount')} autoFocus={i === rows.length - 1 && i > 0} />
          {rows.length > 1
            ? <IconButton label={t('delete')} onClick={() => onRemove(r.key)} className="size-8 hover:text-red-700"><X className="size-4" /></IconButton>
            : <span className="size-8" />}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={onAdd}><Plus className="size-3.5" />{t('posAddPayment')}</Button>
        <div className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', Math.abs(remaining) < 0.005 ? 'bg-emerald-50 text-emerald-800' : remaining > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800')}>
          {remaining >= 0 ? t('posRemaining') : t('posOverpaid')}: <span className="num">{fmtMoney(Math.abs(remaining), sym)}</span>
        </div>
      </div>
    </div>
  )
}
