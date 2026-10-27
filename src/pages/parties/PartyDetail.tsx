import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, FileText, MapPin, MessageCircle, Pencil, Phone, Power, ShoppingCart, Trash2, Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BalanceText, KindBadge } from '../../components/parties/PartyBits'
import { PartyFormModal } from '../../components/parties/PartyFormModal'
import { PartyInvoices } from '../../components/parties/PartyInvoices'
import { PartyLedger } from '../../components/parties/PartyLedger'
import { PartyTxns } from '../../components/parties/PartyTxns'
import { isCustomer, isSupplier, waLink } from '../../components/parties/partyUtils'
import { Badge, Button, Card, Empty, PageHeader, Tabs, useUi } from '../../components/ui'
import { useBooks, useData } from '../../lib/data'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnNewPath } from '../../lib/paths'
import type { Party } from '../../lib/types'

type Tab = 'ledger' | 'invoices' | 'txns'

export default function PartyDetail() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { partyById } = useData()
  const party = partyById.get(id)
  if (!party) {
    return (
      <Card>
        <Empty
          icon={<Users className="size-7" />}
          title={t('pt_notFound')}
          action={<Link to="/parties"><Button variant="secondary">{t('back')}</Button></Link>}
        />
      </Card>
    )
  }
  return <PartyView key={party.id} party={party} />
}

function PartyView({ party }: { party: Party }) {
  const { t } = useI18n()
  const { db, firm, txns, partyGroups } = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const { toast, confirm } = useUi()
  const [tab, setTab] = useState<Tab>('ledger')
  const [editing, setEditing] = useState(false)

  const balance = books.balances.get(`party:${party.id}`) ?? 0
  const sym = firm.currencySymbol
  const own = useMemo(() => txns.filter((x) => x.partyId === party.id), [txns, party.id])
  const invoiceCount = own.filter((x) => x.type === 'sale' || x.type === 'purchase').length
  const group = party.groupId ? partyGroups.find((g) => g.id === party.groupId)?.name : undefined
  const q = `party=${party.id}`

  const wa = balance > 0
    ? waLink(party.phone, t('pt_waMsg', { name: party.name, firm: firm.name, amount: fmtMoney(balance, sym) }))
    : undefined

  const toggleActive = async () => {
    await db.transaction('rw', [db.parties, db.audit], async () => {
      await db.parties.update(party.id, { active: !party.active })
      await db.audit.add({ at: Date.now(), action: 'update', entity: 'party', entityId: party.id, summary: `${party.name} ${party.active ? 'deactivated' : 'activated'}` })
    })
    toast(party.active ? t('pt_deactivated') : t('pt_activated'))
  }

  const remove = async () => {
    if (own.length) { toast(t('pt_cannotDelete'), 'error'); return }
    if (!(await confirm({ title: t('pt_deleteQ', { name: party.name }), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    await db.transaction('rw', [db.parties, db.audit], async () => {
      await db.parties.delete(party.id)
      await db.audit.add({ at: Date.now(), action: 'delete', entity: 'party', entityId: party.id, summary: party.name })
    })
    toast(t('deleted'))
    navigate('/parties')
  }

  return (
    <div>
      <PageHeader
        back={
          <Link to="/parties" className="mb-1 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('navParties')}
          </Link>
        }
        title={<span className="flex flex-wrap items-center gap-2">{party.name}<KindBadge kind={party.kind} />{!party.active && <Badge>{t('inactive')}</Badge>}</span>}
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" />{t('edit')}</Button>
          <Button variant="secondary" size="sm" onClick={toggleActive}><Power className="size-4" />{party.active ? t('pt_deactivate') : t('pt_activate')}</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={remove}
            disabled={own.length > 0}
            title={own.length > 0 ? t('pt_cannotDelete') : undefined}
            className="text-red-700"
          >
            <Trash2 className="size-4" />{t('delete')}
          </Button>
        </>}
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1.5 text-sm text-stone-600">
            {party.phone && (
              <a href={`tel:${party.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-stone-800 hover:text-brand-700">
                <Phone className="size-4 text-stone-400" /><span className="num">{party.phone}</span>
              </a>
            )}
            {(party.address || party.city) && (
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-stone-400" />{[party.address, party.city].filter(Boolean).join(', ')}</div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-[13px]">
              {party.email && <span>{t('email')}: <span className="text-stone-800">{party.email}</span></span>}
              {party.ntn && <span>{t('ntn')}: <span className="num text-stone-800">{party.ntn}</span></span>}
              {group && <span>{t('pt_group')}: <span className="text-stone-800">{group}</span></span>}
              {party.creditLimit ? <span>{t('pt_creditLimit')}: <span className="num text-stone-800">{fmtMoney(party.creditLimit, sym)}</span></span> : null}
              {party.priceTier === 'wholesale' && <Badge tone="brand">{t('pt_tier_wholesale')}</Badge>}
              {party.openingBalance !== 0 && (
                <span>{t('pt_openingBalance')}: <span className="num text-stone-800">{fmtMoney(Math.abs(party.openingBalance), sym)}</span> ({party.openingBalance > 0 ? t('receivable') : t('payable')}, {fmtDate(party.openingDate)})</span>
              )}
            </div>
            {party.notes && <p className="pt-1 text-[13px] text-stone-500">{party.notes}</p>}
          </div>
          <div className="shrink-0 md:text-end">
            <div className="text-[13px] font-medium text-stone-500">{t('pt_currentBalance')}</div>
            <BalanceText value={balance} symbol={sym} big align="mdEnd" />
            {!!party.creditLimit && balance > party.creditLimit && (
              <div className="mt-1 text-xs font-medium text-red-700">{t('pt_overLimitShort')}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          {isCustomer(party.kind) && <>
            <Button size="sm" onClick={() => navigate(txnNewPath('sale', q))}><FileText className="size-4" />{t('newSale')}</Button>
            <Button size="sm" variant="success" onClick={() => navigate(txnNewPath('payment_in', q))}><ArrowDownLeft className="size-4" />{t('pt_receivePayment')}</Button>
          </>}
          {isSupplier(party.kind) && <>
            <Button size="sm" variant={isCustomer(party.kind) ? 'secondary' : 'primary'} onClick={() => navigate(txnNewPath('purchase', q))}><ShoppingCart className="size-4" />{t('newPurchase')}</Button>
            <Button size="sm" variant="warning" onClick={() => navigate(txnNewPath('payment_out', q))}><ArrowUpRight className="size-4" />{t('pt_makePayment')}</Button>
          </>}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-600 px-3 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50">
              <MessageCircle className="size-4" />{t('pt_waReminder')}
            </a>
          ) : (
            <Button size="sm" variant="secondary" disabled title={balance > 0 ? t('pt_waNoPhone') : t('pt_waNothingDue')}>
              <MessageCircle className="size-4" />{t('pt_waReminder')}
            </Button>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ledger', label: t('pt_ledger') },
              { value: 'invoices', label: t('pt_invoices'), count: invoiceCount },
              { value: 'txns', label: t('pt_allTxns'), count: own.length },
            ]}
          />
        </div>
        {tab === 'ledger' && <PartyLedger party={party} />}
        {tab === 'invoices' && <PartyInvoices party={party} />}
        {tab === 'txns' && <PartyTxns party={party} />}
      </Card>

      <PartyFormModal open={editing} onClose={() => setEditing(false)} initial={party} />
    </div>
  )
}
