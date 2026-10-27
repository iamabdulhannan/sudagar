import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useBooks, useData } from '../../lib/data'
import { MAIN_GODOWN, today } from '../../lib/db'
import { fmtDate, fmtDateTime, fmtMoney, fmtQty, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { accountPath, partyPath, txnPath } from '../../lib/paths'
import { TXN_META, moneySplits } from '../../lib/txn'
import type { Txn } from '../../lib/types'
import { Card, Money } from '../ui'
import { amountPaid, balanceDue, docStatus, isInvoice, isReturn, linkedDocs } from './logic'
import { changeDue, isSplit } from './payLogic'
import { ChequeBadge, StatusBadge } from './StatusBadge'

/** "Cash Rs 500 + Card Rs 700" for a split payment */
export function useSplitText() {
  const { t } = useI18n()
  const { firm } = useData()
  return (x: Txn) => moneySplits(x).map((p) => `${t('pm_' + p.mode)} ${fmtMoney(p.amount, firm.currencySymbol)}`).join(' + ')
}

function Line({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-end font-medium text-stone-800">{children}</dd>
    </div>
  )
}

/** money summary and payment details of a document */
export function SummaryCard({ txn }: { txn: Txn }) {
  const { t } = useI18n()
  const { firm, accountById, moneyCategories, godowns, settings } = useData()
  const features = settings.features
  const books = useBooks()
  const sym = firm.currencySymbol
  const m = TXN_META[txn.type]
  const split = isSplit(txn)
  const change = changeDue(txn)
  const godown = (id?: string) => godowns.find((g) => g.id === (id || MAIN_GODOWN))?.name ?? ''
  const acc = txn.accountId ? accountById.get(txn.accountId) : undefined
  const to = txn.toAccountId ? accountById.get(txn.toAccountId) : undefined
  const cat = txn.categoryId ? moneyCategories.find((c) => c.id === txn.categoryId) : undefined
  const hasDue = isInvoice(txn.type) || isReturn(txn.type) || txn.type === 'expense'
  const isStock = m.side === 'stock'
  const due = balanceDue(txn, books.dues)
  return (
    <Card title={t('txSummary')}>
      <dl className="divide-y divide-stone-100">
        {!isStock && <Line k={t('total')}><Money value={txn.total} symbol={sym} className="text-base font-bold" /></Line>}
        {hasDue && m.posts && <Line k={t(txn.type === 'sale' ? 'txReceived' : txn.type === 'sale_return' ? 'txRefunded' : 'paid')}><Money value={amountPaid(txn, books.dues)} symbol={sym} /></Line>}
        {hasDue && m.posts && <Line k={t('txBalanceDue')}><Money value={due} symbol={sym} className={due > 0.001 ? 'text-red-700' : 'text-emerald-700'} /></Line>}
        {txn.dueDate && isInvoice(txn.type) && <Line k={t('txDueDate')}><span className={'num ' + (due > 0.001 && txn.dueDate < today() ? 'text-red-700' : '')}>{fmtDate(txn.dueDate)}</span></Line>}
        {cat && <Line k={t(txn.type === 'other_income' ? 'txIncomeHead' : 'txExpenseHead')}>{cat.name}</Line>}
        {split ? (
          moneySplits(txn).map((p, i) => {
            const a = accountById.get(p.accountId)
            return (
              <Line key={i} k={`${t('pm_' + p.mode)}${p.refNo ? ` (${p.refNo})` : ''}`}>
                <Money value={p.amount} symbol={sym} />
                {a && <Link className="block text-xs font-normal text-brand-700 hover:underline" to={accountPath(a.id)}>{a.name}</Link>}
              </Line>
            )
          })
        ) : (
          <>
            {acc && (txn.received > 0 || !m.lines) && <Line k={txn.type === 'transfer' ? t('txFromAccount') : t('txAccount')}><Link className="text-brand-700 hover:underline" to={accountPath(acc.id)}>{acc.name}</Link></Line>}
            {to && <Line k={t('txToAccount')}><Link className="text-brand-700 hover:underline" to={accountPath(to.id)}>{to.name}</Link></Line>}
            {txn.paymentMode && (txn.received > 0 || !m.lines) && txn.type !== 'transfer' && <Line k={t('txMode')}>{t('pm_' + txn.paymentMode)}</Line>}
          </>
        )}
        {change > 0 && <Line k={t('txCashGiven')}><Money value={txn.tendered ?? 0} symbol={sym} /></Line>}
        {change > 0 && <Line k={t('txChange')}><Money value={change} symbol={sym} /></Line>}
        {txn.refNo && <Line k={txn.type === 'purchase' ? t('txSupplierBillNo') : isReturn(txn.type) ? t('txAgainstInvoice') : txn.paymentMode === 'cheque' ? t('txChequeNo') : t('txRefNo')}><span className="num">{txn.refNo}</span></Line>}
        {txn.paymentMode === 'cheque' && txn.chequeStatus && <>
          {txn.chequeDate && <Line k={t('txChequeDate')}><span className="num">{fmtDate(txn.chequeDate)}</span></Line>}
          <Line k={t('txChequeStatus')}><ChequeBadge txn={txn} /></Line>
          {txn.clearedOn && txn.chequeStatus === 'cleared' && <Line k={t('txClearedOn')}><span className="num">{fmtDate(txn.clearedOn)}</span></Line>}
          <Line k=""><Link to="/cheques" className="text-xs text-brand-700 hover:underline">{t('txManageCheques')}</Link></Line>
        </>}
        {(m.lines && features.godowns && txn.type !== 'stock_transfer') && <Line k={t('txGodown')}>{godown(txn.godownId)}</Line>}
        {txn.type === 'stock_transfer' && <>
          <Line k={t('txFromGodown')}>{godown(txn.godownId)}</Line>
          <Line k={t('txToGodown')}>{godown(txn.toGodownId)}</Line>
          <Line k={t('txLinesCount')}><span className="num">{txn.lines.length}</span></Line>
        </>}
        {txn.type === 'manufacture' && <ManufactureLines txn={txn} />}
        {txn.pointsRedeemed ? <Line k={t('txPointsRedeemed')}><span className="num">{txn.pointsRedeemed}</span></Line> : null}
      </dl>
    </Card>
  )
}

/** item made, quantity, cost of materials, making charges and the cost per unit */
function ManufactureLines({ txn }: { txn: Txn }) {
  const { t } = useI18n()
  const { firm, itemById, accountById } = useData()
  const books = useBooks()
  const sym = firm.currencySymbol
  const out = txn.outputItemId ? itemById.get(txn.outputItemId) : undefined
  const materials = books.cogs.get(txn.id) ?? txn.subtotal
  const cost = round2(materials + (txn.charges || 0))
  const acc = txn.accountId ? accountById.get(txn.accountId) : undefined
  return (
    <>
      <Line k={t('txItemMade')}>{out ? <Link className="text-brand-700 hover:underline" to={'/items/' + out.id}>{out.name}</Link> : '-'}</Line>
      <Line k={t('txQtyMade')}><span className="num">{fmtQty(txn.outputQty || 0)} {out?.unit}</span></Line>
      <Line k={t('txMaterialsCost')}><Money value={materials} symbol={sym} /></Line>
      {txn.charges > 0 && <Line k={t('txMakingCharges')}><Money value={txn.charges} symbol={sym} />{acc && <span className="block text-xs font-normal text-stone-500">{acc.name}</span>}</Line>}
      <Line k={t('txTotalCost')}><Money value={cost} symbol={sym} className="font-bold" /></Line>
      {txn.outputQty ? <Line k={t('txUnitCost')}><Money value={round2(cost / txn.outputQty)} symbol={sym} /></Line> : null}
    </>
  )
}

/** the party of a document with its current balance */
export function PartyCard({ txn }: { txn: Txn }) {
  const { t } = useI18n()
  const { partyById, firm } = useData()
  const books = useBooks()
  const p = txn.partyId ? partyById.get(txn.partyId) : undefined
  if (!p && !txn.partyName && !txn.partyPhone) return null
  const bal = p ? books.balances.get(`party:${p.id}`) ?? 0 : 0
  return (
    <Card title={t('txParty')}>
      {p ? (
        <div className="space-y-1 text-sm">
          <Link to={partyPath(p.id)} className="text-base font-semibold text-brand-700 hover:underline">{p.name}</Link>
          {p.phone && <p className="num text-stone-600">{p.phone}</p>}
          {(p.address || p.city) && <p className="text-stone-600">{[p.address, p.city].filter(Boolean).join(', ')}</p>}
          <p className="pt-1 text-stone-500">
            {t('txCurrentBalance')}: <Money value={Math.abs(bal)} symbol={firm.currencySymbol} className={bal > 0.001 ? 'font-semibold text-red-700' : bal < -0.001 ? 'font-semibold text-emerald-700' : 'font-semibold'} />
            {Math.abs(bal) > 0.001 && <span> ({t(bal > 0 ? 'receivable' : 'payable')})</span>}
          </p>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-stone-800">{txn.partyName || t('walkIn')}</p>
          {txn.partyPhone && <p className="num text-stone-600">{txn.partyPhone}</p>}
        </div>
      )}
    </Card>
  )
}

/** source document, conversions and returns linked to this one */
export function LinkedCard({ txn }: { txn: Txn }) {
  const { t } = useI18n()
  const { txns, firm } = useData()
  const books = useBooks()
  const l = linkedDocs(txn, txns)
  const groups: [string, Txn[]][] = [
    [t('txConvertedFrom'), l.source ? [l.source] : []],
    [t('txAgainstInvoice'), l.against ? [l.against] : []],
    [t('txConvertedTo'), l.conversions],
    [t('txReturns'), l.returns],
  ]
  if (!groups.some(([, list]) => list.length)) return null
  const todayStr = today()
  return (
    <Card title={t('txLinked')}>
      <div className="space-y-3">
        {groups.filter(([, list]) => list.length).map(([title, list]) => (
          <div key={title}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</div>
            <ul className="space-y-1">
              {list.map((x) => (
                <li key={x.id}>
                  <Link to={txnPath(x.type, x.id)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-brand-700">{t(TXN_META[x.type].label)} <span className="num">{x.number}</span></span>
                      <span className="num text-xs text-stone-500">{fmtDate(x.date)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <Money value={x.total} symbol={firm.currencySymbol} className={x.cancelled ? 'line-through text-stone-400' : 'font-semibold'} />
                      <StatusBadge status={docStatus(x, books.dues, todayStr)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** created / updated time and the change history from the audit log */
export function AuditCard({ txn }: { txn: Txn }) {
  const { t } = useI18n()
  const { db } = useData()
  const log = useLiveQuery(() => db.audit.where('entityId').equals(txn.id).toArray(), [db, txn.id])
  return (
    <Card title={t('txHistory')}>
      <dl className="divide-y divide-stone-100">
        <Line k={t('txCreatedAt')}><span className="num text-xs">{fmtDateTime(txn.createdAt)}</span></Line>
        {txn.updatedAt - txn.createdAt > 1000 && <Line k={t('txUpdatedAt')}><span className="num text-xs">{fmtDateTime(txn.updatedAt)}</span></Line>}
      </dl>
      {log && log.length > 1 && (
        <ul className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-xs text-stone-500">
          {[...log].sort((a, b) => b.at - a.at).map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span>{t('au_' + e.action)}</span>
              <span className="num">{fmtDateTime(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
