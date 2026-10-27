import { ArrowLeft, ArrowLeftRight, BookOpen, Download, Pencil, Printer, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AccountFormModal } from '../../components/cash/AccountFormModal'
import { AccountIcon } from '../../components/cash/AccountIcon'
import { Counterpart, useCounterpart } from '../../components/cash/RecentMovements'
import { DateRange, resolveRange, type Range } from '../../components/DateRange'
import { docLabel } from '../../components/parties/docLabel'
import { StatementSheet } from '../../components/parties/StatementSheet'
import { printNode } from '../../components/PrintPortal'
import { Badge, Button, Card, Empty, Money, PageHeader, Stat, useUi } from '../../components/ui'
import { cx } from '../../lib/cx'
import { downloadCsv } from '../../lib/csv'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { statement } from '../../lib/ledger'
import { txnNewPath, txnPath } from '../../lib/paths'
import type { Account } from '../../lib/types'

export default function AccountDetail() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { accountById } = useData()
  const acc = accountById.get(id)
  if (!acc) {
    return (
      <Card>
        <Empty
          icon={<Wallet className="size-7" />}
          title={t('cb_notFound')}
          action={<Link to="/cash-bank"><Button variant="secondary">{t('back')}</Button></Link>}
        />
      </Card>
    )
  }
  return <AccountView key={acc.id} acc={acc} />
}

function AccountView({ acc }: { acc: Account }) {
  const { t, dir } = useI18n()
  const { db, firm, settings, txns, txnById } = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const { toast, confirm } = useUi()
  const who = useCounterpart()
  const [range, setRange] = useState<Range>({ period: 'month' })
  const [editing, setEditing] = useState(false)
  const { from, to } = resolveRange(range)
  const sym = firm.currencySymbol
  const acct = `acc:${acc.id}`

  const st = useMemo(() => statement(books, acct, from, to), [books, acct, from, to])
  const totals = useMemo(() => ({
    in: st.rows.reduce((a, r) => a + r.debit, 0),
    out: st.rows.reduce((a, r) => a + r.credit, 0),
  }), [st])
  const balance = books.balances.get(acct) ?? 0

  const isDefault = acc.id === settings.defaultAccountId
  const used = useMemo(() => txns.some((x) => x.accountId === acc.id || x.toAccountId === acc.id), [txns, acc.id])
  const canDelete = !isDefault && !used && acc.openingBalance === 0
  const deleteWhy = isDefault ? t('cb_cantDeleteDefault') : used || acc.openingBalance !== 0 ? t('cb_cantDeleteUsed') : undefined

  const period = from || to ? `${fmtDate(from) || '...'} ${t('to')} ${fmtDate(to) || fmtDate(today())}` : t('pt_allTime')
  const rowsOut = st.rows.map((r) => {
    const x = r.txnId ? txnById.get(r.txnId) : undefined
    return { r, x, who: who(x, acc.id) }
  })

  const remove = async () => {
    if (!canDelete) { toast(deleteWhy ?? t('somethingWrong'), 'error'); return }
    if (!(await confirm({ title: t('cb_deleteQ', { name: acc.name }), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    await db.transaction('rw', [db.accounts, db.audit], async () => {
      await db.accounts.delete(acc.id)
      await db.audit.add({ at: Date.now(), action: 'delete', entity: 'account', entityId: acc.id, summary: acc.name })
    })
    toast(t('deleted'))
    navigate('/cash-bank')
  }

  const print = () => {
    printNode(
      <StatementSheet
        firm={firm}
        dir={dir}
        ntnLabel={t('ntn')}
        title={acc.kind === 'cash' ? t('cb_cashBook') : acc.kind === 'loan' ? t('cb_loanStatement') : t('cb_bankBook')}
        generated={`${t('pt_printedOn')} ${fmtDate(today())}`}
        meta={[
          [t('cb_account'), acc.name],
          ...(acc.bankName ? [[acc.kind === 'bank' ? t('cb_bankName') : t('cb_walletProvider'), acc.bankName] as [string, string]] : []),
          ...(acc.accountNo ? [[t('cb_accountNo'), acc.accountNo] as [string, string]] : []),
          [t('pt_period'), period],
        ]}
        columns={[
          { label: t('date') }, { label: t('pt_document') }, { label: t('number') }, { label: t('cb_party') },
          { label: t('cb_moneyIn'), right: true }, { label: t('cb_moneyOut'), right: true }, { label: t('balance'), right: true },
        ]}
        rows={[
          [fmtDate(from) || '', t('pt_openingBalance'), '', '', '', '', fmtMoney(st.opening, sym)],
          ...rowsOut.map(({ r, x, who: w }) => [
            fmtDate(r.date), docLabel(r.kind, t), x?.number ?? '', w.text,
            r.debit ? fmtMoney(r.debit, sym) : '', r.credit ? fmtMoney(r.credit, sym) : '', fmtMoney(r.balance, sym),
          ]),
        ]}
        foot={[t('total'), '', '', '', fmtMoney(totals.in, sym), fmtMoney(totals.out, sym), fmtMoney(st.closing, sym)]}
        summary={[
          [t('pt_openingBalance'), fmtMoney(st.opening, sym)],
          [t('cb_totalIn'), fmtMoney(totals.in, sym)],
          [t('cb_totalOut'), fmtMoney(totals.out, sym)],
          [t('cb_closingBalance'), fmtMoney(st.closing, sym)],
        ]}
      />,
      'A4',
    )
  }

  const csv = () => {
    const rows: (string | number)[][] = [[from ?? '', t('pt_openingBalance'), '', '', '', '', st.opening]]
    for (const { r, x, who: w } of rowsOut) rows.push([r.date, docLabel(r.kind, t), x?.number ?? '', w.text, r.debit || '', r.credit || '', r.balance])
    rows.push([t('closing'), '', '', '', totals.in, totals.out, st.closing])
    downloadCsv(`${acc.name.replace(/[^\w]+/g, '-')}-${today()}.csv`,
      [t('date'), t('pt_document'), t('number'), t('cb_party'), t('cb_moneyIn'), t('cb_moneyOut'), t('balance')], rows)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={
          <Link to="/cash-bank" className="mb-1 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('navCashBank')}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <AccountIcon kind={acc.kind} />
            {acc.name}
            {isDefault && <Badge tone="brand">{t('cb_default')}</Badge>}
            {!acc.active && <Badge>{t('inactive')}</Badge>}
          </span>
        }
        subtitle={[acc.kind === 'cash' ? t('ak_cash') : acc.bankName || t('ak_' + acc.kind), acc.accountNo].filter(Boolean).join(', ')}
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => navigate(txnNewPath('transfer'))}><ArrowLeftRight className="size-4" />{t('cb_transfer')}</Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" />{t('edit')}</Button>
          <Button variant="secondary" size="sm" className="text-red-700" onClick={remove} disabled={!canDelete} title={deleteWhy}>
            <Trash2 className="size-4" />{t('delete')}
          </Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {acc.kind === 'loan'
          ? <Stat label={t('cb_loanOwed')} tone="bad" value={<Money value={-balance} symbol={sym} />} hint={<Link to="/loans" className="text-brand-700 hover:underline">{t('navLoans')}</Link>} />
          : <Stat label={t('cb_currentBalance')} tone={balance < 0 ? 'bad' : 'brand'} value={<Money value={balance} symbol={sym} />} />}
        <Stat label={t('pt_openingBalance')} value={<Money value={st.opening} symbol={sym} />} hint={period} />
        <Stat label={t('cb_totalIn')} tone="good" value={<Money value={totals.in} symbol={sym} />} />
        <Stat label={t('cb_totalOut')} tone="bad" value={<Money value={totals.out} symbol={sym} />} />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <DateRange value={range} onChange={setRange} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={csv}><Download className="size-4" />{t('exportCsv')}</Button>
            <Button variant="secondary" size="sm" onClick={print}><Printer className="size-4" />{t('print')}</Button>
          </div>
        </div>
        {st.rows.length === 0 && st.opening === 0 ? (
          <Empty icon={<BookOpen className="size-7" />} title={t('cb_noEntries')} text={t('cb_noEntriesText')} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('pt_document')}</th>
                  <th>{t('cb_party')}</th>
                  <th className="r">{t('cb_moneyIn')}</th>
                  <th className="r">{t('cb_moneyOut')}</th>
                  <th className="r">{t('balance')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-stone-50/70">
                  <td className="num whitespace-nowrap">{fmtDate(from)}</td>
                  <td className="font-medium" colSpan={4}>{t('pt_openingBalance')}</td>
                  <td className="r num font-medium">{fmtMoney(st.opening, sym)}</td>
                </tr>
                {rowsOut.map(({ r, x, who: w }, i) => (
                  <tr key={(r.txnId ?? r.kind) + i}>
                    <td className="num whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td>
                      {docLabel(r.kind, t)}
                      {x && <> <Link to={txnPath(x.type, x.id)} className="num text-brand-700 hover:underline">{x.number}</Link></>}
                    </td>
                    <td className="text-stone-600"><Counterpart c={w} /></td>
                    <td className="r num text-emerald-700">{r.debit ? fmtMoney(r.debit, sym) : ''}</td>
                    <td className="r num text-red-700">{r.credit ? fmtMoney(r.credit, sym) : ''}</td>
                    <td className={cx('r num whitespace-nowrap font-medium', r.balance < 0 && 'text-red-700')}>{fmtMoney(r.balance, sym)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{t('closing')}</td>
                  <td className="r num">{fmtMoney(totals.in, sym)}</td>
                  <td className="r num">{fmtMoney(totals.out, sym)}</td>
                  <td className={cx('r num', st.closing < 0 && 'text-red-700')}>{fmtMoney(st.closing, sym)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <AccountFormModal open={editing} onClose={() => setEditing(false)} initial={acc} />
    </div>
  )
}
