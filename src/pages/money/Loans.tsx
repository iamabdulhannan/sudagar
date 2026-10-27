import { ArrowDownToLine, ArrowUpFromLine, BookOpen, HandCoins, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountFormModal } from '../../components/cash/AccountFormModal'
import { AccountIcon } from '../../components/cash/AccountIcon'
import { instalmentDrafts, loanSummary, receiveLoanDraft } from '../../components/cash/moneyLogic'
import { txnErrorText } from '../../components/txn/logic'
import { AccountSelect } from '../../components/txn/form/PaymentFields'
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Money, NumberInput, PageHeader, Stat, Textarea, useUi } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useBooks, useData, type FirmData } from '../../lib/data'
import { today, uid } from '../../lib/db'
import { round2 } from '../../lib/format'
import { translate, useI18n } from '../../lib/i18n'
import { accountPath } from '../../lib/paths'
import { saveTxn } from '../../lib/txn'
import type { Account, ID } from '../../lib/types'

/** /loans: money borrowed, what is still owed, and receiving / repaying it */
export default function Loans() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [receive, setReceive] = useState<Account | null>(null)
  const [repay, setRepay] = useState<Account | null>(null)
  const sym = data.firm.currencySymbol

  const loans = useMemo(() => data.accounts.filter((a) => a.kind === 'loan').map((a) => ({
    acc: a, s: loanSummary(a, data.txns, books.balances.get(`acc:${a.id}`) ?? 0),
  })), [data.accounts, data.txns, books])
  const owed = round2(loans.reduce((a, l) => a + l.s.owed, 0))
  const interest = round2(loans.reduce((a, l) => a + l.s.interest, 0))
  const repaid = round2(loans.reduce((a, l) => a + l.s.repaid, 0))

  const addBtn = <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('ln_add')}</Button>

  return (
    <div className="space-y-5">
      <PageHeader title={t('navLoans')} subtitle={t('ln_subtitle')} actions={addBtn} />

      {loans.length === 0 ? (
        <Card><Empty icon={<HandCoins className="size-7" />} title={t('ln_none')} text={t('ln_noneText')} action={addBtn} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label={t('ln_totalOwed')} tone="bad" value={<Money value={owed} symbol={sym} />} hint={t('ln_count', { n: loans.length })} />
            <Stat label={t('ln_repaid')} tone="good" value={<Money value={repaid} symbol={sym} />} />
            <Stat label={t('ln_interestPaid')} value={<Money value={interest} symbol={sym} />} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {loans.map(({ acc, s }) => (
              <Card key={acc.id} className={cx(!acc.active && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <AccountIcon kind="loan" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={accountPath(acc.id)} className="truncate font-semibold text-stone-900 hover:text-brand-700">{acc.name}</Link>
                      {!acc.active && <Badge>{t('inactive')}</Badge>}
                      {s.owed <= 0.001 && <Badge tone="good">{t('ln_paidOff')}</Badge>}
                    </div>
                    <div className="truncate text-xs text-stone-500">{[acc.bankName, acc.accountNo].filter(Boolean).join(', ') || t('ak_loan')}</div>
                  </div>
                  <IconButton label={t('edit')} onClick={() => setEditing(acc)}><Pencil className="size-4" /></IconButton>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-stone-500">{t('cb_loanOwed')}</div>
                  <Money value={s.owed} symbol={sym} className={cx('text-2xl font-bold', s.owed > 0.001 ? 'text-red-700' : 'text-emerald-700')} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-stone-500">{t('ln_taken')}</dt><dd><Money value={s.taken} symbol={sym} className="font-medium" /></dd></div>
                  <div><dt className="text-xs text-stone-500">{t('ln_repaid')}</dt><dd><Money value={s.repaid} symbol={sym} className="font-medium text-emerald-700" /></dd></div>
                  <div><dt className="text-xs text-stone-500">{t('ln_interestPaid')}</dt><dd><Money value={s.interest} symbol={sym} className="font-medium" /></dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setReceive(acc)}><ArrowDownToLine className="size-4" />{t('ln_receive')}</Button>
                  <Button size="sm" onClick={() => setRepay(acc)}><ArrowUpFromLine className="size-4" />{t('ln_payInstalment')}</Button>
                  <Link to={accountPath(acc.id)}><Button size="sm" variant="ghost"><BookOpen className="size-4" />{t('ln_statement')}</Button></Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <AccountFormModal open={adding} onClose={() => setAdding(false)} kind="loan" kinds={['loan']} />
      <AccountFormModal open={!!editing} onClose={() => setEditing(null)} initial={editing ?? undefined} />
      {receive && <ReceiveModal loan={receive} onClose={() => setReceive(null)} />}
      {repay && <InstalmentModal loan={repay} owed={loans.find((l) => l.acc.id === repay.id)?.s.owed ?? 0} onClose={() => setRepay(null)} />}
    </div>
  )
}

/** a bank or cash account to start the pickers with */
const firstMoneyAccount = (data: FirmData) =>
  data.accounts.find((a) => a.active && a.kind === 'bank')?.id ?? data.accounts.find((a) => a.active && a.kind !== 'loan')?.id

/** money received from the lender: a transfer loan → bank / cash */
function ReceiveModal({ loan, onClose }: { loan: Account; onClose: () => void }) {
  const { t } = useI18n()
  const data = useData()
  const { toast } = useUi()
  const [to, setTo] = useState<ID | undefined>(() => firstMoneyAccount(data))
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!to || !(amount > 0)) return
    setBusy(true)
    try {
      await saveTxn(data.db, receiveLoanDraft(data.settings, { loanId: loan.id, toAccountId: to, amount, date, notes: notes.trim() || undefined }))
      toast(t('saved'))
      onClose()
    } catch (e) {
      toast(txnErrorText(e, t), 'error')
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('ln_receiveTitle', { name: loan.name })}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={() => void save()} loading={busy} disabled={!to || !(amount > 0)}>{t('save')}</Button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-stone-600 sm:col-span-2">{t('ln_receiveHint')}</p>
        <Field label={t('amount')} required>
          <NumberInput value={amount} onValue={setAmount} autoFocus className="text-end font-semibold" />
        </Field>
        <Field label={t('date')} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <AccountSelect label={t('ln_receivedIn')} value={to} onChange={(id) => setTo(id)} required />
        </div>
        <Field label={t('notes')} className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** find the "Loan interest" expense head (English or Urdu name), creating it when missing */
async function interestHead(data: FirmData, name: string): Promise<ID> {
  const names = [translate('en', 'ln_interestHead'), translate('ur', 'ln_interestHead'), name].map((n) => n.trim().toLowerCase())
  const found = data.moneyCategories.find((c) => c.kind === 'expense' && names.includes(c.name.trim().toLowerCase()))
  if (found) return found.id
  const id = uid()
  await data.db.moneyCategories.add({ id, kind: 'expense', name })
  return id
}

/** an instalment: principal back to the loan (transfer) and interest as an expense, saved together */
function InstalmentModal({ loan, owed, onClose }: { loan: Account; owed: number; onClose: () => void }) {
  const { t } = useI18n()
  const data = useData()
  const { toast } = useUi()
  const sym = data.firm.currencySymbol
  const [from, setFrom] = useState<ID | undefined>(() => firstMoneyAccount(data))
  const [principal, setPrincipal] = useState(0)
  const [interest, setInterest] = useState(0)
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const total = round2(principal + interest)
  const ok = !!from && principal >= 0 && interest >= 0 && total > 0

  const save = async () => {
    if (!ok || !from) return
    setBusy(true)
    const db = data.db
    try {
      await db.transaction('rw', [db.txns, db.settings, db.audit, db.moneyCategories], async () => {
        const head = interest > 0 ? await interestHead(data, t('ln_interestHead')) : undefined
        for (const d of instalmentDrafts(data.settings, { loanId: loan.id, fromAccountId: from, principal, interest, interestHeadId: head, date, notes: notes.trim() || undefined })) {
          await saveTxn(db, d)
        }
      })
      toast(t('ln_instalmentSaved'))
      onClose()
    } catch (e) {
      toast(txnErrorText(e, t), 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('ln_instalmentTitle', { name: loan.name })}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={() => void save()} loading={busy} disabled={!ok}>{t('save')}</Button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-stone-600 sm:col-span-2">{t('ln_owedNow')}: <Money value={owed} symbol={sym} className="font-semibold text-red-700" /></p>
        <Field label={t('ln_principal')} hint={t('ln_principalHint')}>
          <NumberInput value={principal} onValue={(n) => setPrincipal(Math.max(0, n))} autoFocus className="text-end font-semibold" />
        </Field>
        <Field label={t('ln_interest')} hint={t('ln_interestHint')}>
          <NumberInput value={interest} onValue={(n) => setInterest(Math.max(0, n))} className="text-end" />
        </Field>
        <div className="sm:col-span-2">
          <AccountSelect label={t('ln_paidFrom')} value={from} onChange={(id) => setFrom(id)} required />
        </div>
        <Field label={t('date')} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex items-end justify-end pb-2 text-sm text-stone-600">
          {t('total')}: <Money value={total} symbol={sym} className="ms-1.5 text-base font-bold text-stone-900" />
        </div>
        {principal > owed + 0.001 && <p className="text-xs text-amber-700 sm:col-span-2">{t('ln_overOwed')}</p>}
        <Field label={t('notes')} className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
