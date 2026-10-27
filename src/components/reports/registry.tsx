import {
  ArrowLeftRight, BadgePercent, Banknote, BookOpen, CalendarClock, ClipboardList, Coins, FileBarChart, Gift, HandCoins, Hourglass, Landmark,
  ListOrdered, Package, PackageMinus, Percent, PiggyBank, Receipt, Scale, ScrollText, ShoppingCart, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import type { Perm } from '../../lib/access'
import type { Settings } from '../../lib/types'

export type ReportGroup = 'txns' | 'parties' | 'accounts' | 'stock'

export interface ReportMeta {
  key: string
  group: ReportGroup
  icon: ReactNode
  /** i18n keys: rp_<key> (title) and rpd_<key> (one line description) */
  title: string
  desc: string
  /** lazily loaded page; receives `props` */
  Component: LazyExoticComponent<ComponentType<any>>
  props?: Record<string, unknown>
  /** only listed when this returns true */
  show?: (s: Settings) => boolean
  /** also needs this permission (on top of 'reports'), e.g. 'profit' */
  perm?: Perm
}

const SaleReport = lazy(() => import('./SaleReport'))

const ic = 'size-5'
const r = (key: string, group: ReportGroup, icon: ReactNode, Component: ReportMeta['Component'], extra: Partial<ReportMeta> = {}): ReportMeta =>
  ({ key, group, icon, title: `rp_${key}`, desc: `rpd_${key}`, Component, ...extra })

/** every report, in the order shown on the reports page */
export const REPORTS: ReportMeta[] = [
  r('sale', 'txns', <Receipt className={ic} />, SaleReport, { props: { type: 'sale' } }),
  r('purchase', 'txns', <ShoppingCart className={ic} />, SaleReport, { props: { type: 'purchase' } }),
  r('daybook', 'txns', <BookOpen className={ic} />, lazy(() => import('./DayBook'))),
  r('alltxns', 'txns', <ListOrdered className={ic} />, lazy(() => import('./AllTxns'))),
  r('billprofit', 'txns', <BadgePercent className={ic} />, lazy(() => import('./BillProfit')), { perm: 'profit' }),

  r('partybalances', 'parties', <Users className={ic} />, lazy(() => import('./PartyBalances'))),
  r('aging', 'parties', <Hourglass className={ic} />, lazy(() => import('./Aging'))),
  r('partywise', 'parties', <ArrowLeftRight className={ic} />, lazy(() => import('./PartyWise'))),
  r('loyalty', 'parties', <Gift className={ic} />, lazy(() => import('./LoyaltyReport')), { show: (s) => s.features.loyalty }),

  r('pl', 'accounts', <TrendingUp className={ic} />, lazy(() => import('./ProfitLoss')), { perm: 'profit' }),
  r('bs', 'accounts', <Landmark className={ic} />, lazy(() => import('./BalanceSheet')), { perm: 'profit' }),
  r('tb', 'accounts', <Scale className={ic} />, lazy(() => import('./TrialBalance'))),
  r('cashflow', 'accounts', <Banknote className={ic} />, lazy(() => import('./CashFlow'))),
  r('expenses', 'accounts', <Wallet className={ic} />, lazy(() => import('./Expenses'))),
  r('tax', 'accounts', <Percent className={ic} />, lazy(() => import('./TaxReport'))),
  r('cheques', 'accounts', <ScrollText className={ic} />, lazy(() => import('./ChequeReport'))),
  r('loans', 'accounts', <HandCoins className={ic} />, lazy(() => import('./LoanReport'))),
  r('capital', 'accounts', <PiggyBank className={ic} />, lazy(() => import('./CapitalAccount')), { perm: 'profit' }),

  r('stock', 'stock', <Package className={ic} />, lazy(() => import('./StockSummary'))),
  r('itemprofit', 'stock', <Coins className={ic} />, lazy(() => import('./ItemProfit')), { perm: 'profit' }),
  r('lowstock', 'stock', <PackageMinus className={ic} />, lazy(() => import('./LowStock'))),
  r('movement', 'stock', <ClipboardList className={ic} />, lazy(() => import('./StockMovement'))),
  r('expiry', 'stock', <CalendarClock className={ic} />, lazy(() => import('./Expiry')), { show: (s) => s.features.batches }),
]

export const REPORT_GROUPS: { key: ReportGroup; title: string; icon: ReactNode }[] = [
  { key: 'txns', title: 'rp_g_txns', icon: <FileBarChart className="size-4" /> },
  { key: 'parties', title: 'rp_g_parties', icon: <Users className="size-4" /> },
  { key: 'accounts', title: 'rp_g_accounts', icon: <Landmark className="size-4" /> },
  { key: 'stock', title: 'rp_g_stock', icon: <Package className="size-4" /> },
]

export const reportByKey = (key: string) => REPORTS.find((x) => x.key === key)
