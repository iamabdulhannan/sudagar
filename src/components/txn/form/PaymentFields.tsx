import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { useBooks, useData } from '../../../lib/data'
import { fmtMoney } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import type { AccountKind, ID, PaymentMode, Txn } from '../../../lib/types'
import { Field, Select } from '../../ui'

export const MODES: PaymentMode[] = ['cash', 'bank', 'cheque', 'card', 'wallet', 'online']

/** a sensible payment mode for an account kind */
export const modeFor = (k?: AccountKind): PaymentMode => (k === 'bank' ? 'bank' : k === 'wallet' ? 'wallet' : 'cash')

/** the accounts a picker offers: active ones (and the current one); loan accounts only when asked */
export function useAccountChoices(value?: ID, opts: { exclude?: ID; allowLoan?: boolean } = {}) {
  const { accounts } = useData()
  return accounts.filter((a) => (a.active || a.id === value) && a.id !== opts.exclude && (opts.allowLoan || a.kind !== 'loan' || a.id === value))
}

/** a bare cash / bank account <select>; shows each account's balance */
export function AccountPicker({ value, onChange, exclude, allowLoan, className, label }: {
  value?: ID; onChange: (id: ID, kind?: AccountKind) => void; exclude?: ID; allowLoan?: boolean; className?: string; label?: string
}) {
  const { t } = useI18n()
  const { accountById, firm } = useData()
  const books = useBooks()
  const list = useAccountChoices(value, { exclude, allowLoan })
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value, accountById.get(e.target.value)?.kind)} className={className} aria-label={label ?? t('txAccount')}>
      {!value && <option value="">{t('select')}</option>}
      {list.map((a) => (
        <option key={a.id} value={a.id}>{a.name} ({fmtMoney(books.balances.get(`acc:${a.id}`) ?? 0, firm.currencySymbol)})</option>
      ))}
    </Select>
  )
}

/** cash / bank account picker with its label */
export function AccountSelect({ value, onChange, label, exclude, required, allowLoan }: {
  value?: ID; onChange: (id: ID, kind?: AccountKind) => void; label?: string; exclude?: ID; required?: boolean; allowLoan?: boolean
}) {
  const { t } = useI18n()
  return (
    <Field label={label ?? t('txAccount')} required={required}>
      <AccountPicker value={value} onChange={onChange} exclude={exclude} allowLoan={allowLoan} label={label} />
    </Field>
  )
}

export function ModeSelect({ value, onChange }: { value?: PaymentMode; onChange: (m: PaymentMode) => void }) {
  const { t } = useI18n()
  return (
    <Field label={t('txMode')}>
      <Select value={value ?? 'cash'} onChange={(e) => onChange(e.target.value as PaymentMode)}>
        {MODES.map((m) => <option key={m} value={m}>{t('pm_' + m)}</option>)}
      </Select>
    </Field>
  )
}

/** account + mode side by side; picking an account suggests its mode */
export function AccountModeFields({ draft, update }: { draft: Txn; update: (p: Partial<Txn>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <AccountSelect value={draft.accountId} onChange={(id, kind) => update({ accountId: id, paymentMode: modeFor(kind) })} required />
      <ModeSelect value={draft.paymentMode} onChange={(m) => update({ paymentMode: m })} />
    </div>
  )
}

/** amber (warn) or red (error) inline note */
export function Notice({ tone = 'warn', children, className }: { tone?: 'warn' | 'error' | 'info'; children: ReactNode; className?: string }) {
  return (
    <div className={cx(
      'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
      tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
      tone === 'error' && 'border-red-200 bg-red-50 text-red-800',
      tone === 'info' && 'border-sky-200 bg-sky-100 text-sky-800',
      className,
    )}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/** like Field but a <div>, for composite pickers that hold their own buttons */
export function BlockField({ label, required, children, className }: { label: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-[13px] font-medium text-stone-700">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
    </div>
  )
}
