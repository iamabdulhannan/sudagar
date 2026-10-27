import { ShieldOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAccess, type Perm } from '../../lib/access'
import { useI18n } from '../../lib/i18n'
import { Button, Card, Empty } from '../ui'

/** "you cannot open this" card */
export function NoAccess() {
  const { t } = useI18n()
  const { user, lock } = useAccess()
  return (
    <Card>
      <Empty
        icon={<ShieldOff className="size-7" />}
        title={t('lk_noAccess')}
        text={user ? t('lk_noAccessText', { name: user.name, role: t('role_' + user.role) }) : undefined}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/dashboard"><Button variant="secondary">{t('navDashboard')}</Button></Link>
            {user && <Button variant="ghost" onClick={lock}>{t('lk_switchUser')}</Button>}
          </div>
        }
      />
    </Card>
  )
}

/** shows its children only when the signed-in user has every permission listed */
export function RequirePerm({ perm, children }: { perm: Perm | Perm[]; children: ReactNode }) {
  const { can } = useAccess()
  const ok = (Array.isArray(perm) ? perm : [perm]).every(can)
  return ok ? <>{children}</> : <NoAccess />
}
