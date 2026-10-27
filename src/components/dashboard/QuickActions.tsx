import { ArrowDownLeft, ArrowUpRight, Package, Receipt, ScanBarcode, ShoppingCart, UserPlus, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { txnNewPath } from '../../lib/paths'

/** one-tap shortcuts to the most used screens */
export function QuickActions() {
  const { t } = useI18n()
  const ic = 'size-5'
  const actions: { to: string; label: string; icon: ReactNode; tone: string }[] = [
    { to: txnNewPath('sale'), label: t('newSale'), icon: <Receipt className={ic} />, tone: 'bg-brand-50 text-brand-700' },
    { to: '/pos', label: t('navPos'), icon: <ScanBarcode className={ic} />, tone: 'bg-brand-50 text-brand-700' },
    { to: txnNewPath('purchase'), label: t('newPurchase'), icon: <ShoppingCart className={ic} />, tone: 'bg-amber-50 text-amber-700' },
    { to: txnNewPath('payment_in'), label: t('tt_payment_in'), icon: <ArrowDownLeft className={ic} />, tone: 'bg-emerald-50 text-emerald-700' },
    { to: txnNewPath('payment_out'), label: t('tt_payment_out'), icon: <ArrowUpRight className={ic} />, tone: 'bg-red-50 text-red-700' },
    { to: txnNewPath('expense'), label: t('tt_expense'), icon: <Wallet className={ic} />, tone: 'bg-red-50 text-red-700' },
    { to: '/items', label: t('dash_addItem'), icon: <Package className={ic} />, tone: 'bg-sky-100 text-sky-800' },
    { to: '/parties', label: t('dash_addParty'), icon: <UserPlus className={ic} />, tone: 'bg-sky-100 text-sky-800' },
  ]
  return (
    <nav aria-label={t('dash_quickActions')} className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 bg-surface p-2.5 text-center shadow-sm transition hover:border-brand-500 hover:shadow focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <span className={`grid size-10 place-items-center rounded-lg ${a.tone}`}>{a.icon}</span>
          <span className="text-xs font-medium leading-tight text-stone-700">{a.label}</span>
        </Link>
      ))}
    </nav>
  )
}
