import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useBooks, useData } from '../../lib/data'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { accountPath, partyPath, txnPath } from '../../lib/paths'
import type { Txn } from '../../lib/types'
import { docLabel } from '../parties/docLabel'
import { Card, Empty } from '../ui'

/** who the money moved with: the party, the walk-in name, the head, or the other account of a transfer */
export function useCounterpart() {
  const { t } = useI18n()
  const { partyById, accountById, moneyCategories } = useData()
  return (x: Txn | undefined, acctId: string): { text: string; partyId?: string } => {
    if (!x) return { text: '' }
    if (x.partyId) return { text: partyById.get(x.partyId)?.name ?? '', partyId: x.partyId }
    if (x.type === 'transfer') {
      const out = x.accountId === acctId
      const other = accountById.get((out ? x.toAccountId : x.accountId) ?? '')
      return { text: other ? t(out ? 'cb_toAcc' : 'cb_fromAcc', { name: other.name }) : '' }
    }
    if (x.categoryId) return { text: moneyCategories.find((c) => c.id === x.categoryId)?.name ?? '' }
    return { text: x.partyName || t('walkIn') }
  }
}

/** counterpart cell: links to the party when there is one */
export function Counterpart({ c }: { c: { text: string; partyId?: string } }) {
  if (c.partyId) return <Link to={partyPath(c.partyId)} className="hover:text-brand-700 hover:underline">{c.text}</Link>
  return <span>{c.text}</span>
}

/** the last money postings across all cash, bank and wallet accounts */
export function RecentMovements({ limit = 20 }: { limit?: number }) {
  const { t } = useI18n()
  const { firm, accountById, txnById } = useData()
  const books = useBooks()
  const who = useCounterpart()
  const sym = firm.currencySymbol

  const rows = useMemo(() => books.postings
    .filter((p) => p.acct.startsWith('acc:'))
    .sort((a, b) => (a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1))
    .slice(0, limit), [books, limit])

  return (
    <Card title={t('cb_recent')} padded={false}>
      {rows.length === 0 ? (
        <Empty title={t('cb_noMovements')} text={t('cb_noMovementsText')} />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('cb_account')}</th>
                <th>{t('pt_document')}</th>
                <th>{t('cb_party')}</th>
                <th className="r">{t('cb_moneyIn')}</th>
                <th className="r">{t('cb_moneyOut')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const accId = p.acct.slice(4)
                const acc = accountById.get(accId)
                const x = p.txnId ? txnById.get(p.txnId) : undefined
                return (
                  <tr key={p.seq}>
                    <td className="num whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td>{acc ? <Link to={accountPath(acc.id)} className="hover:text-brand-700 hover:underline">{acc.name}</Link> : ''}</td>
                    <td>
                      {docLabel(p.kind, t)}
                      {x && <> <Link to={txnPath(x.type, x.id)} className="num text-brand-700 hover:underline">{x.number}</Link></>}
                    </td>
                    <td className="text-stone-600"><Counterpart c={who(x, accId)} /></td>
                    <td className="r num text-emerald-700">{p.amount > 0 ? fmtMoney(p.amount, sym) : ''}</td>
                    <td className="r num text-red-700">{p.amount < 0 ? fmtMoney(-p.amount, sym) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
