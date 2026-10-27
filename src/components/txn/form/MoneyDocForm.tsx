import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBooks, useData } from '../../../lib/data'
import { today } from '../../../lib/db'
import { fmtDate, fmtMoney, round2 } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { txnPath } from '../../../lib/paths'
import type { ID } from '../../../lib/types'
import { PartyPicker } from '../../parties/PartyPicker'
import { Button, Card, Field, Input, Money, NumberInput, Select, Textarea } from '../../ui'
import { previewNumber } from '../logic'
import { CategorySelect } from './CategorySelect'
import { PartyBalance } from './PartyBalance'
import { AccountModeFields, AccountSelect, BlockField, Notice } from './PaymentFields'
import type { DraftApi } from './useDraft'

/** payment in / out, other income and transfers */
export function MoneyDocForm({ api }: { api: DraftApi }) {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { draft: d, update, isNew, original } = api
  const type = d.type
  const sym = data.firm.currencySymbol
  const isPayment = type === 'payment_in' || type === 'payment_out'

  // party balance without this payment (when editing, add its effect back)
  const partyBal = d.partyId ? books.balances.get(`party:${d.partyId}`) ?? 0 : 0
  const origEffect = original && !original.cancelled && original.partyId === d.partyId ? original.total : 0
  const before = type === 'payment_in' ? partyBal + origEffect : partyBal - origEffect
  const outstanding = type === 'payment_in' ? Math.max(0, before) : Math.max(0, -before)

  const accBal = (id?: ID) => (id ? books.balances.get(`acc:${id}`) ?? 0 : 0)
  const fromBal = accBal(d.accountId) + (original?.type === 'transfer' && original.accountId === d.accountId ? original.total : 0)
  const fromLoan = data.accountById.get(d.accountId ?? '')?.kind === 'loan'
  const cheque = isPayment && d.paymentMode === 'cheque'

  const top = (
    <>
      <Field label={t('txNumber')}>
        <Input value={isNew ? previewNumber(type, data.settings) : d.number} readOnly className="num bg-stone-50" />
      </Field>
      <Field label={t('date')} required>
        <Input type="date" value={d.date} onChange={(e) => update({ date: e.target.value })} />
      </Field>
    </>
  )
  const amount = (
    <Field label={t('amount')} required>
      <NumberInput value={d.total} onValue={(n) => update({ total: n })} className="h-12 text-end text-xl font-bold" autoFocus={isNew && (!isPayment || !!d.partyId)} />
    </Field>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {isPayment && (
            <div className="sm:col-span-2">
              <BlockField label={type === 'payment_in' ? t('txReceivedFromParty') : t('txPaidToParty')} required>
                <PartyPicker value={d.partyId} onChange={(id) => update({ partyId: id })} side={type === 'payment_in' ? 'sale' : 'purchase'} autoFocus={isNew && !d.partyId} />
              </BlockField>
              <PartyBalance partyId={d.partyId} className="mt-1" />
            </div>
          )}
          {type === 'other_income' && <div className="sm:col-span-2"><CategorySelect kind="income" value={d.categoryId} onChange={(id) => update({ categoryId: id })} /></div>}
          {top}

          {type === 'transfer' ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div>
                <AccountSelect label={t('txFromAccount')} value={d.accountId} onChange={(id) => update({ accountId: id })} required allowLoan />
              </div>
              <ArrowRight className="mx-auto mb-3 hidden size-5 text-stone-400 sm:block rtl:rotate-180" />
              <div>
                <AccountSelect label={t('txToAccount')} value={d.toAccountId} onChange={(id) => update({ toAccountId: id })} exclude={d.accountId} required allowLoan />
              </div>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            {amount}
            {isPayment && outstanding > 0.001 && Math.abs(d.total - outstanding) > 0.001 && (
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => update({ total: round2(outstanding) })}>
                {t('txFullBalance', { amount: fmtMoney(outstanding, sym) })}
              </Button>
            )}
            {isPayment && d.partyId && d.total > outstanding + 0.001 && (
              <p className="mt-1 text-xs text-stone-500">{t(type === 'payment_in' ? 'txAdvanceIn' : 'txAdvanceOut', { amount: fmtMoney(d.total - outstanding, sym) })}</p>
            )}
          </div>

          {type !== 'transfer' && <div className="sm:col-span-2"><AccountModeFields draft={d} update={update} /></div>}
          {(type === 'capital_in' || type === 'drawing') && (
            <p className="text-sm text-stone-500 sm:col-span-2">{t(type === 'capital_in' ? 'txCapitalHint' : 'txDrawingHint')}</p>
          )}
          {cheque && (
            <div className="grid gap-3 rounded-lg bg-stone-50 p-3 sm:col-span-2 sm:grid-cols-3">
              <Field label={t('txChequeDate')}>
                <Input type="date" value={d.chequeDate ?? ''} onChange={(e) => update({ chequeDate: e.target.value || undefined })} />
              </Field>
              <Field label={t('txChequeStatus')} hint={d.chequeStatus === 'open' ? t(type === 'payment_in' ? 'txChequeOpenHintIn' : 'txChequeOpenHintOut') : undefined}>
                <Select
                  value={d.chequeStatus ?? ''}
                  onChange={(e) => {
                    const v = e.target.value as '' | 'open' | 'cleared' | 'bounced'
                    update({ chequeStatus: v || undefined, clearedOn: v === 'cleared' ? d.clearedOn ?? today() : undefined })
                  }}
                >
                  {!d.chequeStatus && <option value="">{t('txChequeUntracked')}</option>}
                  <option value="open">{t(type === 'payment_in' ? 'chq_open_in' : 'chq_open_out')}</option>
                  <option value="cleared">{t('txChequeClearedNow')}</option>
                  {d.chequeStatus === 'bounced' && <option value="bounced">{t('chq_bounced')}</option>}
                </Select>
              </Field>
              {d.chequeStatus === 'cleared' && (
                <Field label={t('txClearedOn')} required>
                  <Input type="date" value={d.clearedOn ?? ''} min={d.date} onChange={(e) => update({ clearedOn: e.target.value || undefined })} />
                </Field>
              )}
            </div>
          )}
          {type === 'transfer' && d.accountId && !fromLoan && d.total > fromBal + 0.001 && (
            <Notice className="sm:col-span-2">{t('txTransferOver', { amount: fmtMoney(fromBal, sym) })}</Notice>
          )}

          {type !== 'transfer' && (
            <Field label={cheque ? t('txChequeNo') : t('txChequeRef')} className="sm:col-span-2">
              <Input value={d.refNo ?? ''} onChange={(e) => update({ refNo: e.target.value || undefined })} />
            </Field>
          )}
          <Field label={t('notes')} className="sm:col-span-2">
            <Textarea rows={2} value={d.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} />
          </Field>
        </div>
      </Card>

      {isPayment && <OpenInvoices api={api} />}
      {type === 'transfer' && (
        <Card title={t('txBalances')}>
          <dl className="space-y-2 text-sm">
            {data.accounts.filter((a) => a.active).map((a) => (
              <div key={a.id} className="flex justify-between gap-3">
                <dt className="text-stone-600">{a.name}</dt>
                <dd><Money value={accBal(a.id)} symbol={sym} tone /></dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  )
}

/** read-only list of the party's unpaid invoices and how this payment settles them (oldest first) */
function OpenInvoices({ api }: { api: DraftApi }) {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { draft: d, isNew } = api
  const sym = data.firm.currencySymbol
  const invType = d.type === 'payment_in' ? 'sale' : 'purchase'
  const open = useMemo(() => {
    if (!d.partyId) return []
    return data.txns
      .filter((x) => x.type === invType && x.partyId === d.partyId && !x.cancelled && (books.dues.get(x.id)?.due ?? 0) > 0.001)
      .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  }, [data.txns, d.partyId, invType, books.dues])
  if (!d.partyId) return null
  let left = isNew ? d.total : 0
  const totalDue = round2(open.reduce((a, x) => a + (books.dues.get(x.id)?.due ?? 0), 0))
  const todayStr = today()
  return (
    <Card title={t('txOpenInvoices')} actions={<Money value={totalDue} symbol={sym} className="font-semibold text-red-700" />} padded={false}>
      {open.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-500">{t('txNoOpenInvoices')}</p>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('number')}</th>
                <th>{t('txDueDate')}</th>
                <th className="r">{t('txDue')}</th>
                {isNew && <th className="r">{t('txSettles')}</th>}
              </tr>
            </thead>
            <tbody>
              {open.map((x) => {
                const due = books.dues.get(x.id)?.due ?? 0
                const use = Math.min(left, due)
                left = round2(left - use)
                return (
                  <tr key={x.id}>
                    <td>
                      <Link to={txnPath(x.type, x.id)} className="num font-medium text-brand-700 hover:underline">{x.number}</Link>
                      <div className="num text-[11px] text-stone-500">{fmtDate(x.date)} · <Money value={x.total} symbol={sym} /></div>
                    </td>
                    <td className={'num ' + (x.dueDate && x.dueDate < todayStr ? 'text-red-700' : 'text-stone-600')}>{fmtDate(x.dueDate) || '-'}</td>
                    <td className="r"><Money value={due} symbol={sym} /></td>
                    {isNew && <td className="r">{use > 0 ? <Money value={use} symbol={sym} className="font-semibold text-emerald-700" /> : <span className="text-stone-400">-</span>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isNew && open.length > 0 && <p className="px-4 py-2 text-xs text-stone-500">{t('txDuesAfterThis')}</p>}
    </Card>
  )
}

