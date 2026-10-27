import { Copy, Share2, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Empty, Field, Select, useUi } from '../ui'
import { useAuth } from '../../lib/auth'
import { cloudErrorKey, createInvite, deleteInvite, listInvites, listMembers, removeMember, setMemberRole, type Invite, type Member } from '../../lib/cloud'
import { useData, useFirmCtx } from '../../lib/data'
import { deleteFirm } from '../../lib/db'
import { fmtDate } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Role } from '../../lib/types'

const ROLES: Role[] = ['owner', 'manager', 'accountant', 'cashier']

/** people with their own account in this business, and invite codes for new ones */
export function TeamSettings() {
  const { t } = useI18n()
  const { firm } = useData()
  const { user } = useAuth()
  const { firms, switchFirm } = useFirmCtx()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [role, setRole] = useState<Role>('cashier')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<Invite | null>(null)
  const isOwner = firm.role === 'owner'
  const canInvite = firm.role === 'owner' || firm.role === 'manager'

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(firm.id))
      if (canInvite) setInvites((await listInvites(firm.id)).filter((i) => !i.used_by && new Date(i.expires_at) > new Date()))
    } catch (e) { toast(t(cloudErrorKey(e)), 'error'); setMembers([]) }
  }, [firm.id, canInvite, t, toast])
  useEffect(() => { void load() }, [load])

  if (!firm.accountId) return <Card><Empty title={t('tm_title')} text={t('tm_cloudOnly')} /></Card>

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await load() } catch (e) { toast(t(cloudErrorKey(e)), 'error') }
  }
  const signupUrl = (code: string) => `${location.origin}/signup?invite=${code}`
  const share = (inv: Invite) => {
    const text = t('tm_shareText', { business: firm.name, url: signupUrl(inv.code), code: inv.code })
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <div className="space-y-5">
      <Card title={t('tm_title')}>
        <p className="mb-3 text-sm text-stone-500">{t('tm_text')}</p>
        {members === null ? (
          <div className="py-6 text-center text-sm text-stone-400">{t('loading')}…</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {members.map((m) => {
              const me = m.user_id === user?.id
              return (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">{(m.full_name || m.email).slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">{m.full_name || m.email} {me && <Badge>{t('tm_you')}</Badge>}</span>
                    <span className="block truncate text-xs text-stone-500" dir="ltr">{m.email}</span>
                  </span>
                  {isOwner && !me ? (
                    <Select value={m.role} onChange={(e) => void act(() => setMemberRole(firm.id, m.user_id, e.target.value as Role))} className="h-9 w-auto" aria-label={t('tm_changeRole')}>
                      {ROLES.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
                    </Select>
                  ) : <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{t('role_' + m.role)}</Badge>}
                  {isOwner && !me && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (await confirm({ title: t('tm_removeQ', { name: m.full_name || m.email }), text: t('tm_removeText'), danger: true, okLabel: t('tm_remove') })) void act(() => removeMember(firm.id, m.user_id))
                    }}><Trash2 className="size-4" />{t('tm_remove')}</Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!isOwner && <p className="mt-2 text-xs text-stone-500">{t('tm_ownerOnly')}</p>}
      </Card>

      {canInvite && (
        <Card title={<span className="flex items-center gap-2"><UserPlus className="size-4 text-brand-700" />{t('tm_invite')}</span>}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('tm_inviteRole')} className="w-48">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
              </Select>
            </Field>
            <Button loading={busy} onClick={async () => {
              setBusy(true)
              try { const inv = await createInvite(firm.id, role); setFresh(inv); await load() } catch (e) { toast(t(cloudErrorKey(e)), 'error') } finally { setBusy(false) }
            }}>{t('tm_makeCode')}</Button>
          </div>
          {fresh && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="text-sm font-semibold text-brand-900">{t('tm_codeReady')}</div>
              <div className="num mt-2 text-3xl font-bold tracking-[0.3em] text-brand-800" dir="ltr">{fresh.code}</div>
              <p className="mt-1 text-xs text-brand-800">{t('tm_codeText')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(fresh.code); toast(t('copied')) }}><Copy className="size-4" />{t('copy')}</Button>
                <Button size="sm" variant="success" onClick={() => share(fresh)}><Share2 className="size-4" />{t('tm_share')}</Button>
              </div>
            </div>
          )}
          {invites.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{t('tm_pending')}</h3>
              <ul className="divide-y divide-stone-100 text-sm">
                {invites.map((i) => (
                  <li key={i.code} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="num font-semibold tracking-widest" dir="ltr">{i.code}</span>
                    <Badge>{t('role_' + i.role)}</Badge>
                    <span className="flex-1 text-xs text-stone-500">{t('tm_expires', { date: fmtDate(i.expires_at.slice(0, 10)) })}</span>
                    <Button size="xs" variant="ghost" onClick={() => share(i)}><Share2 className="size-3.5" /></Button>
                    <Button size="xs" variant="ghost" onClick={() => void act(() => deleteInvite(i.code))}>{t('tm_revoke')}</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {!isOwner && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">{t('tm_removeText')}</p>
            <Button variant="danger" onClick={async () => {
              if (!user || !(await confirm({ title: t('tm_leaveQ', { business: firm.name }), danger: true, okLabel: t('tm_leave') }))) return
              try {
                await removeMember(firm.id, user.id)
                await deleteFirm(firm.id)
                const next = firms.find((f) => f.id !== firm.id)
                await switchFirm(next?.id ?? null)
                navigate('/welcome', { replace: true })
              } catch (e) { toast(t(cloudErrorKey(e)), 'error') }
            }}>{t('tm_leave')}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
