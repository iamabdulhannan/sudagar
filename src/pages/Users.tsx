import { KeyRound, Pencil, Plus, ShieldCheck, UserCheck, UserX, Users as UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppLockToggle } from '../components/settings/SecuritySettings'
import { Avatar } from '../components/security/PinSignIn'
import { RequirePerm } from '../components/security/RequirePerm'
import { RoleTable } from '../components/security/RoleTable'
import { UserFormModal, type UserFormMode } from '../components/security/UserFormModal'
import { Badge, Button, Card, Empty, IconButton, PageHeader, useUi } from '../components/ui'
import { useAccess } from '../lib/access'
import { useData } from '../lib/data'
import { fmtDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import type { AppUser } from '../lib/types'
import { ROLES, saveUser, UserError } from '../lib/users'

export default function Users() {
  return <RequirePerm perm="users"><UsersPage /></RequirePerm>
}

function UsersPage() {
  const { t } = useI18n()
  const { users, db, firm } = useData()
  const { user: me } = useAccess()
  const { toast, confirm } = useUi()
  const [form, setForm] = useState<{ mode: UserFormMode; user?: AppUser } | null>(null)
  const list = useMemo(
    () => [...users].sort((a, b) => Number(b.active) - Number(a.active) || ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name)),
    [users],
  )
  const first = users.length === 0

  const setActive = async (u: AppUser, active: boolean) => {
    if (!active && me?.id === u.id) { toast(t('us_errSelf'), 'error'); return }
    if (!active && !(await confirm({ title: t('us_deactivate'), text: t('us_deactivateAsk', { name: u.name }), danger: true, okLabel: t('us_deactivate') }))) return
    try {
      await saveUser(db, firm.id, { id: u.id, name: u.name, role: u.role, active })
      toast(t('saved'))
    } catch (e) {
      toast(e instanceof UserError ? t(e.key) : String(e), 'error')
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title={t('navUsers')}
        subtitle={t('us_subtitle')}
        actions={<Button onClick={() => setForm({ mode: 'add' })}><Plus className="size-4" />{first ? t('us_addOwner') : t('us_add')}</Button>}
      />

      <Card>
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <AppLockToggle />
          </div>
        </div>
      </Card>

      <Card title={t('us_people')} padded={false}>
        {first ? (
          <Empty
            icon={<UsersIcon className="size-7" />}
            title={t('us_none')}
            text={t('us_noneText')}
            action={<Button onClick={() => setForm({ mode: 'add' })}><Plus className="size-4" />{t('us_addOwner')}</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('name')}</th><th>{t('us_role')}</th><th>{t('status')}</th><th>{t('us_added')}</th><th className="r">{t('actions')}</th></tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className={u.active ? '' : 'text-stone-400'}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={u.name} className="size-8 text-xs" />
                        <span className="font-medium">{u.name}</span>
                        {me?.id === u.id && <Badge tone="brand">{t('us_you')}</Badge>}
                      </span>
                    </td>
                    <td><Badge tone={u.role === 'owner' ? 'warn' : 'neutral'}>{t('role_' + u.role)}</Badge></td>
                    <td>{u.active ? <Badge tone="good">{t('active')}</Badge> : <Badge>{t('inactive')}</Badge>}</td>
                    <td className="num whitespace-nowrap text-stone-500">{fmtDateTime(u.createdAt)}</td>
                    <td className="r">
                      <span className="inline-flex gap-0.5">
                        <IconButton label={t('edit')} onClick={() => setForm({ mode: 'edit', user: u })}><Pencil className="size-4" /></IconButton>
                        <IconButton label={t('us_changePin')} onClick={() => setForm({ mode: 'pin', user: u })}><KeyRound className="size-4" /></IconButton>
                        {u.active
                          ? <IconButton label={t('us_deactivate')} onClick={() => setActive(u, false)}><UserX className="size-4" /></IconButton>
                          : <IconButton label={t('us_activate')} onClick={() => setActive(u, true)}><UserCheck className="size-4" /></IconButton>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('us_roles')} padded={false}>
        <p className="px-4 pt-3 text-sm text-stone-500">{t('us_rolesText')}</p>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r} className="rounded-xl border border-stone-200 p-3">
              <div className="font-semibold text-stone-900">{t('role_' + r)}</div>
              <p className="mt-1 text-xs text-stone-500">{t('roled_' + r)}</p>
            </div>
          ))}
        </div>
        <RoleTable />
      </Card>

      <UserFormModal open={!!form} mode={form?.mode ?? 'add'} user={form?.user} firstUser={first && form?.mode === 'add'} onClose={() => setForm(null)} />
    </div>
  )
}
