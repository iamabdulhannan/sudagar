import { Layers, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useData } from '../../lib/data'
import { fmtDate, fmtQty, round3 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnPath } from '../../lib/paths'
import { TXN_META, baseQty } from '../../lib/txn'
import type { Item, StockAdjustment, Txn, TxnLine, TxnType } from '../../lib/types'
import { Badge, Button, Empty, IconButton, Money, Select, useUi } from '../ui'
import { daysUntil, fmtStock, itemSummary } from './itemUtils'

const PAGE = 100

interface Move {
  key: string
  date: string
  order: number
  kind: 'opening' | 'txn' | 'adj'
  txn?: Txn
  line?: TxnLine
  adj?: StockAdjustment
  qtyIn: number
  qtyOut: number
  /** no stock effect (estimate, order, challan, cancelled) */
  noEffect: boolean
  balance: number
}

/** every line of this item on any transaction plus openings and adjustments, with a running stock balance */
export function ItemMovements({ item }: { item: Item }) {
  const { txns, adjustments, partyById, settings, firm } = useData()
  const { t } = useI18n()
  const [type, setType] = useState<TxnType | ''>('')
  const [limit, setLimit] = useState(PAGE)
  const isProduct = item.kind === 'product'
  const alt = settings.features.altUnits

  const moves = useMemo(() => {
    const list: Move[] = []
    if (isProduct && item.openingStock) {
      list.push({ key: 'opening', date: item.openingDate, order: -1, kind: 'opening', qtyIn: item.openingStock, qtyOut: 0, noEffect: false, balance: 0 })
    }
    for (const tx of txns) {
      const sign = TXN_META[tx.type].stock
      // manufacturing: the item made comes in (it is not a line)
      if (tx.type === 'manufacture' && tx.outputItemId === item.id && tx.outputQty) {
        list.push({ key: `${tx.id}-out`, date: tx.date, order: tx.createdAt, kind: 'txn', txn: tx, qtyIn: tx.outputQty, qtyOut: 0, noEffect: !!tx.cancelled, balance: 0 })
      }
      tx.lines.forEach((l, i) => {
        if (l.itemId !== item.id) return
        const q = baseQty(l)
        const noEffect = !sign || !!tx.cancelled
        // without a stock effect, show the quantity on the side it would move
        const out = sign ? sign < 0 : TXN_META[tx.type].side === 'sale'
        list.push({
          key: `${tx.id}-${i}`, date: tx.date, order: tx.createdAt, kind: 'txn', txn: tx, line: l,
          qtyIn: out ? 0 : q, qtyOut: out ? q : 0, noEffect, balance: 0,
        })
      })
    }
    if (isProduct) {
      for (const a of adjustments) {
        if (a.itemId !== item.id) continue
        list.push({ key: a.id, date: a.date, order: a.createdAt, kind: 'adj', adj: a, qtyIn: a.qty > 0 ? a.qty : 0, qtyOut: a.qty < 0 ? -a.qty : 0, noEffect: false, balance: 0 })
      }
    }
    list.sort((x, y) => (x.date === y.date ? x.order - y.order : x.date < y.date ? -1 : 1))
    let bal = 0
    for (const m of list) {
      if (!m.noEffect) bal = round3(bal + m.qtyIn - m.qtyOut)
      m.balance = bal
    }
    return list.reverse()
  }, [txns, adjustments, item, isProduct])

  const types = useMemo(() => [...new Set(moves.filter((m) => m.txn).map((m) => m.txn!.type))], [moves])
  const rows = type ? moves.filter((m) => m.txn?.type === type) : moves
  const shown = rows.slice(0, limit)

  if (!moves.length) return <Empty icon={<Layers className="size-6" />} title={t('itNoMoves')} text={t('itNoMovesText')} />

  const party = (tx: Txn) => (tx.partyId ? partyById.get(tx.partyId)?.name : tx.partyName) || t('walkIn')
  const q = (n: number, muted: boolean) => (n ? <span className={cx('num', muted && 'text-stone-400')}>{muted ? `(${fmtQty(n)})` : fmtQty(n)}</span> : '')

  return (
    <div>
      {types.length > 1 && (
        <div className="flex justify-end p-3">
          <Select value={type} onChange={(e) => { setType(e.target.value as TxnType | ''); setLimit(PAGE) }} className="w-auto">
            <option value="">{t('itAllTypes')}</option>
            {types.map((ty) => <option key={ty} value={ty}>{t('tp_' + ty)}</option>)}
          </Select>
        </div>
      )}
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('date')}</th><th>{t('type')}</th><th>{t('number')}</th><th>{t('itParty')}</th>
              <th className="r">{t('itQtyIn')}</th><th className="r">{t('itQtyOut')}</th><th className="r">{t('rate')}</th>
              {isProduct && <th className="r">{t('itBalance')}</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.key} className={cx(m.txn?.cancelled && 'opacity-50')}>
                <td className="num whitespace-nowrap">{fmtDate(m.date)}</td>
                <td className="whitespace-nowrap">
                  {m.kind === 'opening' && t('itOpeningStock')}
                  {m.kind === 'adj' && <span>{t('itAdjustment')} <span className="text-xs text-stone-500">({t('adjr_' + m.adj!.reason)})</span></span>}
                  {m.txn && <>
                    {t('tt_' + m.txn.type)}
                    {m.txn.cancelled && <Badge tone="bad" className="ms-1">{t('cancelled')}</Badge>}
                  </>}
                </td>
                <td className="num">
                  {m.txn && <Link to={txnPath(m.txn.type, m.txn.id)} className="font-medium text-brand-700 hover:underline">{m.txn.number}</Link>}
                </td>
                <td className="max-w-48 truncate">{m.txn ? party(m.txn) : m.adj?.note ?? ''}</td>
                <td className="r text-emerald-700">{q(m.qtyIn, m.noEffect)}</td>
                <td className="r text-red-700">{q(m.qtyOut, m.noEffect)}</td>
                <td className="r whitespace-nowrap">
                  {m.line && <>
                    <Money value={m.line.rate} symbol={firm.currencySymbol} />
                    {m.line.factor !== 1 && <span className="ms-1 text-xs text-stone-500">/ {m.line.unit}</span>}
                  </>}
                </td>
                {isProduct && <td className="r num whitespace-nowrap font-medium">{fmtStock(item, m.balance, alt)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="border-t border-stone-100 p-2 text-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>{t('more')}</Button>
        </div>
      )}
    </div>
  )
}

/** manual stock adjustments of this item, newest first */
export function ItemAdjustments({ item, onAdd }: { item: Item; onAdd: () => void }) {
  const { db, adjustments, settings, godowns } = useData()
  const godownName = (id?: string) => godowns.find((g) => g.id === (id || 'main'))?.name ?? ''
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const list = useMemo(
    () => adjustments.filter((a) => a.itemId === item.id).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [adjustments, item.id],
  )

  async function remove(a: StockAdjustment) {
    if (!(await confirm({ title: t('itAdjDelete'), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    await db.transaction('rw', [db.adjustments, db.audit], async () => {
      await db.adjustments.delete(a.id)
      await db.audit.add({ at: Date.now(), action: 'delete', entity: 'adjustment', entityId: a.id, summary: `${itemSummary(item)} ${a.qty} ${a.reason}` })
    })
    toast(t('deleted'))
  }

  const add = <Button size="sm" onClick={onAdd}><Plus className="size-4" />{t('itAdjust')}</Button>
  if (!list.length) return <Empty icon={<SlidersHorizontal className="size-6" />} title={t('itNoAdjustments')} text={t('itNoAdjustmentsText')} action={add} />

  return (
    <div>
      <div className="flex justify-end p-3">{add}</div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('date')}</th><th>{t('itReason')}</th><th className="r">{t('qty')}</th>
              {settings.features.godowns && <th>{t('stGodown')}</th>}
              {settings.features.batches && <th>{t('itBatch')}</th>}
              <th>{t('note')}</th><th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="num whitespace-nowrap">{fmtDate(a.date)}</td>
                <td>{t('adjr_' + a.reason)}</td>
                <td className={cx('r num font-medium', a.qty < 0 ? 'text-red-700' : 'text-emerald-700')}>{a.qty > 0 ? '+' : ''}{fmtQty(a.qty)} {item.unit}</td>
                {settings.features.godowns && <td>{godownName(a.godownId)}</td>}
                {settings.features.batches && <td className="num">{a.batch}</td>}
                <td className="text-stone-600">{a.note}</td>
                <td>
                  <IconButton label={t('delete')} onClick={() => remove(a)} className="hover:text-red-700"><Trash2 className="size-4" /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface BatchRow { batch: string; expiry?: string; qtyIn: number; qtyOut: number }

/** quantity in, out and on hand per batch, with expiry warnings */
export function ItemBatches({ item }: { item: Item }) {
  const { txns, adjustments } = useData()
  const { t } = useI18n()

  const rows = useMemo(() => {
    const m = new Map<string, BatchRow>()
    const row = (b: string) => {
      let r = m.get(b)
      if (!r) { r = { batch: b, qtyIn: 0, qtyOut: 0 }; m.set(b, r) }
      return r
    }
    if (item.openingStock) row('').qtyIn += item.openingStock
    for (const tx of txns) {
      const sign = TXN_META[tx.type].stock
      if (!sign || tx.cancelled) continue
      for (const l of tx.lines) {
        if (l.itemId !== item.id) continue
        const r = row((l.batch ?? '').trim())
        if (sign > 0) r.qtyIn += baseQty(l); else r.qtyOut += baseQty(l)
        // the purchase line's expiry wins; otherwise any line's
        if (l.expiry && (!r.expiry || tx.type === 'purchase')) r.expiry = l.expiry
      }
    }
    for (const a of adjustments) {
      if (a.itemId !== item.id) continue
      const r = row((a.batch ?? '').trim())
      if (a.qty > 0) r.qtyIn += a.qty; else r.qtyOut -= a.qty
    }
    return [...m.values()].sort((a, b) => {
      if (!a.batch !== !b.batch) return a.batch ? -1 : 1
      if (a.expiry && b.expiry) return a.expiry < b.expiry ? -1 : 1
      if (a.expiry !== b.expiry) return a.expiry ? -1 : 1
      return a.batch.localeCompare(b.batch)
    })
  }, [txns, adjustments, item])

  if (!rows.length) return <Empty icon={<Layers className="size-6" />} title={t('itNoBatches')} text={t('itNoBatchesText')} />

  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('itBatch')}</th><th>{t('itExpiry')}</th><th className="r">{t('itQtyIn')}</th><th className="r">{t('itQtyOut')}</th><th className="r">{t('itBalance')}</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bal = round3(r.qtyIn - r.qtyOut)
            const days = r.expiry ? daysUntil(r.expiry) : undefined
            return (
              <tr key={r.batch || '-'}>
                <td className="num font-medium">{r.batch || <span className="text-stone-400">{t('itNoBatch')}</span>}</td>
                <td className="num whitespace-nowrap">{fmtDate(r.expiry)}</td>
                <td className="r num text-emerald-700">{fmtQty(r.qtyIn)}</td>
                <td className="r num text-red-700">{fmtQty(r.qtyOut)}</td>
                <td className={cx('r num font-semibold', bal < 0 && 'text-red-700')}>{fmtQty(bal)} {item.unit}</td>
                <td>
                  {days !== undefined && bal > 0 && days < 0 && <Badge tone="bad">{t('itExpired')}</Badge>}
                  {days !== undefined && bal > 0 && days >= 0 && days <= 60 && <Badge tone="warn">{t('itExpiresIn', { n: days })}</Badge>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
