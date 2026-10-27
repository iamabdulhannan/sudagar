import type { ReactNode } from 'react'
import { moneySplits } from '../../lib/txn'
import { isSplit } from '../txn/payLogic'
import type { DocCtx } from './docCtx'

/** firm block + document title and number, top of A4 / A5 sheets */
export function SheetHeader({ ctx, meta }: { ctx: DocCtx; meta: [string, ReactNode][] }) {
  const { firm } = ctx.data
  const { txn, tr } = ctx
  const contact = [firm.phone && `${tr('phone')}: ${firm.phone}`, firm.email].filter(Boolean).join('  |  ')
  const tax = [firm.ntn && `${tr('ntn')}: ${firm.ntn}`, firm.strn && `${tr('strn')}: ${firm.strn}`].filter(Boolean).join('  |  ')
  return (
    <header className="hd">
      <div className="firm">
        {firm.logo && <img src={firm.logo} alt="" className="logo" />}
        <div>
          <h1 className="firm-name">{firm.name}</h1>
          {(firm.address || firm.city) && <p className="muted">{[firm.address, firm.city].filter(Boolean).join(', ')}</p>}
          {contact && <p className="muted num">{contact}</p>}
          {tax && <p className="muted num">{tax}</p>}
        </div>
      </div>
      <div>
        <h2 className="doc-title">{ctx.title}</h2>
        <dl className="meta">
          {meta.map(([k, v]) => [<dt key={k + 't'}>{k}</dt>, <dd key={k + 'd'} className="num">{v}</dd>])}
        </dl>
        {txn.cancelled && <div style={{ textAlign: 'end' }}><span className="stamp">{tr('cancelled')}</span></div>}
      </div>
    </header>
  )
}

/** a labelled box (bill to, ship to) */
export function InfoBox({ title, lines }: { title: string; lines: (ReactNode | undefined | false)[] }) {
  const shown = lines.filter(Boolean)
  if (!shown.length) return <div />
  return (
    <div className="box">
      <h4>{title}</h4>
      {shown.map((l, i) => <p key={i} className={i === 0 ? 'b' : 'muted'}>{l}</p>)}
    </div>
  )
}

/** signature lines; left one optional (received by) */
export function Signatures({ ctx, receiver }: { ctx: DocCtx; receiver?: string }) {
  const { tr, data } = ctx
  if (!data.settings.signature && !receiver) return null
  return (
    <div className="sign">
      {receiver ? <div>{receiver}</div> : <div className="spacer" />}
      {data.settings.signature && <div>{tr('prForFirm', { name: data.firm.name })}<br /><span className="muted small">{tr('prAuthSign')}</span></div>}
    </div>
  )
}

/** terms, notes and footer under a sheet */
export function SheetFooter({ ctx, terms }: { ctx: DocCtx; terms?: boolean }) {
  const { tr, txn, data } = ctx
  return (
    <>
      {txn.notes && (
        <div style={{ marginTop: 10 }}>
          <div className="label">{tr('notes')}</div>
          <p className="terms">{txn.notes}</p>
        </div>
      )}
      {terms && data.settings.invoiceTerms && (
        <div style={{ marginTop: 10 }}>
          <div className="label">{tr('invoiceTerms')}</div>
          <p className="terms small muted">{data.settings.invoiceTerms}</p>
        </div>
      )}
    </>
  )
}

export function FooterNote({ ctx }: { ctx: DocCtx }) {
  const note = ctx.data.settings.invoiceFooter
  return note ? <p className="footer-note">{note}</p> : null
}

/** "Rs 1,200 (to receive)" for a party balance */
export function balanceText(ctx: DocCtx, n: number) {
  if (Math.abs(n) < 0.005) return ctx.money(0)
  return `${ctx.money(Math.abs(n))} (${ctx.tr(n > 0 ? 'receivable' : 'payable')})`
}

/** each payment of a split payment: "Card (Meezan) ref 123" and its amount; empty when paid one way */
export function splitLines(ctx: DocCtx): [string, number][] {
  if (!isSplit(ctx.txn)) return []
  return moneySplits(ctx.txn).map((p) => {
    const acc = ctx.data.accountById.get(p.accountId)?.name
    return [`${ctx.tr('pm_' + p.mode)}${acc ? ` (${acc})` : ''}${p.refNo ? ` ${p.refNo}` : ''}`, p.amount]
  })
}
