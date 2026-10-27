import { Pencil, Printer, Trash2 } from 'lucide-react'
import { useAccess } from '../../lib/access'
import { useData } from '../../lib/data'
import { fmtDate, fmtMoney, fmtQty, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { deleteTxn, TxnError } from '../../lib/txn'
import type { Firm, Txn } from '../../lib/types'
import { printNode } from '../PrintPortal'
import { Button, Modal, Money, useUi } from '../ui'
import { useGodownName } from './StockBits'

/** details of a stock transfer or manufacturing entry, with print, edit and delete */
export function StockTxnView({ txn, onClose, onEdit }: { txn: Txn | null; onClose: () => void; onEdit: (t: Txn) => void }) {
  const { db, firm, itemById, accountById, settings } = useData()
  const { t, dir } = useI18n()
  const { toast, confirm } = useUi()
  const { can } = useAccess()
  const godownName = useGodownName()
  if (!txn) return null
  const isMfg = txn.type === 'manufacture'
  const sym = firm.currencySymbol
  const out = txn.outputItemId ? itemById.get(txn.outputItemId) : undefined
  const unitCost = isMfg && txn.outputQty ? round2(txn.total / txn.outputQty) : 0
  const locked = !!settings.lockDate && txn.date <= settings.lockDate

  const facts: [string, string][] = [
    [t('date'), fmtDate(txn.date)],
    ...(isMfg
      ? [
        [t('stItemMade'), `${out?.name ?? '-'}: ${fmtQty(txn.outputQty ?? 0)} ${out?.unit ?? ''}`] as [string, string],
        ...(settings.features.godowns ? [[t('stGodown'), godownName(txn.godownId)] as [string, string]] : []),
        [t('stMaterialsCost'), fmtMoney(txn.subtotal, sym)] as [string, string],
        [t('stCharges'), fmtMoney(txn.charges, sym) + (txn.charges && txn.accountId ? ` (${accountById.get(txn.accountId)?.name ?? ''})` : '')] as [string, string],
        [t('stUnitCost'), fmtMoney(unitCost, sym)] as [string, string],
      ]
      : [
        [t('stFromGodown'), godownName(txn.godownId)] as [string, string],
        [t('stToGodown'), godownName(txn.toGodownId)] as [string, string],
        [t('stTransferValue'), fmtMoney(txn.total, sym)] as [string, string],
      ]),
  ]

  async function remove() {
    if (!txn) return
    if (!(await confirm({ title: t('stDeleteEntry', { no: txn.number }), text: t('stDeleteText'), danger: true, okLabel: t('delete') }))) return
    try {
      await deleteTxn(db, txn)
      toast(t('deleted'))
      onClose()
    } catch (err) {
      toast(err instanceof TxnError ? t(err.problem.key, err.problem.vars) : t('somethingWrong'), 'error')
    }
  }

  const print = () => printNode(
    <StockTxnSheet
      firm={firm} txn={txn} dir={dir} facts={facts}
      title={`${t(isMfg ? 'tt_manufacture' : 'tt_stock_transfer')} ${txn.number}`}
      cols={{ item: isMfg ? t('stMaterial') : t('stItem'), qty: t('qty'), rate: t('stAvgCost'), amount: t('amount'), total: t('total'), note: t('note') }}
    />,
    'A4',
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${t(isMfg ? 'tt_manufacture' : 'tt_stock_transfer')} ${txn.number}`}
      footer={<>
        {can('delete') && !locked && <Button variant="ghost" onClick={remove} className="me-auto text-red-700 hover:bg-red-50"><Trash2 className="size-4" />{t('delete')}</Button>}
        <Button variant="secondary" onClick={print}><Printer className="size-4" />{t('print')}</Button>
        {!locked && <Button variant="secondary" onClick={() => onEdit(txn)}><Pencil className="size-4" />{t('edit')}</Button>}
        <Button onClick={onClose}>{t('close')}</Button>
      </>}
    >
      <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-stone-100 pb-1">
            <dt className="text-stone-500">{k}</dt>
            <dd className="num text-end font-medium text-stone-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="table-wrap rounded-lg border border-stone-200">
        <table className="tbl">
          <thead>
            <tr><th>{isMfg ? t('stMaterial') : t('stItem')}</th><th className="r">{t('qty')}</th><th className="r">{t('stAvgCost')}</th><th className="r">{t('amount')}</th></tr>
          </thead>
          <tbody>
            {txn.lines.map((l, i) => (
              <tr key={i}>
                <td className="font-medium">{l.name}</td>
                <td className="r num">{fmtQty(l.qty)} {l.unit}</td>
                <td className="r"><Money value={l.rate} symbol={sym} /></td>
                <td className="r"><Money value={l.amount} symbol={sym} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>{t('total')}</td><td className="r"><Money value={txn.subtotal} symbol={sym} /></td></tr>
          </tfoot>
        </table>
      </div>
      {txn.notes && <p className="mt-3 text-sm text-stone-600"><span className="font-medium">{t('note')}:</span> {txn.notes}</p>}
    </Modal>
  )
}

/** printed transfer note / production slip (rendered outside the providers, so plain props) */
function StockTxnSheet({ firm, txn, title, facts, cols, dir }: {
  firm: Firm
  txn: Txn
  title: string
  facts: [string, string][]
  cols: { item: string; qty: string; rate: string; amount: string; total: string; note: string }
  dir: 'ltr' | 'rtl'
}) {
  const sym = firm.currencySymbol
  const cell = { padding: '4px 6px', borderBottom: '1px solid #ddd' } as const
  const r = { ...cell, textAlign: 'end' } as const
  return (
    <div dir={dir} style={{ color: '#111', background: '#fff', fontSize: 12, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f766e', paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firm.logo && <img src={firm.logo} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{firm.name}</div>
            {firm.phone && <div className="num" style={{ fontSize: 11, color: '#444' }}>{firm.phone}</div>}
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>{title}</div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 12 }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc' }}>
            <span style={{ color: '#555' }}>{k}</span><b className="num">{v}</b>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f2f2f2' }}>
            <th style={{ ...cell, textAlign: 'start' }}>{cols.item}</th><th style={r}>{cols.qty}</th><th style={r}>{cols.rate}</th><th style={r}>{cols.amount}</th>
          </tr>
        </thead>
        <tbody>
          {txn.lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}>{l.name}</td>
              <td className="num" style={r}>{fmtQty(l.qty)} {l.unit}</td>
              <td className="num" style={r}>{fmtMoney(l.rate, sym)}</td>
              <td className="num" style={r}>{fmtMoney(l.amount, sym)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }} colSpan={3}>{cols.total}</td>
            <td className="num" style={{ ...r, fontWeight: 700 }}>{fmtMoney(txn.subtotal, sym)}</td>
          </tr>
        </tbody>
      </table>
      {txn.notes && <p style={{ marginTop: 10 }}><b>{cols.note}:</b> {txn.notes}</p>}
    </div>
  )
}
