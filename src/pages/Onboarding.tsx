import { Building2, ChevronRight, CloudOff, KeyRound, Languages, LogOut, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CreateBusinessForm, type NewBusiness } from '../components/setup/CreateBusinessForm'
import { Button, Card, Field, Input, useUi } from '../components/ui'
import { useAuth } from '../lib/auth'
import { acceptInvite, checkInvite, cloudErrorKey, createCloudBusiness, downloadBusiness, refreshAccountBusinesses } from '../lib/cloud'
import { useFirmCtx } from '../lib/data'
import { createFirm, deleteFirm, firmDb, meta, seedFirm } from '../lib/db'
import { useI18n } from '../lib/i18n'
import { cloudConfigured } from '../lib/supabase'
import type { Firm, Role } from '../lib/types'
import { safeNext } from './auth/SignIn'

/**
 * After sign-in: pick one of the account's businesses, create a new one, join one with an
 * invite code, or add businesses made on this device before accounts to the account.
 */
export default function Onboarding() {
  const { t, lang, setLang } = useI18n()
  const { session, name: accountName, signOut } = useAuth()
  const { firms, unclaimed, switchFirm } = useFirmCtx()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next')) || '/dashboard'
  const adding = !!params.get('add')
  const [loaded, setLoaded] = useState(!cloudConfigured)
  const [offline, setOffline] = useState(false)
  const [opening, setOpening] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(adding)
  const accountId = session?.user.id

  const open = useCallback(async (f: Firm) => {
    setOpening(f.id)
    try {
      const db = firmDb(f.id)
      if (cloudConfigured && accountId && !(await db.syncMeta.get('lastSync'))) await downloadBusiness(f.id)
      // a business whose owner has not synced yet still opens with default settings
      if (!(await db.settings.get('settings'))) await seedFirm(db, f.businessType)
      await switchFirm(f.id)
      navigate(next, { replace: true })
    } catch (e) {
      toast(t(cloudErrorKey(e)), 'error')
      setOpening('')
    }
  }, [accountId, navigate, next, switchFirm, t, toast])

  // fetch the account's businesses; with exactly one, open it straight away
  useEffect(() => {
    if (!cloudConfigured || !accountId) return
    let alive = true
    refreshAccountBusinesses(accountId)
      .then((list) => {
        if (!alive) return
        setLoaded(true)
        if (!adding && !params.get('invite') && list.length === 1) void open(list[0])
      })
      .catch(() => { if (alive) { setOffline(true); setLoaded(true) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const create = async (b: NewBusiness) => {
    setCreating(true)
    try {
      const firm = await createFirm({ ...b, ...(accountId ? { accountId, role: 'owner' as Role } : {}) })
      if (cloudConfigured && accountId) {
        // offline is fine: the sync registers the business later
        try {
          await createCloudBusiness(firm)
          await firmDb(firm.id).syncMeta.put({ key: 'registered', value: true })
          await downloadBusiness(firm.id)
        } catch { /* will retry in the background */ }
      }
      await switchFirm(firm.id)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      toast(String(e), 'error')
      setCreating(false)
    }
  }

  const claim = async (f: Firm) => {
    if (!accountId) return
    try {
      await meta.firms.update(f.id, { accountId, role: 'owner' })
      await createCloudBusiness({ ...f, accountId, role: 'owner' })
      await firmDb(f.id).syncMeta.put({ key: 'registered', value: true })
      await downloadBusiness(f.id)
      toast(t('bs_claimed', { name: f.name }))
    } catch (e) {
      toast(t(cloudErrorKey(e)), 'error')
    }
  }

  const removeLocal = async (f: Firm) => {
    if (!(await confirm({ title: t('bs_deleteLocal'), text: `${f.name}: ${t('cannotUndo')}`, danger: true, okLabel: t('delete') }))) return
    await deleteFirm(f.id)
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-stone-200 bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="text-lg font-bold text-stone-900">{t('appName')}</span>
          </Link>
          <div className="flex-1" />
          <button type="button" onClick={() => setLang(lang === 'en' ? 'ur' : 'en')} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer">
            <Languages className="size-4" />{lang === 'en' ? 'اردو' : 'English'}
          </button>
          {session && (
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/signin', { replace: true }) }}>
              <LogOut className="size-4" />{t('au_signOut')}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{session ? t('bs_title') : t('obTitle')}</h1>
          {session && <p className="mt-1 text-sm text-stone-500">{accountName} · <span dir="ltr">{t('bs_signedInAs', { email: session.user.email ?? '' })}</span></p>}
        </div>

        {offline && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <CloudOff className="size-4 shrink-0" />{t('bs_offline')}
          </div>
        )}

        {!loaded ? (
          <div className="grid place-items-center py-16"><div className="size-9 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" /></div>
        ) : (
          <>
            {firms.length > 0 ? (
              <Card padded={false}>
                <ul className="divide-y divide-stone-100">
                  {firms.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => void open(f)}
                        disabled={!!opening}
                        className="flex w-full items-center gap-4 px-4 py-4 text-start hover:bg-stone-50 disabled:opacity-60 cursor-pointer"
                      >
                        {f.logo
                          ? <img src={f.logo} alt="" className="size-11 rounded-xl border border-stone-200 bg-white object-contain" />
                          : <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-400 text-lg font-bold text-stone-900">{f.name.slice(0, 1).toUpperCase()}</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-stone-900">{f.name}</span>
                          <span className="block truncate text-sm text-stone-500">
                            {t('bt_' + f.businessType)}{f.role ? ` · ${t('bs_role', { role: t('role_' + f.role) })}` : ''}
                          </span>
                        </span>
                        {opening === f.id
                          ? <span className="text-sm text-stone-500">{t('bs_downloading')}…</span>
                          : <ChevronRight className="size-5 text-stone-400 rtl:rotate-180" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <p className="text-sm text-stone-600">{t('bs_none')}</p>
            )}

            <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
              <Card
                title={<span className="flex items-center gap-2"><Building2 className="size-4 text-brand-700" />{t('bs_create')}</span>}
                actions={!showCreate && firms.length > 0 ? <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="size-4" />{t('new')}</Button> : undefined}
              >
                {showCreate || firms.length === 0
                  ? <CreateBusinessForm onCreate={create} busy={creating} defaultOwner={accountName} />
                  : <p className="text-sm text-stone-500">{t('obText')}</p>}
              </Card>
              {cloudConfigured && session && <JoinCard initial={params.get('invite') ?? ''} onJoined={(id) => {
                void refreshAccountBusinesses(session.user.id).then((list) => { const f = list.find((x) => x.id === id); if (f) void open(f) })
              }} />}
            </div>

            {cloudConfigured && session && unclaimed.length > 0 && (
              <Card title={t('bs_unclaimed')}>
                <p className="mb-3 text-sm text-stone-500">{t('bs_unclaimedText')}</p>
                <ul className="divide-y divide-stone-100">
                  {unclaimed.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{f.name}</span>
                      <Button size="sm" onClick={() => void claim(f)}>{t('bs_claim')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeLocal(f)}><Trash2 className="size-4" />{t('bs_deleteLocal')}</Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function JoinCard({ initial, onJoined }: { initial: string; onJoined: (businessId: string) => void }) {
  const { t } = useI18n()
  const { toast } = useUi()
  const [code, setCode] = useState(initial.toUpperCase())
  const [found, setFound] = useState<{ business_name: string; role: Role } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    setError(''); setFound(null); setBusy(true)
    try {
      const r = await checkInvite(code)
      if (r) setFound(r)
      else setError(t('cl_INVALID_INVITE'))
    } catch (e) { setError(t(cloudErrorKey(e))) } finally { setBusy(false) }
  }
  // a code from the invite link is checked at once
  useEffect(() => { if (initial) void check() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setBusy(true)
    try {
      const id = await acceptInvite(code)
      toast(t('bs_joined', { business: found?.business_name ?? '' }))
      onJoined(id)
    } catch (e) { setError(t(cloudErrorKey(e))); setBusy(false) }
  }

  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="size-4 text-brand-700" />{t('bs_join')}</span>}>
      <p className="mb-3 text-sm text-stone-500">{t('bs_joinText')}</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void (found ? join() : check()) }}>
        <Field label={t('bs_code')} error={error}>
          <Input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)); setFound(null) }} placeholder={t('bs_codePh')} dir="ltr" className="num tracking-widest" />
        </Field>
        {found
          ? <Button type="submit" className="w-full" loading={busy}>{t('bs_joinAs', { business: found.business_name, role: t('role_' + found.role) })}</Button>
          : <Button type="submit" variant="secondary" className="w-full" loading={busy} disabled={code.length < 8}>{t('bs_check')}</Button>}
      </form>
    </Card>
  )
}
