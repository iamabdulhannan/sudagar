import { BookOpen, Download, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { downloadCsv } from '../../lib/csv'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { statement } from '../../lib/ledger'
import { txnPath } from '../../lib/paths'
import type { Party } from '../../lib/types'
import { DateRange, resolveRange, type Range } from '../DateRange'
import { printNode } from '../PrintPortal'
import { Button, Empty } from '../ui'
import { docLabel } from './docLabel'
import { balanceDir } from './partyUtils'
import { StatementSheet } from './StatementSheet'

/** party khata: running statement with Dr / Cr balance, print and CSV */
export function PartyLedger({ party }: { party: Party }) {
  const { t, dir } = useI18n()
  const { firm, txnById } = useData()
  const books = useBooks()
  const [range, setRange] = useState<Range>({ period: 'all' })
  const { from, to } = resolveRange(range)
  const st = useMemo(() => statement(books, `party:${party.id}`, from, to), [books, party.id, from, to])
  const sym = firm.currencySymbol

  const totals = useMemo(() => ({
    debit: st.rows.reduce((a, r) => a + r.debit, 0),
    credit: st.rows.reduce((a, r) => a + r.credit, 0),
  }), [st])

  const drcr = (n: number) => {
    const d = balanceDir(n)
    return d === 'settled' ? fmtMoney(0, sym) : `${fmtMoney(Math.abs(n), sym)} ${d === 'receive' ? t('pt_dr') : t('pt_cr')}`
  }
  const period = from || to ? `${fmtDate(from) || '...'} ${t('to')} ${fmtDate(to) || fmtDate(today())}` : t('pt_allTime')
  const closingLabel = (n: number) => {
    const d = balanceDir(n)
    return d === 'receive' ? t('pt_closingReceive') : d === 'pay' ? t('pt_closingPay') : t('pt_settled')
  }

  const rowDoc = (txnId?: string) => (txnId ? txnById.get(txnId) : undefined)

  const print = () => {
    const rows = [
      ...(from ? [[fmtDate(from), t('pt_openingBalance'), '', '', '', drcr(st.opening)]] : []),
      ...st.rows.map((r) => {
        const x = rowDoc(r.txnId)
        return [fmtDate(r.date), docLabel(r.kind, t), x?.number ?? '', r.debit ? fmtMoney(r.debit, sym) : '', r.credit ? fmtMoney(r.credit, sym) : '', drcr(r.balance)]
      }),
    ]
    printNode(
      <StatementSheet
        firm={firm}
        dir={dir}
        ntnLabel={t('ntn')}
        title={t('pt_statementTitle')}
        generated={`${t('pt_printedOn')} ${fmtDate(today())}`}
        meta={[
          [t('pt_party'), party.name],
          ...(party.phone ? [[t('phone'), party.phone] as [string, string]] : []),
          ...(party.address || party.city ? [[t('address'), [party.address, party.city].filter(Boolean).join(', ')] as [string, string]] : []),
          ...(party.ntn ? [[t('ntn'), party.ntn] as [string, string]] : []),
          [t('pt_period'), period],
        ]}
        columns={[
          { label: t('date') }, { label: t('pt_document') }, { label: t('number') },
          { label: t('pt_debitGave'), right: true }, { label: t('pt_creditGot'), right: true }, { label: t('balance'), right: true },
        ]}
        rows={rows}
        foot={[t('total'), '', '', fmtMoney(totals.debit, sym), fmtMoney(totals.credit, sym), drcr(st.closing)]}
        summary={[
          [t('pt_openingBalance'), drcr(st.opening)],
          [t('pt_totalDebit'), fmtMoney(totals.debit, sym)],
          [t('pt_totalCredit'), fmtMoney(totals.credit, sym)],
          [closingLabel(st.closing), fmtMoney(Math.abs(st.closing), sym)],
        ]}
      />,
      'A4',
    )
  }

  const csv = () => {
    const header = [t('date'), t('pt_document'), t('number'), t('debit'), t('credit'), t('balance'), 'Dr/Cr']
    const rows: (string | number)[][] = []
    if (from) rows.push([from, t('pt_openingBalance'), '', '', '', Math.abs(st.opening), st.opening >= 0 ? 'Dr' : 'Cr'])
    for (const r of st.rows) {
      rows.push([r.date, docLabel(r.kind, t), rowDoc(r.txnId)?.number ?? '', r.debit || '', r.credit || '', Math.abs(r.balance), r.balance >= 0 ? 'Dr' : 'Cr'])
    }
    rows.push([t('closing'), '', '', totals.debit, totals.credit, Math.abs(st.closing), st.closing >= 0 ? 'Dr' : 'Cr'])
    downloadCsv(`statement-${party.name.replace(/[^\w]+/g, '-')}-${today()}.csv`, header, rows)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <DateRange value={range} onChange={setRange} />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={csv}><Download className="size-4" />{t('exportCsv')}</Button>
          <Button variant="secondary" size="sm" onClick={print}><Printer className="size-4" />{t('pt_printStatement')}</Button>
        </div>
      </div>

      {st.rows.length === 0 && !from ? (
        <Empty icon={<BookOpen className="size-7" />} title={t('pt_noEntries')} text={t('pt_noEntriesText')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('pt_document')}</th>
                <th>{t('number')}</th>
                <th className="r">{t('pt_debitGave')}</th>
                <th className="r">{t('pt_creditGot')}</th>
                <th className="r">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {from && (
                <tr className="bg-stone-50/70">
                  <td className="num whitespace-nowrap">{fmtDate(from)}</td>
                  <td className="font-medium" colSpan={4}>{t('pt_openingBalance')}</td>
                  <td className="r num whitespace-nowrap font-medium">{drcr(st.opening)}</td>
                </tr>
              )}
              {st.rows.map((r, i) => {
                const x = rowDoc(r.txnId)
                return (
                  <tr key={(r.txnId ?? r.kind) + i}>
                    <td className="num whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td>{docLabel(r.kind, t)}</td>
                    <td className="num">
                      {x ? <Link to={txnPath(x.type, x.id)} className="text-brand-700 hover:underline">{x.number}</Link> : ''}
                    </td>
                    <td className="r num">{r.debit ? fmtMoney(r.debit, sym) : ''}</td>
                    <td className="r num">{r.credit ? fmtMoney(r.credit, sym) : ''}</td>
                    <td className={cx('r num whitespace-nowrap font-medium', r.balance > 0 ? 'text-emerald-700' : r.balance < 0 ? 'text-red-700' : 'text-stone-500')}>
                      {drcr(r.balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t('closing')}</td>
                <td className="r num">{fmtMoney(totals.debit, sym)}</td>
                <td className="r num">{fmtMoney(totals.credit, sym)}</td>
                <td className={cx('r num whitespace-nowrap', st.closing > 0 ? 'text-emerald-700' : st.closing < 0 ? 'text-red-700' : '')}>{drcr(st.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-4 py-3 text-xs text-stone-500">{t('pt_drCrHint')}</p>
    </div>
  )
}
