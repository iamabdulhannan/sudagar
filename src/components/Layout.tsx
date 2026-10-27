import {
  ArrowDownToLine, BarChart3, Banknote, Building2, ChevronDown, Contact, FileText, Home, Languages,
  Menu, Moon, Package, Plus, Receipt, ScanBarcode, Settings as SettingsIcon, ShoppingCart, Sun, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cx } from '../lib/cx'
import { AccountMenu } from './AccountMenu'
import { LockButton } from './security/LockButton'
import { useAccess } from '../lib/access'
import { useData, useFirmCtx } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { txnListPath, txnNewPath } from '../lib/paths'
import { TXN_META } from '../lib/txn'
import type { TxnType } from '../lib/types'

interface NavLeaf { to: string; label: string; type?: TxnType }
interface NavGroup { key: string; label: string; icon: ReactNode; to?: string; children?: NavLeaf[] }


function useNav(): NavGroup[] {
  const { t } = useI18n()
  const { settings } = useData()
  const { can } = useAccess()
  const f = settings.features
  const leaf = (type: TxnType): NavLeaf => ({ to: txnListPath(type), label: t('tp_' + type), type })
  const page = (to: string, label: string): NavLeaf => ({ to, label })
  const groups: (NavGroup | false)[] = [
    { key: 'home', label: t('navDashboard'), icon: <Home className="size-[18px]" />, to: '/dashboard' },
    can('sell') && { key: 'pos', label: t('navPos'), icon: <ScanBarcode className="size-[18px]" />, to: '/pos' },
    can('parties') && {
      key: 'parties', label: t('navParties'), icon: <Contact className="size-[18px]" />,
      children: [page('/parties', t('navParties')), page('/reminders', t('navReminders')), ...(f.loyalty ? [page('/loyalty', t('navLoyalty'))] : [])],
    },
    can('items') && {
      key: 'stock', label: t('navStock'), icon: <Package className="size-[18px]" />,
      children: [
        page('/items', t('navItems')),
        ...(f.godowns ? [page('/godowns', t('navGodowns'))] : []),
        ...(f.manufacturing ? [page('/manufacturing', t('navManufacturing'))] : []),
        page('/catalogue', t('navCatalogue')),
      ],
    },
    can('sell') && {
      key: 'sale', label: t('navSale'), icon: <Receipt className="size-[18px]" />,
      children: [
        leaf('sale'), leaf('payment_in'), leaf('sale_return'),
        ...(f.estimates ? [leaf('estimate')] : []),
        ...(f.orders ? [leaf('sale_order')] : []),
        ...(f.challans ? [leaf('delivery_challan')] : []),
      ],
    },
    can('purchase') && {
      key: 'purchase', label: t('navPurchase'), icon: <ShoppingCart className="size-[18px]" />,
      children: [leaf('purchase'), leaf('payment_out'), leaf('purchase_return'), ...(f.orders ? [leaf('purchase_order')] : []), leaf('expense')],
    },
    can('money') && {
      key: 'money', label: t('navMoney'), icon: <Banknote className="size-[18px]" />,
      children: [page('/cash-bank', t('navCashBank')), page('/shifts', t('sh_shifts')), page('/cheques', t('navCheques')), page('/loans', t('navLoans')), leaf('other_income'), leaf('capital_in'), leaf('drawing')],
    },
    can('reports') && { key: 'reports', label: t('navReports'), icon: <BarChart3 className="size-[18px]" />, to: '/reports' },
    {
      key: 'more', label: t('navMore'), icon: <SettingsIcon className="size-[18px]" />,
      children: [
        ...(can('settings') ? [page('/settings', t('navSettings'))] : []),
        ...(can('users') ? [page('/users', t('navUsers'))] : []),
        ...(can('backup') ? [page('/backup', t('navBackup'))] : []),
        ...(can('delete') ? [page('/recycle-bin', t('navBin'))] : []),
      ],
    },
  ]
  return groups.filter((g): g is NavGroup => !!g && (!g.children || g.children.length > 0))
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  const { pathname } = useLocation()
  // open the group of the current page (and Sale, the most used)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    sale: true,
    ...Object.fromEntries(nav.filter((g) => g.children?.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'))).map((g) => [g.key, true])),
  }))
  const itemCls = (active: boolean) => cx(
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
    active ? 'bg-[#0f766e] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white',
  )
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {nav.map((g) => g.to ? (
        <NavLink key={g.key} to={g.to} end={g.to === '/dashboard'} onClick={onNavigate} className={({ isActive }) => itemCls(isActive)}>
          {g.icon}<span className="truncate">{g.label}</span>
        </NavLink>
      ) : (
        <div key={g.key}>
          <button type="button" className={itemCls(false)} onClick={() => setOpenGroups((o) => ({ ...o, [g.key]: !o[g.key] }))}>
            {g.icon}<span className="flex-1 truncate text-start">{g.label}</span>
            <ChevronDown className={cx('size-4 transition-transform', openGroups[g.key] && 'rotate-180')} />
          </button>
          {openGroups[g.key] && (
            <div className="my-0.5 ms-5 space-y-0.5 border-s border-white/10 ps-3">
              {g.children!.map((c) => (
                <NavLink
                  key={c.to}
                  to={c.to}
                  onClick={onNavigate}
                  className={({ isActive }) => cx(
                    'block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                    isActive || (c.type && pathname.startsWith(`/txn/${TXN_META[c.type].slug}/`)) ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white',
                  )}
                >
                  {c.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}

function FirmSwitcher() {
  const { firms, firm, switchFirm } = useFirmCtx()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2.5 text-start hover:bg-white/10 cursor-pointer"
      >
        {firm?.logo
          ? <img src={firm.logo} alt="" className="size-9 rounded-lg bg-white object-contain" />
          : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-400 text-sm font-bold text-stone-900">{firm?.name.slice(0, 1).toUpperCase()}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{firm?.name}</span>
          <span className="block truncate text-xs text-white/55">{t('bt_' + firm?.businessType)}</span>
        </span>
        <ChevronDown className="size-4 text-white/55" />
      </button>
      {open && (
        <div className="absolute inset-x-3 top-full z-30 mt-1 rounded-xl border border-white/10 bg-[#1c1917] p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <div className="px-2 py-1.5 text-xs font-medium text-white/55">{t('switchBusiness')}</div>
          {firms.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { switchFirm(f.id); setOpen(false); navigate('/dashboard') }}
              className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm cursor-pointer', f.id === firm?.id ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5')}
            >
              <Building2 className="size-4 shrink-0" /><span className="truncate">{f.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/welcome?add=1') }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm text-amber-300 hover:bg-white/5 cursor-pointer"
          >
            <Plus className="size-4" />{t('addBusiness')}
          </button>
        </div>
      )}
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t, lang, setLang } = useI18n()
  const { resolved, toggle } = useTheme()
  const navigate = useNavigate()
  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-stone-200 bg-surface/95 px-3 backdrop-blur sm:px-5">
      <button type="button" onClick={onMenu} className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 lg:hidden" aria-label="Menu">
        <Menu className="size-5" />
      </button>
      <div className="flex-1" />
      <LockButton />
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
        title={t('language')}
      >
        <Languages className="size-4" />{lang === 'en' ? 'اردو' : 'English'}
      </button>
      <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer" aria-label={t('theme')} title={t('theme')}>
        {resolved === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
      <button
        type="button"
        onClick={() => navigate(txnNewPath('purchase'))}
        className="hidden h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-surface px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:flex cursor-pointer"
      >
        <ArrowDownToLine className="size-4" />{t('newPurchase')}
      </button>
      <button
        type="button"
        onClick={() => navigate(txnNewPath('sale'))}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover cursor-pointer"
      >
        <FileText className="size-4" />{t('newSale')}
      </button>
      <AccountMenu />
    </header>
  )
}

export function Layout() {
  const { t } = useI18n()
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setDrawer(false), [pathname])

  const brand = (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-5 pt-4">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight text-white">{t('appName')}</span>
    </Link>
  )

  return (
    <div className="flex min-h-dvh">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[#0c0a09] lg:flex">
        {brand}
        <FirmSwitcher />
        <Sidebar />
      </aside>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-[#0c0a09] shadow-xl">
            <div className="flex items-center justify-between pe-3">
              {brand}
              <button type="button" onClick={() => setDrawer(false)} className="mt-4 rounded-lg p-2 text-white/55 hover:bg-white/10" aria-label={t('close')}>
                <X className="size-5" />
              </button>
            </div>
            <FirmSwitcher />
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
