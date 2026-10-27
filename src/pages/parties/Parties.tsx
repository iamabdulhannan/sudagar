import { Download, FileUp, Plus, Tags, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BalanceText, KindBadge } from '../../components/parties/PartyBits'
import { GroupsModal } from '../../components/parties/GroupsModal'
import { ImportPartiesModal } from '../../components/parties/ImportPartiesModal'
import { PartyFormModal } from '../../components/parties/PartyFormModal'
import { balanceDir, isCustomer, isSupplier, matchParty, PARTY_CSV_HEADER, type BalanceDir } from '../../components/parties/partyUtils'
import { Badge, Button, Card, Empty, Money, PageHeader, SearchInput, Select, Stat, Tabs } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { partyPath } from '../../lib/paths'
import type { ID } from '../../lib/types'

type Tab = 'all' | 'customer' | 'supplier'
type Sort = 'name' | 'balance' | 'activity'

export default function Parties() {
  const { t } = useI18n()
  const { parties, partyGroups, txns, firm } = useData()
  const books = useBooks()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [bal, setBal] = useState<'all' | BalanceDir>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)

  const balOf = (id: ID) => books.balances.get(`party:${id}`) ?? 0
  const groupName = useMemo(() => new Map(partyGroups.map((g) => [g.id, g.name])), [partyGroups])

  /** date of the newest transaction of each party (txns are newest first) */
  const lastActivity = useMemo(() => {
    const m = new Map<ID, string>()
    for (const x of txns) if (x.partyId && !x.cancelled && !m.has(x.partyId)) m.set(x.partyId, x.date)
    return m
  }, [txns])

  const inTab = (k: (typeof parties)[number]['kind'], tb: Tab) => tb === 'all' || (tb === 'customer' ? isCustomer(k) : isSupplier(k))

  const totals = useMemo(() => {
    let receive = 0, pay = 0
    for (const p of parties) {
      const b = books.balances.get(`party:${p.id}`) ?? 0
      if (b > 0) receive += b
      else pay -= b
    }
    return { receive, pay }
  }, [parties, books])

  const list = useMemo(() => {
    const out = parties.filter((p) =>
      inTab(p.kind, tab) &&
      matchParty(p, q) &&
      (!group || (group === 'none' ? !p.groupId : p.groupId === group)) &&
      (bal === 'all' || balanceDir(books.balances.get(`party:${p.id}`) ?? 0) === bal))
    if (sort === 'balance') out.sort((a, b) => Math.abs(balOf(b.id)) - Math.abs(balOf(a.id)) || a.name.localeCompare(b.name))
    else if (sort === 'activity') out.sort((a, b) => (lastActivity.get(b.id) ?? '').localeCompare(lastActivity.get(a.id) ?? '') || a.name.localeCompare(b.name))
    return out
  }, [parties, tab, q, group, bal, sort, books, lastActivity])

  const exportCsv = () => {
    downloadCsv(`parties-${today()}.csv`, [...PARTY_CSV_HEADER, 'current_balance', 'last_activity'], list.map((p) => [
      p.name, p.kind, p.phone, p.email, p.address, p.city, p.ntn, p.groupId ? groupName.get(p.groupId) : '',
      p.openingBalance, p.openingDate, p.creditLimit, p.notes, balOf(p.id), lastActivity.get(p.id),
    ]))
  }

  const filtered = q || group || bal !== 'all'

  return (
    <div>
      <PageHeader
        title={t('navParties')}
        subtitle={t('pt_subtitle')}
        actions={<>
          <Button variant="secondary" onClick={() => setGroupsOpen(true)}><Tags className="size-4" />{t('pt_groups')}</Button>
          <Button variant="secondary" onClick={() => setImporting(true)}><FileUp className="size-4" />{t('pt_importCsv')}</Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!list.length}><Download className="size-4" />{t('exportCsv')}</Button>
          <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('pt_addParty')}</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t('pt_totalReceive')} tone="good" value={<Money value={totals.receive} symbol={firm.currencySymbol} />} onClick={() => setBal('receive')} />
        <Stat label={t('pt_totalPay')} tone="bad" value={<Money value={totals.pay} symbol={firm.currencySymbol} />} onClick={() => setBal('pay')} />
        <Stat label={t('pt_partyCount')} value={parties.length} hint={t('pt_activeCount', { n: parties.filter((p) => p.active).length })} />
      </div>

      <Card padded={false}>
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'all', label: t('all'), count: parties.length },
              { value: 'customer', label: t('pt_customers'), count: parties.filter((p) => isCustomer(p.kind)).length },
              { value: 'supplier', label: t('pt_suppliers'), count: parties.filter((p) => isSupplier(p.kind)).length },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('pt_searchPh')} className="w-full sm:w-72" />
          <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-auto min-w-36" aria-label={t('pt_group')}>
            <option value="">{t('pt_allGroups')}</option>
            {partyGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="none">{t('pt_noGroup')}</option>
          </Select>
          <Select value={bal} onChange={(e) => setBal(e.target.value as 'all' | BalanceDir)} className="w-auto min-w-36" aria-label={t('balance')}>
            <option value="all">{t('pt_anyBalance')}</option>
            <option value="receive">{t('receivable')}</option>
            <option value="pay">{t('payable')}</option>
            <option value="settled">{t('pt_settled')}</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto min-w-36" aria-label={t('pt_sortBy')}>
            <option value="name">{t('pt_sortName')}</option>
            <option value="balance">{t('pt_sortBalance')}</option>
            <option value="activity">{t('pt_sortActivity')}</option>
          </Select>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setGroup(''); setBal('all') }}>{t('pt_clearFilters')}</Button>
          )}
        </div>

        {parties.length === 0 ? (
          <Empty
            icon={<Users className="size-7" />}
            title={t('pt_emptyTitle')}
            text={t('pt_emptyText')}
            action={<div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('pt_addParty')}</Button>
              <Button variant="secondary" onClick={() => setImporting(true)}><FileUp className="size-4" />{t('pt_importCsv')}</Button>
            </div>}
          />
        ) : list.length === 0 ? (
          <Empty title={t('noResults')} text={t('pt_noMatch')} />
        ) : (
          <>
            {/* desktop table */}
            <div className="table-wrap hidden sm:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('phone')}</th>
                    <th>{t('type')}</th>
                    <th className="r">{t('balance')}</th>
                    <th className="r">{t('pt_lastActivity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="cursor-pointer" onClick={() => navigate(partyPath(p.id))}>
                      <td>
                        <Link to={partyPath(p.id)} className="font-medium text-stone-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>{p.name}</Link>
                        {!p.active && <Badge className="ms-2">{t('inactive')}</Badge>}
                        <div className="text-xs text-stone-500">
                          {[p.city, p.groupId ? groupName.get(p.groupId) : ''].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td className="num text-stone-700">{p.phone}</td>
                      <td><KindBadge kind={p.kind} /></td>
                      <td className="r"><BalanceText value={balOf(p.id)} symbol={firm.currencySymbol} /></td>
                      <td className="r num whitespace-nowrap text-stone-600">{fmtDate(lastActivity.get(p.id)) || <span className="text-stone-400">{t('pt_noActivity')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="divide-y divide-stone-100 border-t border-stone-100 sm:hidden">
              {list.map((p) => (
                <li key={p.id}>
                  <Link to={partyPath(p.id)} className="flex items-center gap-3 px-4 py-3 active:bg-stone-50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-stone-900">{p.name}</span>
                        {!p.active && <Badge>{t('inactive')}</Badge>}
                      </span>
                      <span className="block truncate text-xs text-stone-500">
                        <span className="num">{p.phone}</span>{p.phone && p.city ? ', ' : ''}{p.city}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-400">
                        <KindBadge kind={p.kind} />
                        <span className="num">{fmtDate(lastActivity.get(p.id))}</span>
                      </span>
                    </span>
                    <BalanceText value={balOf(p.id)} symbol={firm.currencySymbol} />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">{t('pt_showing', { n: list.length, total: parties.length })}</div>
          </>
        )}
      </Card>

      <PartyFormModal
        open={adding}
        onClose={() => setAdding(false)}
        kind={tab === 'supplier' ? 'supplier' : 'customer'}
      />
      <ImportPartiesModal open={importing} onClose={() => setImporting(false)} />
      <GroupsModal open={groupsOpen} onClose={() => setGroupsOpen(false)} />
    </div>
  )
}
