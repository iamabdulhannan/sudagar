import { useCallback, useRef, useState } from 'react'
import type { FirmData } from '../../../lib/data'
import { round2 } from '../../../lib/format'
import { TXN_META, blankTxn, calcTotals, convertDraft } from '../../../lib/txn'
import type { Settings, Txn, TxnType } from '../../../lib/types'
import { duplicateDraft } from '../logic'
import { chequeDefaults, splitSum } from '../payLogic'

export type DraftPatch = Partial<Txn> | ((d: Txn) => Partial<Txn>)

/** what every form section gets */
export interface DraftApi {
  draft: Txn
  update: (p: DraftPatch) => void
  /** the saved version when editing */
  original?: Txn
  isNew: boolean
  fullPay: boolean
  setFullPay: (v: boolean) => void
}

/** walk-in documents that post must be settled now */
export const mustPayInFull = (t: Txn) => {
  const m = TXN_META[t.type]
  return m.posts && m.lines && !t.partyId && !m.partyRequired
}

/** recompute totals and keep "paid now" consistent with the type and the full-payment box */
export function normalize(d: Txn, s: Settings, fullPay: boolean): Txn {
  const m = TXN_META[d.type]
  const x = chequeDefaults(m.lines ? calcTotals(d, s) : { ...d, total: round2(Number(d.total) || 0), subtotal: round2(Number(d.total) || 0) })
  if (!m.posts) return { ...x, received: 0 }
  // payments, income and transfers settle in full (saveTxn does the same)
  if (!m.lines || x.type === 'other_income') return { ...x, received: x.total, payments: undefined }
  // split payment: paid now is what the rows add up to
  if (x.payments) return { ...x, received: splitSum(x.payments) }
  if (mustPayInFull(x) || fullPay) return { ...x, received: x.total }
  return { ...x, received: Math.max(0, Math.min(round2(x.received || 0), x.total)) }
}

export interface Initial { draft: Txn; original?: Txn; source?: Txn; notFound?: boolean }

/** the starting document for /txn/:slug/new (query: party, amount, from, against, dup) or /:id/edit */
export function initialDraft(type: TxnType, id: string | undefined, q: URLSearchParams, data: FirmData): Initial {
  const s = data.settings
  const firstAcc = data.accounts.find((a) => a.active && a.kind === 'cash') ?? data.accounts.find((a) => a.active && a.kind !== 'loan')
  const withAcc = (t: Txn): Txn => ({ ...t, accountId: t.accountId && data.accountById.has(t.accountId) ? t.accountId : firstAcc?.id })
  if (id) {
    const orig = data.txnById.get(id)
    if (!orig) return { draft: blankTxn(type, s), notFound: true }
    return { draft: { ...orig, lines: orig.lines.map((l) => ({ ...l })) }, original: orig }
  }
  const dup = q.get('dup')
  const from = q.get('from') || q.get('against')
  const src = dup ? data.txnById.get(dup) : from ? data.txnById.get(from) : undefined
  if (src && dup) return { draft: withAcc(duplicateDraft(src, s)) }
  if (src) return { draft: withAcc(convertDraft(src, type, s)), source: src }
  const base = withAcc(blankTxn(type, s))
  const party = q.get('party')
  if (party && data.partyById.has(party)) base.partyId = party
  // payments started from an invoice: amount=<due>
  const amount = Number(q.get('amount'))
  if (!TXN_META[type].lines && amount > 0) base.total = round2(amount)
  // payments started from an invoice settle that invoice first (see computeDues)
  const invoice = q.get('invoice') ? data.txnById.get(q.get('invoice')!) : undefined
  if (invoice && (type === 'payment_in' || type === 'payment_out')) { base.againstId = invoice.id; base.refNo = invoice.number }
  return { draft: base }
}

/** form state: the draft is always normalized, and `dirty` tells if the user changed anything */
export function useDraft(init: Initial, s: Settings) {
  const startFull = !!init.original && init.original.total > 0 && Math.abs(init.original.received - init.original.total) < 0.005
  const full = useRef(startFull)
  const [fullPay, setFull] = useState(startFull)
  const [draft, setDraft] = useState(() => normalize(init.draft, s, startFull))
  const [dirty, setDirty] = useState(false)

  const update = useCallback((p: DraftPatch) => {
    setDraft((d) => normalize({ ...d, ...(typeof p === 'function' ? p(d) : p) }, s, full.current))
    setDirty(true)
  }, [s])

  const setFullPay = useCallback((v: boolean) => {
    full.current = v
    setFull(v)
    setDraft((d) => normalize(d, s, v))
    setDirty(true)
  }, [s])

  return { draft, update, fullPay, setFullPay, dirty }
}
