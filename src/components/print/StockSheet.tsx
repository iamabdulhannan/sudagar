import type { ReactNode } from 'react'
import { MAIN_GODOWN } from '../../lib/db'
import { fmtQty, round2 } from '../../lib/format'
import type { DocCtx } from './docCtx'
import { FooterNote, InfoBox, SheetFooter, SheetHeader, Signatures } from './SheetParts'

/** A4 / A5 stock transfer note (from godown → to godown) and production note (item made from materials) */
export function StockSheet({ ctx, a5 }: { ctx: DocCtx; a5?: boolean }) {
  const { txn, tr, data, books } = ctx
  const godown = (id?: string) => data.godowns.find((g) => g.id === (id || MAIN_GODOWN))?.name ?? ''
  const make = txn.type === 'manufacture'
  const out = txn.outputItemId ? data.itemById.get(txn.outputItemId) : undefined
  const materials = make ? books.cogs.get(txn.id) ?? txn.subtotal : 0
  const cost = round2(materials + (txn.charges || 0))
  // transfers print quantities only; production notes show the material cost
  const priced = make && txn.lines.some((l) => l.rate > 0)
  const totalQty = round2(txn.lines.reduce((a, l) => a + l.qty, 0))

  const head: [string, ReactNode][] = [[tr('prNumber'), txn.number], [tr('date'), ctx.date(txn.date)]]
  if (txn.refNo) head.push([tr('txRefNo'), txn.refNo])

  return (
    <div className={ctx.sheetCls(a5)} style={{ ['--acc' as string]: ctx.accent }}>
      <SheetHeader ctx={ctx} meta={head} />

      <div className="boxes">
        {make ? (
          <>
            <InfoBox title={tr('txItemMade')} lines={[out?.name ?? '-', `${tr('txQtyMade')}: ${fmtQty(txn.outputQty || 0)} ${out?.unit ?? ''}`]} />
            <InfoBox title={tr('txGodown')} lines={[godown(txn.godownId)]} />
          </>
        ) : (
          <>
            <InfoBox title={tr('txFromGodown')} lines={[godown(txn.godownId)]} />
            <InfoBox title={tr('txToGodown')} lines={[godown(txn.toGodownId)]} />
          </>
        )}
      </div>

      {make && <div className="label">{tr('txMaterials')}</div>}
      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>{tr('prItem')}</th>
            {data.settings.features.batches && txn.lines.some((l) => l.batch) && <th>{tr('txBatch')}</th>}
            <th className="r">{tr('qty')}</th>
            {priced && <th className="r">{tr('txCostRate')}</th>}
            {priced && <th className="r">{tr('amount')}</th>}
          </tr>
        </thead>
        <tbody>
          {txn.lines.map((l, i) => (
            <tr key={i}>
              <td className="num muted">{i + 1}</td>
              <td><div className="b">{l.name}</div>{l.description && <div className="muted small">{l.description}</div>}</td>
              {data.settings.features.batches && txn.lines.some((x) => x.batch) && <td className="num small">{l.batch}</td>}
              <td className="r num">{fmtQty(l.qty)} <span className="muted small">{l.unit}</span></td>
              {priced && <td className="r num">{ctx.fixed(l.rate)}</td>}
              {priced && <td className="r num b">{ctx.fixed(l.amount)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>{tr('total')}</td>
            {data.settings.features.batches && txn.lines.some((l) => l.batch) && <td />}
            <td className="r num">{fmtQty(totalQty)}</td>
            {priced && <td />}
            {priced && <td className="r num">{ctx.fixed(txn.subtotal)}</td>}
          </tr>
        </tfoot>
      </table>

      {make && (
        <div className="foot">
          <div><SheetFooter ctx={ctx} /></div>
          <table className="tot">
            <tbody>
              <tr><td className="muted">{tr('txMaterialsCost')}</td><td className="num">{ctx.money(materials)}</td></tr>
              {txn.charges > 0 && <tr><td className="muted">{tr('txMakingCharges')}</td><td className="num">{ctx.money(txn.charges)}</td></tr>}
              <tr className="grand"><td>{tr('txTotalCost')}</td><td className="num">{ctx.money(cost)}</td></tr>
              {txn.outputQty ? <tr><td className="muted">{tr('txUnitCost')}</td><td className="num">{ctx.money(round2(cost / txn.outputQty))}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {!make && <SheetFooter ctx={ctx} />}

      <Signatures ctx={ctx} receiver={make ? undefined : tr('prReceivedBy')} />
      <FooterNote ctx={ctx} />
    </div>
  )
}
