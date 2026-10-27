import { amountInWords, fmtQty, round2 } from '../../lib/format'
import { pointsValue } from '../../lib/loyalty'
import { TXN_META } from '../../lib/txn'
import type { ReactNode } from 'react'
import { isDraftDoc, isReturn } from '../txn/logic'
import { currencyWord, type DocCtx } from './docCtx'
import { FooterNote, InfoBox, SheetFooter, SheetHeader, Signatures, balanceText, splitLines } from './SheetParts'

/** A4 / A5 invoice, bill, quotation, order, challan, credit or debit note */
export function InvoiceSheet({ ctx, a5 }: { ctx: DocCtx; a5?: boolean }) {
  const { txn, tr, data, party } = ctx
  const f = data.settings.features
  const meta = TXN_META[txn.type]
  const priced = txn.type !== 'delivery_challan'
  const lines = txn.lines
  const showBatch = f.batches && lines.some((l) => l.batch || l.expiry)
  const showMrp = priced && f.mrp && lines.some((l) => l.mrp)
  const showDisc = priced && lines.some((l) => l.discount > 0)
  const showTax = priced && lines.some((l) => l.taxRate > 0)
  const totalQty = round2(lines.reduce((a, l) => a + l.qty, 0))

  const refLabel = txn.type === 'purchase' ? tr('txSupplierBillNo') : isReturn(txn.type) ? tr('txAgainstInvoice') : tr('txRefNo')
  const head: [string, ReactNode][] = [
    [tr('prNumber'), txn.number],
    [tr('date'), ctx.date(txn.date)],
  ]
  if (txn.dueDate && (txn.type === 'sale' || txn.type === 'purchase')) head.push([tr('txDueDate'), ctx.date(txn.dueDate)])
  if (txn.refNo) head.push([refLabel, txn.refNo])

  const partyTitle = meta.side === 'sale' ? tr('prBillTo') : tr('prSupplier')
  const partyLines = [
    ctx.partyName || tr('walkIn'),
    party?.address && [party.address, party.city].filter(Boolean).join(', '),
    !party?.address && party?.city,
    (party?.phone || txn.partyPhone) && `${tr('phone')}: ${party?.phone || txn.partyPhone}`,
    party?.ntn && `${tr('ntn')}: ${party.ntn}`,
  ]

  const exTax = round2(txn.subtotal - txn.taxTotal)
  const totals: [string, number, string?][] = []
  totals.push([tr('txSubtotal'), txn.taxTotal > 0 ? exTax : txn.subtotal])
  if (txn.taxTotal > 0) totals.push([data.settings.taxLabel || tr('txTax'), txn.taxTotal])
  if (txn.discount > 0) totals.push([txn.discountPct > 0 ? `${tr('txDiscount')} (${txn.discountPct}%)` : tr('txDiscount'), -txn.discount])
  if (txn.pointsRedeemed) totals.push([tr('prPointsIncl', { n: txn.pointsRedeemed }), -pointsValue(txn.pointsRedeemed, data.settings), 'small'])
  if (txn.charges) totals.push([tr('txCharges'), txn.charges])
  if (txn.roundOff) totals.push([tr('txRoundOff'), txn.roundOff])

  const paidLabel = txn.type === 'sale' ? tr('txReceived') : txn.type === 'sale_return' ? tr('txRefunded') : txn.type === 'purchase_return' ? tr('txRefundReceived') : tr('paid')
  const posts = meta.posts && !txn.cancelled

  return (
    <div className={ctx.sheetCls(a5)} style={{ ['--acc' as string]: ctx.accent }}>
      <SheetHeader ctx={ctx} meta={head} />

      <div className="boxes">
        <InfoBox title={partyTitle} lines={partyLines} />
        {txn.shipTo ? <InfoBox title={tr('txShipTo')} lines={[txn.shipTo]} /> : <div />}
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>{tr('prItem')}</th>
            {showBatch && <th>{tr('txBatch')} / {tr('txExpiry')}</th>}
            <th className="r">{tr('qty')}</th>
            {showMrp && <th className="r">{tr('prMrp')}</th>}
            {priced && <th className="r">{tr('rate')}</th>}
            {showDisc && <th className="r">{tr('txDiscount')}</th>}
            {showTax && <th className="r">{tr('txTax')}</th>}
            {priced && <th className="r">{tr('amount')}</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="num muted">{i + 1}</td>
              <td>
                <div className="b">{l.name}</div>
                {l.description && <div className="muted small">{l.description}</div>}
                {l.serial && <div className="muted small num">{tr('txSerial')}: {l.serial}</div>}
              </td>
              {showBatch && <td className="num small">{l.batch}{l.batch && l.expiry ? ' / ' : ''}{l.expiry && ctx.date(l.expiry)}</td>}
              <td className="r num">{fmtQty(l.qty)} <span className="muted small">{l.unit}</span></td>
              {showMrp && <td className="r num">{l.mrp ? ctx.fixed(l.mrp) : ''}</td>}
              {priced && <td className="r num">{ctx.fixed(l.rate)}</td>}
              {showDisc && <td className="r num">{l.discount > 0 ? ctx.fixed(l.discount) : ''}{l.discountPct > 0 && <div className="muted small">{l.discountPct}%</div>}</td>}
              {showTax && <td className="r num">{l.taxRate > 0 ? <>{ctx.fixed(l.taxAmount)}<div className="muted small">{l.taxRate}%</div></> : ''}</td>}
              {priced && <td className="r num b">{ctx.fixed(l.amount)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>{tr('total')}</td>
            {showBatch && <td />}
            <td className="r num">{fmtQty(totalQty)}</td>
            {showMrp && <td />}
            {priced && <td />}
            {showDisc && <td className="r num">{ctx.fixed(lines.reduce((a, l) => a + l.discount, 0))}</td>}
            {showTax && <td className="r num">{ctx.fixed(txn.taxTotal)}</td>}
            {priced && <td className="r num">{ctx.fixed(txn.subtotal)}</td>}
          </tr>
        </tfoot>
      </table>

      {priced ? (
        <div className="foot">
          <div>
            <div className="label">{tr('prAmountInWords')}</div>
            <p className="words">{amountInWords(txn.total, currencyWord(data.firm.currency))}</p>
            <SheetFooter ctx={ctx} terms={meta.side === 'sale'} />
          </div>
          <table className="tot">
            <tbody>
              {totals.map(([k, v, cls]) => (
                <tr key={k} className={cls}><td className="muted">{k}</td><td className="num">{ctx.money(v)}</td></tr>
              ))}
              <tr className="grand"><td>{tr('txGrandTotal')}</td><td className="num">{ctx.money(txn.total)}</td></tr>
              {posts && (
                <>
                  <tr><td className="muted">{paidLabel}</td><td className="num">{ctx.money(txn.total - ctx.due)}</td></tr>
                  {splitLines(ctx).map(([k, v], i) => (
                    <tr key={'sp' + i} className="split"><td className="muted small">{k}</td><td className="num small">{ctx.money(v)}</td></tr>
                  ))}
                  <tr className="due"><td>{tr('txBalanceDue')}</td><td className="num">{ctx.money(ctx.due)}</td></tr>
                </>
              )}
              {posts && ctx.partyBalance !== undefined && (
                <tr><td className="muted small">{tr('prPartyBalance')}</td><td className="num small">{balanceText(ctx, ctx.partyBalance)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <SheetFooter ctx={ctx} />
      )}

      {isDraftDoc(txn.type) && txn.type === 'estimate' && <p className="muted small" style={{ marginTop: 10 }}>{tr('prEstimateNote')}</p>}
      <Signatures ctx={ctx} receiver={txn.type === 'delivery_challan' || txn.type === 'sale_order' ? tr('prReceivedBy') : undefined} />
      <FooterNote ctx={ctx} />
    </div>
  )
}
