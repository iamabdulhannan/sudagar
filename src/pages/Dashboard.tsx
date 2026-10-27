import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, Boxes, CalendarRange, HandCoins, Landmark, ReceiptText, TrendingUp, Truck } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCards } from '../components/dashboard/AlertCards'
import { AutoBackupNotice } from '../components/dashboard/AutoBackupNotice'
import { BackupBanner } from '../components/dashboard/BackupBanner'
import { LowStockPanel, OverduePanel, RecentTxns, TopItems } from '../components/dashboard/Panels'
import { QuickActions } from '../components/dashboard/QuickActions'
import { SalesChart } from '../components/dashboard/SalesChart'
import { SetupChecklist } from '../components/dashboard/SetupChecklist'
import { Card, Money, Stat } from '../components/ui'
import { useAccess } from '../lib/access'
import { useBooks, useData } from '../lib/data'
import { addDays, getPref, today } from '../lib/db'
import { fmtDate, fmtMoney, monthEnd, monthStart } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { profitLoss } from '../lib/ledger'
import { reportPath } from '../lib/paths'
import { TXN_META } from '../lib/txn'
import { chequeRegister, dailyTotals, dashboardSummary, itemProfit, lowStock, overdueInvoices, partyNameOf, reminderRows } from '../lib/reports'

const BACKUP_DAYS = 7

export default function Dashboard() {
  const { t, lang } = useI18n()
  const data = useData()
  const books = useBooks()
  const navigate = useNavigate()
  const { user, can } = useAccess()
  const { firm, items, txns, parties } = data
  const sym = firm.currencySymbol
  const d = today()
  const mFrom = monthStart(d), mTo = monthEnd(d)
  const lastBackup = useLiveQuery(() => getPref<number>(`lastBackup.${firm.id}`, 0), [firm.id])

  const sum = useMemo(() => dashboardSummary(data, books, d, mFrom, mTo), [data, books, d, mFrom, mTo])
  const profit = useMemo(() => profitLoss(books, mFrom, mTo).netProfit, [books, mFrom, mTo])
  const days = useMemo(() => dailyTotals(data, addDays(d, -29), d), [data, d])
  const top = useMemo(() => [...itemProfit(data, books, mFrom, mTo).rows].sort((a, b) => b.sales - a.sales).filter((r) => r.sales > 0).slice(0, 5), [data, books, mFrom, mTo])
  const low = useMemo(() => lowStock(data, books.stock), [data, books])
  const overdue = useMemo(() => overdueInvoices(data, books, d), [data, books, d])
  const recent = txns.slice(0, 10)
  const remind = useMemo(() => {
    const late = reminderRows(data, books, d).filter((r) => r.overdueCount > 0)
    return { parties: late.length, amount: late.reduce((a, r) => a + r.overdueAmount, 0) }
  }, [data, books, d])
  const cheques = useMemo(() => chequeRegister(data, d).totals, [data, d])
  // reports are only linked for people who may open them
  const go = (to: string) => (can(to.startsWith('/cash-bank') ? 'money' : 'reports') ? () => navigate(to) : undefined)

  const brandNew = items.length === 0 && txns.length === 0
  const backupDue = lastBackup !== undefined && txns.length > 0 && (!lastBackup || Date.now() - lastBackup > BACKUP_DAYS * 86400000)
  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? 'dash_morning' : hour < 17 ? 'dash_afternoon' : 'dash_evening')
  const weekday = new Date(d + 'T00:00:00').toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'long' })
  const salesTotal = days.reduce((a, x) => a + x.sales, 0)
  const purchaseTotal = days.reduce((a, x) => a + x.purchases, 0)
  const ic = 'size-4 text-stone-400'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-stone-500">{greeting}{user && <>, <span className="font-medium text-stone-700">{user.name}</span></>}</p>
          <h1 className="truncate text-xl font-bold text-stone-900 sm:text-2xl">{firm.name}</h1>
        </div>
        <p className="text-sm text-stone-500">{weekday}, <span className="num">{fmtDate(d)}</span></p>
      </header>

      <AutoBackupNotice />
      {backupDue && can('backup') && <BackupBanner lastBackup={lastBackup ?? 0} />}

      {brandNew && (
        <SetupChecklist state={{
          profile: !!(firm.phone || firm.address), items: items.length > 0, parties: parties.length > 0,
          sale: txns.some((x) => x.type === 'sale'), backup: !!lastBackup,
        }} />
      )}

      <QuickActions />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('dash_todaySales')} value={fmtMoney(sum.todaySales, sym)} tone="brand" icon={<ReceiptText className={ic} />}
          hint={t('dash_bills', { n: sum.todayBills })} onClick={go(reportPath('daybook'))} />
        <Stat label={t('dash_monthSales')} value={fmtMoney(sum.monthSales, sym)} icon={<CalendarRange className={ic} />}
          hint={t('dash_bills', { n: sum.monthBills })} onClick={go(reportPath('sale'))} />
        <Stat label={t('receivable')} value={fmtMoney(sum.receivable, sym)} tone="good" icon={<HandCoins className={ic} />}
          onClick={go(reportPath('partybalances'))} />
        <Stat label={t('payable')} value={fmtMoney(sum.payable, sym)} tone="bad" icon={<Truck className={ic} />}
          onClick={go(reportPath('partybalances'))} />
        <Stat label={t('dash_cash')} value={fmtMoney(sum.cash, sym)} icon={<Banknote className={ic} />} onClick={go('/cash-bank')} />
        <Stat label={t('dash_bank')} value={fmtMoney(sum.bank, sym)} icon={<Landmark className={ic} />} onClick={go('/cash-bank')} />
        <Stat label={t('dash_stockValue')} value={fmtMoney(sum.stockValue, sym)} icon={<Boxes className={ic} />} onClick={go(reportPath('stock'))} />
        {can('profit') && <Stat label={t('dash_monthProfit')} value={fmtMoney(profit, sym)} tone={profit < 0 ? 'bad' : 'good'} icon={<TrendingUp className={ic} />}
          onClick={go(reportPath('pl'))} />}
      </div>

      {!brandNew && (
        <AlertCards
          overdue={can('parties') ? remind : undefined}
          cheques={can('money') ? cheques : undefined}
          symbol={sym}
        />
      )}

      {!brandNew && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card
            className="min-w-0 lg:col-span-2"
            title={t('dash_chartTitle')}
            actions={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-600" />{t('la_sales')} <Money value={salesTotal} symbol={sym} className="font-semibold text-stone-900" /></span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-600" />{t('dash_purchases')} <Money value={purchaseTotal} symbol={sym} className="font-semibold text-stone-900" /></span>
              </div>
            }
          >
            <SalesChart
              days={days}
              symbol={sym}
              labels={{
                title: t('dash_chartTitle'),
                desc: t('dash_chartDesc', { sales: fmtMoney(salesTotal, sym), purchases: fmtMoney(purchaseTotal, sym) }),
                sales: t('la_sales'), purchases: t('dash_purchases'), date: t('date'),
              }}
            />
          </Card>
          <TopItems rows={top} symbol={sym} />
        </div>
      )}

      {!brandNew && (
        <div className="grid gap-4 md:grid-cols-2">
          <OverduePanel rows={overdue} symbol={sym} />
          <LowStockPanel rows={low} />
        </div>
      )}

      {!brandNew && <RecentTxns txns={recent} symbol={sym} partyName={(x) => partyNameOf(data, x, data.partyById) || (!x.partyId && TXN_META[x.type].side === 'sale' ? t('walkIn') : '')} />}
    </div>
  )
}
