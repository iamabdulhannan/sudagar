import type { ReactNode } from 'react'
import { fmtNum, fmtQty, round2 } from '../../lib/format'
import { TXN_META } from '../../lib/txn'
import { MAIN_GODOWN } from '../../lib/db'
import { changeDue } from '../txn/payLogic'
import { timeOf, type DocCtx } from './docCtx'
import { splitLines } from './SheetParts'

function Row({ k, v, cls }: { k: ReactNode; v: ReactNode; cls?: string }) {
  return <div className={'row' + (cls ? ' ' + cls : '')}><span>{k}</span><span className="num">{v}</span></div>
}

/** compact centred receipt for 80 mm / 58 mm roll printers */
export function ThermalReceipt({ ctx, narrow }: { ctx: DocCtx; narrow?: boolean }) {
  const { txn, tr, data } = ctx
  const { firm, settings } = data
  const meta = TXN_META[txn.type]
  const priced = txn.type !== 'delivery_challan' && txn.type !== 'stock_transfer'
  const splits = splitLines(ctx)
  const change = changeDue(txn)
  const godown = (id?: string) => data.godowns.find((g) => g.id === (id || MAIN_GODOWN))?.name ?? ''
  const output = txn.outputItemId ? data.itemById.get(txn.outputItemId) : undefined
  const posts = meta.posts && !txn.cancelled
  const acc = (id?: string) => (id ? data.accountById.get(id)?.name ?? '' : '')
  const exTax = round2(txn.subtotal - txn.taxTotal)

  return (
    <div className={'sdoc thermal' + (narrow ? ' t58' : '')}>
      <div className="c">
        {firm.logo && <img src={firm.logo} alt="" className="logo" />}
        <div className="big">{firm.name}</div>
        {firm.address && <div>{[firm.address, firm.city].filter(Boolean).join(', ')}</div>}
        {firm.phone && <div className="num">{firm.phone}</div>}
        {firm.ntn && <div className="num small">{tr('ntn')}: {firm.ntn}</div>}
        <hr />
        <div className="b">{ctx.title}</div>
        {txn.cancelled && <div className="b">*** {tr('cancelled')} ***</div>}
      </div>
      <Row k={tr('prNumber')} v={txn.number} />
      <Row k={tr('date')} v={`${ctx.date(txn.date)} ${timeOf(txn.createdAt)}`} />
      {ctx.partyName && <div className="row"><span>{meta.side === 'purchase' || txn.type === 'payment_out' ? tr('prPaidTo') : tr('prCustomer')}</span><span>{ctx.partyName}</span></div>}
      {txn.type === 'stock_transfer' && <>
        <Row k={tr('txFromGodown')} v={godown(txn.godownId)} />
        <Row k={tr('txToGodown')} v={godown(txn.toGodownId)} />
      </>}
      {txn.type === 'manufacture' && output && <Row k={tr('txItemMade')} v={`${output.name} x ${fmtQty(txn.outputQty || 0)}`} />}
      <hr />

      {txn.lines.length > 0 && (
        <>
          {txn.lines.map((l, i) => (
            <div key={i} className="item">
              <div className="b">{l.name}</div>
              {priced
                ? <Row k={`${fmtQty(l.qty)} ${l.unit} x ${fmtNum(l.rate)}${l.discount > 0 ? ` -${fmtNum(l.discount)}` : ''}`} v={fmtNum(l.amount)} />
                : <Row k={tr('qty')} v={`${fmtQty(l.qty)} ${l.unit}`} />}
            </div>
          ))}
          <hr />
        </>
      )}

      {meta.lines && priced && txn.lines.length > 0 && meta.side !== 'stock' && (
        <>
          <Row k={`${tr('txSubtotal')} (${txn.lines.length})`} v={fmtNum(txn.taxTotal > 0 ? exTax : txn.subtotal)} />
          {txn.taxTotal > 0 && <Row k={settings.taxLabel || tr('txTax')} v={fmtNum(txn.taxTotal)} />}
          {txn.discount > 0 && <Row k={tr('txDiscount')} v={'-' + fmtNum(txn.discount)} />}
          {txn.charges !== 0 && <Row k={tr('txCharges')} v={fmtNum(txn.charges)} />}
          {txn.roundOff !== 0 && <Row k={tr('txRoundOff')} v={fmtNum(txn.roundOff)} />}
        </>
      )}
      {!meta.lines && txn.type === 'transfer' && (
        <>
          <Row k={tr('txFromAccount')} v={acc(txn.accountId)} />
          <Row k={tr('txToAccount')} v={acc(txn.toAccountId)} />
        </>
      )}
      {txn.type === 'manufacture' && txn.charges > 0 && <Row k={tr('txMakingCharges')} v={fmtNum(txn.charges)} />}
      {priced && <Row k={txn.type === 'manufacture' ? tr('txTotalCost') : tr('txGrandTotal')} v={ctx.money(txn.total)} cls="big" />}
      {posts && txn.type !== 'transfer' && meta.side !== 'stock' && (
        <>
          <Row k={txn.type === 'payment_in' || txn.type === 'sale' || txn.type === 'capital_in' ? tr('txReceived') : tr('paid')} v={fmtNum(txn.total - ctx.due)} />
          {splits.map(([k, v], i) => <Row key={'sp' + i} k={k} v={fmtNum(v)} cls="small" />)}
          {change > 0 && <>
            <Row k={tr('txCashGiven')} v={fmtNum(txn.tendered ?? 0)} />
            <Row k={tr('txChange')} v={fmtNum(change)} cls="b" />
          </>}
          {ctx.due > 0.001 && <Row k={tr('txBalanceDue')} v={fmtNum(ctx.due)} cls="b" />}
          {!splits.length && txn.paymentMode && txn.received > 0 && <Row k={tr('txMode')} v={tr('pm_' + txn.paymentMode)} />}
          {txn.paymentMode === 'cheque' && txn.refNo && <Row k={tr('txChequeNo')} v={txn.refNo} />}
        </>
      )}
      {ctx.partyBalance !== undefined && (txn.type === 'sale' || txn.type === 'payment_in') && (
        <Row k={tr('prPartyBalance')} v={fmtNum(ctx.partyBalance)} />
      )}
      {txn.notes && <><hr /><div>{txn.notes}</div></>}
      <hr />
      <div className="c">
        <div className="b">{settings.invoiceFooter || tr('prThanks')}</div>
      </div>
    </div>
  )
}
