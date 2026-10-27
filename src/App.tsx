import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { TXN_META, typeFromSlug } from './lib/txn'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { RequirePerm } from './components/security/RequirePerm'
import type { Perm } from './lib/access'
import { UiProvider } from './components/ui'
import { AccessProvider } from './lib/access'
import { AuthProvider, useAuth } from './lib/auth'
import { SyncProvider } from './lib/syncProvider'
import { cloudConfigured } from './lib/supabase'
import { DataProvider, FirmProvider, useFirmCtx } from './lib/data'
import { I18nProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'

const Pos = lazy(() => import('./pages/Pos'))
const TxnList = lazy(() => import('./pages/txn/TxnList'))
const TxnForm = lazy(() => import('./pages/txn/TxnForm'))
const TxnView = lazy(() => import('./pages/txn/TxnView'))
const Items = lazy(() => import('./pages/items/Items'))
const ItemDetail = lazy(() => import('./pages/items/ItemDetail'))
const Parties = lazy(() => import('./pages/parties/Parties'))
const PartyDetail = lazy(() => import('./pages/parties/PartyDetail'))
const CashBank = lazy(() => import('./pages/cash/CashBank'))
const AccountDetail = lazy(() => import('./pages/cash/AccountDetail'))
const Reports = lazy(() => import('./pages/reports/Reports'))
const Report = lazy(() => import('./pages/reports/Report'))
const Settings = lazy(() => import('./pages/Settings'))
const Backup = lazy(() => import('./pages/Backup'))
const Landing = lazy(() => import('./pages/Landing'))
const Godowns = lazy(() => import('./pages/stock/Godowns'))
const Manufacturing = lazy(() => import('./pages/stock/Manufacturing'))
const Catalogue = lazy(() => import('./pages/stock/Catalogue'))
const Cheques = lazy(() => import('./pages/money/Cheques'))
const Loans = lazy(() => import('./pages/money/Loans'))
const RecycleBin = lazy(() => import('./pages/RecycleBin'))
const Reminders = lazy(() => import('./pages/parties/Reminders'))
const Users = lazy(() => import('./pages/Users'))
const Loyalty = lazy(() => import('./pages/Loyalty'))
const Shifts = lazy(() => import('./pages/money/Shifts'))
const SignIn = lazy(() => import('./pages/auth/SignIn'))
const SignUp = lazy(() => import('./pages/auth/SignUp'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))

function Page({ children, perm }: { children: ReactNode; perm?: Perm | Perm[] }) {
  const page = <ErrorBoundary><Suspense fallback={<div className="py-20 text-center text-stone-400">…</div>}>{children}</Suspense></ErrorBoundary>
  return perm ? <RequirePerm perm={perm}>{page}</RequirePerm> : page
}

/** sale documents need "sell", purchase documents "purchase", the rest "money" */
function TxnGuard({ children }: { children: ReactNode }) {
  const { slug = '' } = useParams()
  const type = typeFromSlug(slug)
  const side = type ? TXN_META[type].side : 'money'
  const perm: Perm = side === 'sale' ? 'sell' : side === 'purchase' || type === 'expense' ? 'purchase' : side === 'stock' ? 'items' : 'money'
  return <RequirePerm perm={perm}>{children}</RequirePerm>
}

/** pages for signed-in users (when cloud accounts are set up) */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (cloudConfigured && !session) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

/** pages that need an open business */
function WithFirm({ children }: { children: ReactNode }) {
  const { firm } = useFirmCtx()
  const location = useLocation()
  if (!firm) return <Navigate to={`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <DataProvider><AccessProvider><SyncProvider>{children}</SyncProvider></AccessProvider></DataProvider>
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <UiProvider>
          <AuthProvider>
          <FirmProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Page><Landing /></Page>} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="/signin" element={<Page><SignIn /></Page>} />
                <Route path="/signup" element={<Page><SignUp /></Page>} />
                <Route path="/forgot-password" element={<Page><ForgotPassword /></Page>} />
                <Route path="/reset-password" element={<Page><ResetPassword /></Page>} />
                <Route path="/welcome" element={<RequireAuth><Onboarding /></RequireAuth>} />
                <Route path="/pos" element={<RequireAuth><WithFirm><Page perm="sell"><Pos /></Page></WithFirm></RequireAuth>} />
                <Route element={<RequireAuth><WithFirm><Layout /></WithFirm></RequireAuth>}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="txns/:slug" element={<Page><TxnGuard><TxnList /></TxnGuard></Page>} />
                  <Route path="txn/:slug/new" element={<Page><TxnGuard><TxnForm /></TxnGuard></Page>} />
                  <Route path="txn/:slug/:id" element={<Page><TxnGuard><TxnView /></TxnGuard></Page>} />
                  <Route path="txn/:slug/:id/edit" element={<Page><TxnGuard><TxnForm /></TxnGuard></Page>} />
                  <Route path="items" element={<Page perm="items"><Items /></Page>} />
                  <Route path="items/:id" element={<Page perm="items"><ItemDetail /></Page>} />
                  <Route path="parties" element={<Page perm="parties"><Parties /></Page>} />
                  <Route path="parties/:id" element={<Page perm="parties"><PartyDetail /></Page>} />
                  <Route path="cash-bank" element={<Page perm="money"><CashBank /></Page>} />
                  <Route path="cash-bank/:id" element={<Page perm="money"><AccountDetail /></Page>} />
                  <Route path="reports" element={<Page><Reports /></Page>} />
                  <Route path="reports/:key" element={<Page><Report /></Page>} />
                  <Route path="settings" element={<Page perm="settings"><Settings /></Page>} />
                  <Route path="backup" element={<Page><Backup /></Page>} />
                  <Route path="godowns" element={<Page perm="items"><Godowns /></Page>} />
                  <Route path="manufacturing" element={<Page perm="items"><Manufacturing /></Page>} />
                  <Route path="catalogue" element={<Page perm="items"><Catalogue /></Page>} />
                  <Route path="cheques" element={<Page perm="money"><Cheques /></Page>} />
                  <Route path="loans" element={<Page perm="money"><Loans /></Page>} />
                  <Route path="recycle-bin" element={<Page perm="delete"><RecycleBin /></Page>} />
                  <Route path="reminders" element={<Page><Reminders /></Page>} />
                  <Route path="users" element={<Page><Users /></Page>} />
                  <Route path="loyalty" element={<Page><Loyalty /></Page>} />
                  <Route path="shifts" element={<Page perm="sell"><Shifts /></Page>} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </FirmProvider>
          </AuthProvider>
        </UiProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
