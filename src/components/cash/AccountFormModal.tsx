import { useId, useState, type FormEvent } from 'react'
import { useData } from '../../lib/data'
import { today, uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { Account, AccountKind } from '../../lib/types'
import { Button, Field, Input, Modal, NumberInput, Toggle, useUi } from '../ui'
import { AccountIcon } from './AccountIcon'
import { loanOpening } from './moneyLogic'

interface Props {
  open: boolean
  onClose: () => void
  /** edit this account; omit to add a new one */
  initial?: Account
  onSaved?: (a: Account) => void
  /** kind of a new account (e.g. 'loan' from the Loans page) */
  kind?: AccountKind
  /** account types offered; defaults to all four */
  kinds?: AccountKind[]
}

/** add / edit a cash, bank or mobile wallet account */
export function AccountFormModal(p: Props) {
  if (!p.open) return null
  return <AccountForm {...p} />
}

function AccountForm({ onClose, initial, onSaved, kind, kinds }: Props) {
  const { t } = useI18n()
  const { db, accounts, settings } = useData()
  const { toast } = useUi()
  const formId = useId()
  const [d, setD] = useState<Account>(() => initial ?? {
    id: uid(), kind: kind ?? 'bank', name: '', openingBalance: 0, openingDate: today(), active: true, createdAt: Date.now(),
  })
  const loan = d.kind === 'loan'
  const offered = kinds ?? (['cash', 'bank', 'wallet', 'loan'] as AccountKind[])
  // a loan's opening balance is typed as the amount owed and stored negative
  const shownOpening = loan ? -d.openingBalance : d.openingBalance
  const [nameErr, setNameErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Account>) => setD((x) => ({ ...x, ...patch }))
  const isDefault = initial?.id === settings.defaultAccountId

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const name = d.name.trim()
    if (!name) { setNameErr(t('errRequired')); return }
    if (accounts.some((a) => a.id !== d.id && a.name.trim().toLowerCase() === name.toLowerCase())) { setNameErr(t('cb_nameTaken')); return }
    setBusy(true)
    try {
      const acc: Account = {
        ...d,
        name,
        bankName: d.kind === 'cash' ? undefined : d.bankName?.trim() || undefined,
        accountNo: d.kind === 'cash' ? undefined : d.accountNo?.trim() || undefined,
        openingBalance: loan ? loanOpening(-d.openingBalance) : d.openingBalance,
        openingDate: d.openingDate || today(),
        active: isDefault ? true : d.active,
      }
      await db.transaction('rw', [db.accounts, db.audit], async () => {
        await db.accounts.put(acc)
        await db.audit.add({ at: Date.now(), action: initial ? 'update' : 'create', entity: 'account', entityId: acc.id, summary: `${acc.kind} ${acc.name} ${acc.openingBalance}` })
      })
      toast(t('saved'))
      onSaved?.(acc)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('somethingWrong'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? t('cb_editAccount') : t('cb_addAccount')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form={formId} loading={busy}>{t('save')}</Button>
      </>}
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('cb_accountType')} className="sm:col-span-2">
          <div role="radiogroup" className={offered.length > 3 ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid grid-cols-3 gap-2'}>
            {offered.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.kind === k}
                // switching to or from a loan flips the sign of the opening balance
                onClick={() => set({ kind: k, openingBalance: (k === 'loan') !== loan ? -d.openingBalance : d.openingBalance })}
                className={
                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition-colors cursor-pointer ' +
                  (d.kind === k ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-600 hover:bg-stone-50')
                }
              >
                <AccountIcon kind={k} className="size-8" />
                {t('ak_' + k)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('cb_accountName')} required error={nameErr} className="sm:col-span-2">
          <Input
            autoFocus
            value={d.name}
            onChange={(e) => { set({ name: e.target.value }); setNameErr('') }}
            placeholder={d.kind === 'cash' ? t('cb_namePhCash') : d.kind === 'bank' ? t('cb_namePhBank') : loan ? t('cb_namePhLoan') : t('cb_namePhWallet')}
          />
        </Field>
        {d.kind !== 'cash' && <>
          <Field label={d.kind === 'bank' ? t('cb_bankName') : loan ? t('cb_lender') : t('cb_walletProvider')}>
            <Input value={d.bankName ?? ''} onChange={(e) => set({ bankName: e.target.value })} placeholder={d.kind === 'bank' || loan ? 'Meezan Bank' : 'JazzCash'} />
          </Field>
          <Field label={d.kind === 'bank' ? t('cb_accountNo') : loan ? t('cb_loanNo') : t('cb_walletNo')}>
            <Input value={d.accountNo ?? ''} onChange={(e) => set({ accountNo: e.target.value })} className="num" />
          </Field>
        </>}
        <Field label={loan ? t('cb_loanOwed') : t('cb_openingBalance')} hint={loan ? t('cb_loanOpeningHint') : t('cb_openingHint')}>
          <NumberInput value={shownOpening} onValue={(n) => set({ openingBalance: loan ? -Math.abs(n) : n })} placeholder="0" />
        </Field>
        <Field label={t('pt_asOf')}>
          <Input type="date" value={d.openingDate} onChange={(e) => set({ openingDate: e.target.value })} />
        </Field>
        {!isDefault && (
          <div className="sm:col-span-2">
            <Toggle checked={d.active} onChange={(v) => set({ active: v })} label={t('active')} hint={t('cb_activeHint')} />
          </div>
        )}
      </form>
    </Modal>
  )
}
