import { ArrowLeft, ArrowRightLeft, Ban, ChevronDown, Copy, EllipsisVertical, HandCoins, Pencil, Printer, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { TxnDocument } from '../../components/print/printTxn'
import { balanceDue, docStatus, isInvoice, isStockDoc } from '../../components/txn/logic'
import { isSplit } from '../../components/txn/payLogic'
import { Menu } from '../../components/txn/Menu'
import { ChequeBadge, StatusBadge } from '../../components/txn/StatusBadge'
import { useTxnActions } from '../../components/txn/useTxnActions'
import { AuditCard, LinkedCard, PartyCard, SummaryCard } from '../../components/txn/ViewPanels'
import { Badge, Button, Card, Empty, PageHeader, Tabs } from '../../components/ui'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnListPath, txnNewPath, txnPath } from '../../lib/paths'
import { TXN_META, typeFromSlug } from '../../lib/txn'
import type { PrintSize } from '../../lib/types'

const SIZES: PrintSize[] = ['a4', 'a5', 'thermal80', 'thermal58']
const PAPER: Record<PrintSize, { width: string; padding: string }> = {
  a4: { width: '210mm', padding: '10mm' },
  a5: { width: '148mm', padding: '10mm' },
  thermal80: { width: '80mm', padding: '4mm' },
  thermal58: { width: '58mm', padding: '5mm' },
}

/** /txn/:slug/:id: preview, status, actions and linked documents */
export default function TxnView() {
  const { slug = '', id = '' } = useParams()
  const { t, lang } = useI18n()
  const data = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const act = useTxnActions()
  const type = typeFromSlug(slug)
  const txn = data.txnById.get(id)
  const [size, setSize] = useState<PrintSize>(data.settings.printSize)

  if (!type) return <Navigate to="/dashboard" replace />
  if (!txn) {
    return (
      <Card>
        <Empty title={t('txNotFound')} text={t('txNotFoundText')} action={<Link to={txnListPath(type)}><Button variant="secondary">{t('back')}</Button></Link>} />
      </Card>
    )
  }
  if (txn.type !== type) return <Navigate to={txnPath(txn.type, txn.id)} replace />

  const meta = TXN_META[type]
  const status = docStatus(txn, books.dues, today())
  const due = balanceDue(txn, books.dues)
  const party = txn.partyId ? data.partyById.get(txn.partyId) : undefined
  const convert = act.convertItems(txn)
  const payType = txn.type === 'sale' ? 'payment_in' : txn.type === 'purchase' ? 'payment_out' : undefined
  const canPay = !!payType && !!party && !txn.cancelled && due > 0.001

  const printItems = SIZES.map((s) => ({ label: t('ps_' + s), icon: <Printer />, onClick: () => act.print(txn, s) }))
  const moreItems = [
    { label: t('duplicate'), icon: <Copy />, onClick: () => act.duplicate(txn), hidden: isStockDoc(type) },
    { label: t('txCancelDoc'), icon: <Ban />, onClick: () => { void act.cancel(txn) }, hidden: !!txn.cancelled || !act.canDelete, danger: true, divider: true },
    { label: t('delete'), icon: <Trash2 />, danger: true, hidden: !act.canDelete, onClick: async () => { if (await act.remove(txn)) navigate(txnListPath(type), { replace: true }) } },
  ]
  const btn = 'inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-surface px-3 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50'

  return (
    <div>
      <PageHeader
        back={
          <Link to={txnListPath(type)} className="mb-1 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('tp_' + type)}
          </Link>
        }
        title={<span className={txn.cancelled ? 'line-through decoration-2 text-stone-500' : ''}>{t(meta.label)} <span className="num">{txn.number}</span></span>}
        subtitle={[party?.name ?? txn.partyName, fmtDate(txn.date)].filter(Boolean).join(' · ')}
        actions={<>
          {!txn.cancelled && !isStockDoc(type) && act.canEdit(txn) && <Button variant="secondary" onClick={() => act.edit(txn)}><Pencil className="size-4" />{t('edit')}</Button>}
          <div className="inline-flex">
            <Button variant="secondary" onClick={() => act.print(txn, size)} className="rounded-e-none"><Printer className="size-4" />{t('print')}</Button>
            <Menu label={t('txPrintSize')} items={printItems} className={btn + ' rounded-s-none border-s-0 px-2'}><ChevronDown className="size-4" /></Menu>
          </div>
          <Button variant="secondary" onClick={() => act.share(txn)}><Share2 className="size-4" /><span className="hidden sm:inline">{t('txWhatsApp')}</span></Button>
          {convert.length === 1 && <Button variant="secondary" onClick={convert[0].onClick}><ArrowRightLeft className="size-4" />{convert[0].label}</Button>}
          {convert.length > 1 && <Menu label={t('txConvert')} items={convert} className={btn}><ArrowRightLeft className="size-4" />{t('txConvert')}<ChevronDown className="size-4" /></Menu>}
          {canPay && (
            <Button onClick={() => navigate(txnNewPath(payType!, `party=${party!.id}&amount=${due}&invoice=${txn.id}`))}>
              <HandCoins className="size-4" />{t(payType === 'payment_in' ? 'txReceivePayment' : 'txMakePayment')}
            </Button>
          )}
          <Menu label={t('more')} items={moreItems} className={btn + ' px-2.5'}><EllipsisVertical className="size-4" /></Menu>
        </>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {txn.cancelled && status !== 'cancelled' && <StatusBadge status="cancelled" />}
        {isInvoice(type) && txn.status === 'converted' && <StatusBadge status="converted" />}
        <ChequeBadge txn={txn} />
        {isSplit(txn) && <Badge tone="info">{t('txSplitPayment')}</Badge>}
        {txn.pos && <Badge>POS</Badge>}
        {txn.cancelled && <span className="text-sm text-stone-500">{t('txCancelledNote')}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card padded={false} className="min-w-0">
          <Tabs value={size} onChange={setSize} tabs={SIZES.map((s) => ({ value: s, label: t('ps_' + s) }))} className="px-3" />
          <div className="overflow-x-auto bg-stone-100 p-3 sm:p-6">
            <div className="mx-auto shadow-md" style={{ background: '#fff', maxWidth: '100%', width: PAPER[size].width, padding: PAPER[size].padding }}>
              <TxnDocument data={data} txn={txn} size={size} books={books} lang={lang} />
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <SummaryCard txn={txn} />
          <PartyCard txn={txn} />
          <LinkedCard txn={txn} />
          {txn.notes && <Card title={t('notes')}><p className="whitespace-pre-line text-sm text-stone-700">{txn.notes}</p></Card>}
          <AuditCard txn={txn} />
        </div>
      </div>
    </div>
  )
}
