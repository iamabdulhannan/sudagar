import { Check, Minus } from 'lucide-react'
import { PERMS, ROLE_PERMS } from '../../lib/access'
import { useI18n } from '../../lib/i18n'
import { ROLES } from '../../lib/users'

/** what each role can do, one row per permission */
export function RoleTable() {
  const { t } = useI18n()
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('us_permission')}</th>
            {ROLES.map((r) => <th key={r} className="text-center">{t('role_' + r)}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERMS.map((p) => (
            <tr key={p}>
              <td>
                <span className="block font-medium text-stone-800">{t('perm_' + p)}</span>
                <span className="block text-xs text-stone-500">{t('permd_' + p)}</span>
              </td>
              {ROLES.map((r) => (
                <td key={r} className="text-center">
                  {ROLE_PERMS[r].has(p)
                    ? <Check className="mx-auto size-4 text-emerald-600" aria-label={t('yes')} />
                    : <Minus className="mx-auto size-4 text-stone-300" aria-label={t('no')} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** one line about a role, for pickers */
export function RoleHint({ role }: { role: string }) {
  const { t } = useI18n()
  return <span className="text-xs text-stone-500">{t('roled_' + role)}</span>
}
