import type { ReactNode } from 'react'
import { amountInWords, fmtQty } from '../../lib/format'
import { currencyWord, type DocCtx } from './docCtx'
import { FooterNote, SheetFooter, SheetHeader, Signatures, balanceText, splitLines } from './SheetParts'

/** A4 / A5 voucher for payments in / out, expenses, other income and transfers */
export function VoucherSheet({ ctx, a5 }: { ctx: DocCtx; a5?: boolean }) {
  const { txn, tr, data } = ctx
  const acc = (id?: string) => (id ? data.accountById.get(id)?.name ?? '' : '')
  const cat = txn.categoryId ? data.moneyCategories.find((c) => c.id === txn.categoryId)?.name : undefined
  const mode = txn.paymentMode ? tr('pm_' + txn.paymentMode) : ''

  const head: [string, ReactNode][] = [[tr('prNumber'), txn.number], [tr('date'), ctx.date(txn.date)]]
  if (txn.refNo) head.push([txn.type === 'expense' ? tr('txBillNo') : txn.paymentMode === 'cheque' ? tr('txChequeNo') : tr('txChequeRef'), txn.refNo])
  const splits = splitLines(ctx)
  const chequeRows = (): [string, ReactNode][] => {
    if (txn.paymentMode !== 'cheque' || !txn.chequeStatus) return []
    const st = txn.chequeStatus === 'open' ? (txn.type === 'payment_in' ? 'chq_open_in' : 'chq_open_out') : 'chq_' + txn.chequeStatus
    const r: [string, ReactNode][] = []
    if (txn.chequeDate) r.push([tr('txChequeDate'), ctx.date(txn.chequeDate)])
    r.push([tr('txChequeStatus'), tr(st) + (txn.chequeStatus === 'cleared' && txn.clearedOn ? `, ${ctx.date(txn.clearedOn)}` : '')])
    return r
  }

  const rows: [string, ReactNode][] = []
  switch (txn.type) {
    case 'payment_in':
      rows.push([tr('prReceivedFrom'), ctx.partyName], [tr('txMode'), mode], [tr('txAccount'), acc(txn.accountId)], ...chequeRows())
      break
    case 'payment_out':
      rows.push([tr('prPaidTo'), ctx.partyName], [tr('txMode'), mode], [tr('txAccount'), acc(txn.accountId)], ...chequeRows())
      break
    case 'expense':
      rows.push([tr('txExpenseHead'), cat ?? tr('la_other')])
      if (ctx.partyName) rows.push([tr('prPaidTo'), ctx.partyName])
      if (splits.length) for (const [k, v] of splits) rows.push([k, <span className="num">{ctx.money(v)}</span>])
      else if (txn.received > 0) rows.push([tr('txMode'), mode], [tr('txAccount'), acc(txn.accountId)])
      break
    case 'capital_in':
      rows.push([tr('prFromOwner'), data.firm.ownerName || ''], [tr('prReceivedIn'), acc(txn.accountId)], [tr('txMode'), mode])
      break
    case 'drawing':
      rows.push([tr('prTakenBy'), data.firm.ownerName || ''], [tr('prPaidFrom'), acc(txn.accountId)], [tr('txMode'), mode])
      break
    case 'other_income':
      rows.push([tr('txIncomeHead'), cat ?? tr('la_other')], [tr('prReceivedIn'), acc(txn.accountId)], [tr('txMode'), mode])
      break
    case 'transfer':
      rows.push([tr('txFromAccount'), acc(txn.accountId)], [tr('txToAccount'), acc(txn.toAccountId)])
      break
  }
  const withParty = txn.type === 'payment_in' || txn.type === 'payment_out' || (txn.type === 'expense' && !!txn.partyId)

  return (
    <div className={ctx.sheetCls(a5)} style={{ ['--acc' as string]: ctx.accent }}>
      <SheetHeader ctx={ctx} meta={head} />

      <dl className="kv">
        {rows.filter(([, v]) => v).map(([k, v]) => [<dt key={k + 't'}>{k}</dt>, <dd key={k + 'd'}>{v}</dd>])}
      </dl>

      {txn.lines.length > 0 && (
        <table className="lines" style={{ marginTop: 12 }}>
          <thead>
            <tr><th style={{ width: 28 }}>#</th><th>{tr('details')}</th><th className="r">{tr('qty')}</th><th className="r">{tr('rate')}</th><th className="r">{tr('amount')}</th></tr>
          </thead>
          <tbody>
            {txn.lines.map((l, i) => (
              <tr key={i}>
                <td className="num muted">{i + 1}</td>
                <td><div className="b">{l.name}</div>{l.description && <div className="muted small">{l.description}</div>}</td>
                <td className="r num">{fmtQty(l.qty)} <span className="muted small">{l.unit}</span></td>
                <td className="r num">{ctx.fixed(l.rate)}</td>
                <td className="r num b">{ctx.fixed(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="voucher-amt">
        <div>
          <div className="label">{tr('amount')}</div>
          <p className="words small">{amountInWords(txn.total, currencyWord(data.firm.currency))}</p>
        </div>
        <div className="v num">{ctx.money(txn.total)}</div>
      </div>

      {txn.type === 'expense' && txn.partyId && (
        <dl className="kv">
          <dt>{tr('paid')}</dt><dd className="num">{ctx.money(txn.received)}</dd>
          <dt>{tr('txBalanceDue')}</dt><dd className="num">{ctx.money(ctx.due)}</dd>
        </dl>
      )}
      {withParty && ctx.partyBalance !== undefined && (
        <p className="muted" style={{ marginTop: 6 }}>{tr('prPartyBalance')}: <span className="num b">{balanceText(ctx, ctx.partyBalance)}</span></p>
      )}

      <SheetFooter ctx={ctx} />
      <Signatures ctx={ctx} receiver={txn.type === 'transfer' || txn.type === 'capital_in' ? undefined : tr('prReceivedBy')} />
      <FooterNote ctx={ctx} />
    </div>
  )
}
