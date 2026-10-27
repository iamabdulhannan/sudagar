import { Ban, CheckCircle2, Landmark, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { chequeAge, chequeList, chequeTotals, type ChequeSide } from '../../components/cash/moneyLogic'
import { txnErrorText } from '../../components/txn/logic'
import { AccountSelect } from '../../components/txn/form/PaymentFields'
import { ChequeBadge } from '../../components/txn/StatusBadge'
import { Button, Card, Empty, Field, Input, Modal, Money, PageHeader, Select, Stat, Tabs, useUi } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { accountPath, partyPath, txnNewPath, txnPath } from '../../lib/paths'
import { setChequeStatus } from '../../lib/txn'
import type { ChequeStatus, Txn } from '../../lib/types'

/** /cheques: cheques received (in hand) and issued, with clear / bounce / reopen */
export default function Cheques() {
  const { t } = useI18n()
  const data = useData()
  const { toast, confirm } = useUi()
  const [side, setSide] = useState<ChequeSide>('received')
  const [status, setStatus] = useState<ChequeStatus | ''>('open')
  const [clearing, setClearing] = useState<Txn | null>(null)
  const sym = data.firm.currencySymbol
  const todayStr = today()

  const totals = useMemo(() => chequeTotals(data.txns), [data.txns])
  const rows = useMemo(() => chequeList(data.txns, side, status || undefined), [data.txns, side, status])
  const sum = rows.reduce((a, x) => a + x.total, 0)
  const party = (x: Txn) => (x.partyId ? data.partyById.get(x.partyId)?.name : x.partyName) ?? ''

  const run = async (x: Txn, s: ChequeStatus, clearedOn?: string, accountId?: string) => {
    try {
      await setChequeStatus(data.db, x, s, clearedOn, accountId)
      toast(t(s === 'cleared' ? 'chqClearedToast' : s === 'bounced' ? 'chqBouncedToast' : 'chqReopenedToast', { no: x.refNo || x.number }))
      return true
    } catch (e) {
      toast(txnErrorText(e, t), 'error')
      return false
    }
  }
  const bounce = async (x: Txn) => {
    const ok = await confirm({
      title: t('chqBounceQ', { no: x.refNo || x.number }),
      text: t(x.type === 'payment_in' ? 'chqBounceTextIn' : 'chqBounceTextOut', { party: party(x), amount: fmtMoney(x.total, sym) }),
      danger: true,
      okLabel: t('chqBounce'),
    })
    if (ok) await run(x, 'bounced')
  }

  const empty = !data.txns.some((x) => x.paymentMode === 'cheque' && x.chequeStatus)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('navCheques')}
        subtitle={t('chqSubtitle')}
        actions={<>
          <Link to={txnNewPath('payment_in')}><Button variant="secondary">{t('chqNewReceived')}</Button></Link>
          <Link to={txnNewPath('payment_out')}><Button variant="secondary">{t('chqNewIssued')}</Button></Link>
        </>}
      />

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('chqInHandTotal')} tone="good" value={<Money value={totals.inHand} symbol={sym} />} hint={t('chqCount', { n: totals.inHandCount })} onClick={() => { setSide('received'); setStatus('open') }} />
        <Stat label={t('chqIssuedTotal')} tone="bad" value={<Money value={totals.issued} symbol={sym} />} hint={t('chqCount', { n: totals.issuedCount })} onClick={() => { setSide('issued'); setStatus('open') }} />
      </div>

      {empty ? (
        <Card><Empty icon={<Landmark className="size-7" />} title={t('chqNone')} text={t('chqNoneText')} /></Card>
      ) : (
        <Card padded={false}>
          <Tabs
            value={side}
            onChange={setSide}
            tabs={[
              { value: 'received', label: t('chqReceived'), count: totals.inHandCount },
              { value: 'issued', label: t('chqIssued'), count: totals.issuedCount },
            ]}
            className="px-3"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ChequeStatus | '')} className="w-auto" aria-label={t('status')}>
              <option value="open">{t(side === 'received' ? 'chq_open_in' : 'chq_open_out')}</option>
              <option value="cleared">{t('chq_cleared')}</option>
              <option value="bounced">{t('chq_bounced')}</option>
              <option value="">{t('all')}</option>
            </Select>
            <span className="text-sm text-stone-500">{t('chqCount', { n: rows.length })} · <Money value={sum} symbol={sym} className="font-semibold text-stone-800" /></span>
          </div>
          {rows.length === 0 ? (
            <Empty title={t('noResults')} text={t('chqNoMatch')} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('txChequeDate')}</th>
                    <th>{t('txParty')}</th>
                    <th>{t('txChequeNo')}</th>
                    <th className="r">{t('amount')}</th>
                    <th>{t('txAccount')}</th>
                    <th>{t('status')}</th>
                    <th className="r">{t('chqAge')}</th>
                    <th className="r no-print"><span className="sr-only">{t('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => {
                    const acc = x.accountId ? data.accountById.get(x.accountId) : undefined
                    const age = chequeAge(x, todayStr)
                    const due = (x.chequeDate || x.date) > todayStr
                    return (
                      <tr key={x.id}>
                        <td className="whitespace-nowrap">
                          <span className="num">{fmtDate(x.chequeDate || x.date)}</span>
                          <Link to={txnPath(x.type, x.id)} className="num block text-[11px] text-brand-700 hover:underline">{x.number}</Link>
                        </td>
                        <td className="max-w-56 truncate">{x.partyId ? <Link to={partyPath(x.partyId)} className="hover:text-brand-700 hover:underline">{party(x)}</Link> : party(x)}</td>
                        <td className="num">{x.refNo || <span className="text-stone-400">-</span>}</td>
                        <td className="r font-semibold"><Money value={x.total} symbol={sym} /></td>
                        <td className="max-w-40 truncate text-stone-600">{acc ? <Link to={accountPath(acc.id)} className="hover:text-brand-700 hover:underline">{acc.name}</Link> : ''}</td>
                        <td>
                          <ChequeBadge txn={x} />
                          {x.chequeStatus === 'cleared' && x.clearedOn && <div className="num text-[11px] text-stone-500">{fmtDate(x.clearedOn)}</div>}
                        </td>
                        <td className={cx('r num whitespace-nowrap', x.chequeStatus === 'open' && age > 30 && 'font-semibold text-amber-700')}>
                          {x.chequeStatus !== 'open' ? '-' : due ? t('chqPostDated') : t('chqDays', { n: age })}
                        </td>
                        <td className="r no-print">
                          <div className="flex justify-end gap-1">
                            {x.chequeStatus === 'open' ? (
                              <>
                                <Button size="xs" variant="success" onClick={() => setClearing(x)}><CheckCircle2 className="size-3.5" />{t('chqClear')}</Button>
                                <Button size="xs" variant="secondary" className="text-red-700" onClick={() => void bounce(x)}><Ban className="size-3.5" />{t('chqBounce')}</Button>
                              </>
                            ) : (
                              <Button size="xs" variant="secondary" onClick={() => void run(x, 'open')}><RotateCcw className="size-3.5" />{t('chqReopen')}</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {clearing && <ClearModal txn={clearing} onClose={() => setClearing(null)} onClear={async (d, acc) => { if (await run(clearing, 'cleared', d, acc)) setClearing(null) }} />}
    </div>
  )
}

/** pick the date and the bank account the cheque cleared into */
function ClearModal({ txn, onClose, onClear }: { txn: Txn; onClose: () => void; onClear: (date: string, accountId: string) => Promise<void> }) {
  const { t } = useI18n()
  const { firm, accountById } = useData()
  const [date, setDate] = useState(today() < txn.date ? txn.date : today())
  const [acc, setAcc] = useState(txn.accountId && accountById.get(txn.accountId)?.kind !== 'cash' ? txn.accountId : '')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    await onClear(date, acc)
    setBusy(false)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('chqClearTitle', { no: txn.refNo || txn.number })}
      size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="success" onClick={() => void submit()} loading={busy} disabled={!date || !acc}>{t('chqClear')}</Button>
      </>}
    >
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          {t(txn.type === 'payment_in' ? 'chqClearTextIn' : 'chqClearTextOut')} <Money value={txn.total} symbol={firm.currencySymbol} className="font-semibold" />
        </p>
        <Field label={t('txClearedOn')} required>
          <Input type="date" value={date} min={txn.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <AccountSelect label={t(txn.type === 'payment_in' ? 'chqDepositedIn' : 'chqPaidFrom')} value={acc || undefined} onChange={(id) => setAcc(id)} required />
      </div>
    </Modal>
  )
}
