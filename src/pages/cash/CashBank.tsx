import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Pencil, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountFormModal } from '../../components/cash/AccountFormModal'
import { AccountIcon } from '../../components/cash/AccountIcon'
import { MoneyHeads } from '../../components/cash/MoneyHeads'
import { RecentMovements } from '../../components/cash/RecentMovements'
import { Badge, Button, Card, Empty, IconButton, Money, PageHeader, Stat } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useBooks, useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { accountPath, txnNewPath } from '../../lib/paths'
import type { Account, AccountKind } from '../../lib/types'

export default function CashBank() {
  const { t } = useI18n()
  const { accounts, firm, settings } = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)
  const sym = firm.currencySymbol
  const balOf = (id: string) => books.balances.get(`acc:${id}`) ?? 0

  const byKind = useMemo(() => {
    const m: Record<AccountKind, number> = { cash: 0, bank: 0, wallet: 0, loan: 0 }
    for (const a of accounts) m[a.kind] += books.balances.get(`acc:${a.id}`) ?? 0
    return m
  }, [accounts, books])
  const total = byKind.cash + byKind.bank + byKind.wallet
  const hasBank = accounts.some((a) => (a.kind === 'bank' || a.kind === 'wallet') && a.active)
  const money = accounts.filter((a) => a.kind !== 'loan')
  const loans = accounts.filter((a) => a.kind === 'loan')

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('navCashBank')}
        subtitle={t('cb_subtitle')}
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('cb_addAccount')}</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('cb_totalMoney')} tone="brand" value={<Money value={total} symbol={sym} />} />
        <Stat label={t('cb_cashInHand')} value={<Money value={byKind.cash} symbol={sym} />} />
        <Stat label={t('cb_inBanks')} value={<Money value={byKind.bank} symbol={sym} />} />
        <Stat label={t('cb_inWallets')} value={<Money value={byKind.wallet} symbol={sym} />} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate(txnNewPath('transfer'))}><ArrowLeftRight className="size-4" />{t('cb_transfer')}</Button>
        {hasBank && <>
          <Button variant="secondary" onClick={() => navigate(txnNewPath('transfer'))}><ArrowDownToLine className="size-4" />{t('cb_deposit')}</Button>
          <Button variant="secondary" onClick={() => navigate(txnNewPath('transfer'))}><ArrowUpFromLine className="size-4" />{t('cb_withdraw')}</Button>
        </>}
        <Button variant="secondary" onClick={() => navigate(txnNewPath('other_income'))}><TrendingUp className="size-4 text-emerald-600" />{t('cb_addIncome')}</Button>
        <Button variant="secondary" onClick={() => navigate(txnNewPath('expense'))}><Receipt className="size-4 text-red-600" />{t('cb_addExpense')}</Button>
      </div>

      {money.length === 0 ? (
        <Card>
          <Empty icon={<Wallet className="size-7" />} title={t('cb_noAccounts')} action={<Button onClick={() => setAdding(true)}><Plus className="size-4" />{t('cb_addAccount')}</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {money.map((a) => {
            const b = balOf(a.id)
            return (
              <div key={a.id} className={cx('group relative rounded-xl border border-stone-200 bg-surface p-4 shadow-sm transition hover:border-brand-500 hover:shadow', !a.active && 'opacity-60')}>
                <Link to={accountPath(a.id)} className="flex items-start gap-3">
                  <AccountIcon kind={a.kind} />
                  <span className="min-w-0 flex-1 pe-8">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-stone-900">{a.name}</span>
                      {a.id === settings.defaultAccountId && <Badge tone="brand">{t('cb_default')}</Badge>}
                      {!a.active && <Badge>{t('inactive')}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {a.kind === 'cash' ? t('ak_cash') : [a.bankName || t('ak_' + a.kind), a.accountNo].filter(Boolean).join(', ')}
                    </span>
                    <span className={cx('num mt-3 block text-xl font-bold', b < 0 ? 'text-red-700' : 'text-stone-900')}>
                      <Money value={b} symbol={sym} />
                    </span>
                  </span>
                </Link>
                <IconButton label={t('edit')} onClick={() => setEditing(a)} className="absolute end-2 top-2">
                  <Pencil className="size-4" />
                </IconButton>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-28 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 text-sm font-medium text-stone-500 hover:border-brand-500 hover:text-brand-700 cursor-pointer"
          >
            <Plus className="size-4" />{t('cb_addAccount')}
          </button>
        </div>
      )}

      {loans.length > 0 && (
        <Card
          title={t('cb_loans')}
          actions={<>
            <Money value={-byKind.loan} symbol={sym} className="text-sm font-semibold text-red-700" />
            <Link to="/loans" className="text-sm font-medium text-brand-700 hover:underline">{t('viewAll')}</Link>
          </>}
          padded={false}
        >
          <p className="px-4 pt-3 text-xs text-stone-500">{t('cb_loansHint')}</p>
          <ul className="divide-y divide-stone-100">
            {loans.map((a) => (
              <li key={a.id} className={cx('flex items-center gap-3 px-4 py-3', !a.active && 'opacity-60')}>
                <AccountIcon kind="loan" />
                <Link to={accountPath(a.id)} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-stone-900 hover:text-brand-700">{a.name}</span>
                  <span className="block truncate text-xs text-stone-500">{[a.bankName, a.accountNo].filter(Boolean).join(', ') || t('ak_loan')}</span>
                </Link>
                <span className="text-end">
                  <span className="block text-[11px] text-stone-500">{t('cb_loanOwed')}</span>
                  <Money value={-balOf(a.id)} symbol={sym} className="font-semibold text-red-700" />
                </span>
                <IconButton label={t('edit')} onClick={() => setEditing(a)}><Pencil className="size-4" /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RecentMovements limit={20} />

      <div>
        <h2 className="mb-1 text-base font-semibold text-stone-900">{t('cb_heads')}</h2>
        <p className="mb-3 text-sm text-stone-500">{t('cb_headsHint')}</p>
        <MoneyHeads />
      </div>

      <AccountFormModal open={adding} onClose={() => setAdding(false)} />
      <AccountFormModal open={!!editing} onClose={() => setEditing(null)} initial={editing ?? undefined} />
    </div>
  )
}
