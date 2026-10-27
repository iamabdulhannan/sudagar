import { Download, FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DateRange, resolveRange, type Range } from '../../components/DateRange'
import { buildRow, listColumns, type ListRow } from '../../components/txn/columns'
import { isDraftDoc, isInvoice, isReturn, matchesSearch } from '../../components/txn/logic'
import { TxnTable } from '../../components/txn/TxnTable'
import { Button, Card, Empty, PageHeader, SearchInput, Select, Stat } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtMoney, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnNewPath } from '../../lib/paths'
import { TXN_META, typeFromSlug } from '../../lib/txn'
import type { TxnType } from '../../lib/types'

type StatusFilter = '' | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'open' | 'converted' | 'cancelled' | 'active'

export default function TxnList() {
  const { slug = '' } = useParams()
  const type = typeFromSlug(slug)
  if (!type) return <Navigate to="/dashboard" replace />
  return <TxnListOf key={type} type={type} />
}

function TxnListOf({ type }: { type: TxnType }) {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>({ period: 'month' })
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [partyId, setPartyId] = useState('')
  const [catId, setCatId] = useState('')
  const sym = data.firm.currencySymbol
  const cols = useMemo(() => listColumns(type, data), [type, data])
  const todayStr = today()

  const ofType = useMemo(() => data.txns.filter((x) => x.type === type), [data.txns, type])
  const parties = useMemo(() => {
    const ids = new Set(ofType.map((x) => x.partyId).filter(Boolean))
    return data.parties.filter((p) => ids.has(p.id))
  }, [ofType, data.parties])
  const heads = useMemo(() => data.moneyCategories.filter((c) => c.kind === (type === 'other_income' ? 'income' : 'expense')), [data.moneyCategories, type])

  const rows = useMemo<ListRow[]>(() => {
    const { from, to } = resolveRange(range)
    const out: ListRow[] = []
    for (const x of ofType) {
      if ((from && x.date < from) || (to && x.date > to)) continue
      if (partyId && x.partyId !== partyId) continue
      if (catId && x.categoryId !== catId) continue
      const r = buildRow(x, cols, data, books.dues, todayStr, t)
      if (q && !matchesSearch(x, q, r.party)) continue
      if (status && !statusMatches(status, r)) continue
      out.push(r)
    }
    return out
  }, [ofType, range, partyId, catId, q, status, cols, data, books.dues, todayStr, t])

  const live = rows.filter((r) => !r.t.cancelled)
  const sum = (f: (r: ListRow) => number) => round2(live.reduce((a, r) => a + f(r), 0))
  const total = sum((r) => r.t.total)

  const statusOptions: [StatusFilter, string][] = isInvoice(type)
    ? [['paid', t('paid')], ['partial', t('partial')], ['unpaid', t('unpaid')], ['overdue', t('overdue')], ['cancelled', t('cancelled')]]
    : isDraftDoc(type)
      ? [['open', t('open')], ['converted', t('converted')], ['cancelled', t('cancelled')]]
      : [['active', t('active')], ['cancelled', t('cancelled')]]

  const exportCsv = () => {
    const header = [t('date'), t('number'), ...(cols.party ? [t('txParty')] : []), ...cols.extra.map((k) => t(k)), t('total'),
      ...(cols.paid ? [t(cols.paidKey)] : []), ...(cols.due ? [t('txBalanceDue')] : []), t('status'), t('notes')]
    const body = rows.map((r) => [
      r.t.date, r.t.number, ...(cols.party ? [r.party] : []), ...r.extra, r.t.total,
      ...(cols.paid ? [r.paid] : []), ...(cols.due ? [r.due] : []),
      r.t.cancelled ? t('cancelled') : r.status ? t(r.status) : '', r.t.notes ?? '',
    ])
    const { from, to } = resolveRange(range)
    downloadCsv(`${TXN_META[type].slug}${from ? '-' + from : ''}${to ? '-' + to : ''}`, header, body)
  }

  const newBtn = (
    <Button onClick={() => navigate(txnNewPath(type))}>
      <Plus className="size-4" />{t('txNewOf', { name: t(TXN_META[type].label) })}
    </Button>
  )

  if (ofType.length === 0) {
    return (
      <div>
        <PageHeader title={t('tp_' + type)} actions={newBtn} />
        <Card>
          <Empty icon={<FileText className="size-6" />} title={t('txNoneYet', { name: t('tp_' + type) })} text={t('txNoneYetText')} action={newBtn} />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('tp_' + type)}
        subtitle={t('txCountIn', { n: rows.length })}
        actions={<>
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" />{t('exportCsv')}</Button>
          {newBtn}
        </>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('txCount')} value={live.length} />
        <Stat label={t('total')} value={fmtMoney(total, sym)} tone="brand" />
        {(isInvoice(type) || isReturn(type) || type === 'expense') && <>
          <Stat label={t(cols.paidKey)} value={fmtMoney(sum((r) => r.paid), sym)} tone="good" />
          <Stat label={t('txBalanceDue')} value={fmtMoney(sum((r) => r.due), sym)} tone={sum((r) => r.due) > 0 ? 'bad' : 'neutral'}
            hint={isInvoice(type) ? t('txOverdueCount', { n: live.filter((r) => r.status === 'overdue').length }) : undefined} />
        </>}
        {isDraftDoc(type) && <>
          <Stat label={t('txOpenValue')} value={fmtMoney(sum((r) => (r.status === 'open' ? r.t.total : 0)), sym)} tone="warn"
            hint={t('txCountIn', { n: live.filter((r) => r.status === 'open').length })} />
          <Stat label={t('converted')} value={live.filter((r) => r.status === 'converted').length} tone="good" />
        </>}
        {(type === 'payment_in' || type === 'payment_out' || type === 'other_income' || type === 'capital_in' || type === 'drawing') && <>
          <Stat label={t('pm_cash')} value={fmtMoney(sum((r) => (r.t.paymentMode === 'cash' || !r.t.paymentMode ? r.t.total : 0)), sym)} />
          <Stat label={t('txOtherModes')} value={fmtMoney(sum((r) => (r.t.paymentMode && r.t.paymentMode !== 'cash' ? r.t.total : 0)), sym)} />
        </>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateRange value={range} onChange={setRange} />
        <SearchInput value={q} onChange={setQ} placeholder={t('txSearchPh')} className="min-w-48 flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-auto" aria-label={t('status')}>
          <option value="">{t('txAnyStatus')}</option>
          {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        {cols.party && parties.length > 0 && (
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="w-auto max-w-56" aria-label={t('txParty')}>
            <option value="">{t('txAllParties')}</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        {(type === 'expense' || type === 'other_income') && heads.length > 0 && (
          <Select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-auto max-w-56" aria-label={t(type === 'expense' ? 'txExpenseHead' : 'txIncomeHead')}>
            <option value="">{t(type === 'expense' ? 'txAllHeads' : 'txAllIncomeHeads')}</option>
            {heads.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
      </div>

      {rows.length === 0 ? (
        <Card><Empty title={t('noResults')} text={t('txNoMatch')} /></Card>
      ) : (
        <TxnTable rows={rows} cols={cols} />
      )}
    </div>
  )
}

function statusMatches(f: StatusFilter, r: ListRow): boolean {
  switch (f) {
    case 'cancelled': return !!r.t.cancelled
    case 'active': return !r.t.cancelled
    case 'paid': return r.status === 'paid'
    case 'overdue': return r.status === 'overdue'
    case 'partial': return !r.t.cancelled && r.due > 0.001 && r.paid > 0.001
    case 'unpaid': return !r.t.cancelled && r.due > 0.001 && r.paid <= 0.001
    case 'open': return r.status === 'open'
    case 'converted': return r.status === 'converted'
    default: return true
  }
}
