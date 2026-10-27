import { Lock } from 'lucide-react'
import { useAccess } from '../../lib/access'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { Avatar } from './PinSignIn'

/**
 * The signed-in person and a Lock button, for the top bar. Renders nothing
 * when app lock is off. `compact` hides the name on small screens.
 */
export function LockButton({ className, compact = true }: { className?: string; compact?: boolean }) {
  const { t } = useI18n()
  const { user, lock, locking } = useAccess()
  if (!locking || !user) return null
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      <span className={cx('items-center gap-2 text-sm text-stone-700', compact ? 'hidden md:flex' : 'flex')} title={t('role_' + user.role)}>
        <Avatar name={user.name} className="size-7 text-xs" />
        <span className="max-w-32 truncate font-medium">{user.name}</span>
      </span>
      <button
        type="button"
        onClick={lock}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
        title={t('lk_lockNow')}
      >
        <Lock className="size-4" /><span className={cx(compact && 'hidden sm:inline')}>{t('lk_lock')}</span>
      </button>
    </div>
  )
}
