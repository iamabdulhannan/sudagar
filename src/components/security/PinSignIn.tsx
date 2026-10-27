import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import type { AppUser } from '../../lib/types'
import { PinPad, type PinPadHandle } from './PinPad'
import { usePinAttempt } from './usePinAttempt'

const lastKey = (firmId: string) => `saudagar.lastUser.${firmId}`

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'

/** round badge with a person's initials */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cx('grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800', className)}>{initials(name)}</span>
}

/**
 * Pick a user and type their PIN. Used by the lock screen and by "confirm with PIN".
 * Wrong PINs shake the dots and count; after 5 the pad waits 30 seconds.
 */
export function PinSignIn({ firmId, users, onOk, keyboard = true }: {
  firmId: string
  /** people who may sign in here (active, with a PIN) */
  users: AppUser[]
  onOk: (u: AppUser) => void
  keyboard?: boolean
}) {
  const { t } = useI18n()
  const [userId, setUserId] = useState<string>(() => {
    let last: string | null = null
    try { last = localStorage.getItem(lastKey(firmId)) } catch { /* ignore */ }
    return users.find((u) => u.id === last)?.id ?? users[0]?.id ?? ''
  })
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)
  const pad = useRef<PinPadHandle>(null)
  const { verify, triesLeft, waiting, waitSeconds, fails } = usePinAttempt(firmId)
  const user = users.find((u) => u.id === userId) ?? users[0]

  useEffect(() => { if (user && user.id !== userId) setUserId(user.id) }, [user, userId])

  const pick = (id: string) => { setUserId(id); setPin(''); setWrong(false) }

  const submit = async () => {
    if (!user || busy || waiting) return
    setBusy(true)
    const ok = await verify(user, pin)
    setBusy(false)
    if (ok) {
      try { localStorage.setItem(lastKey(firmId), user.id) } catch { /* ignore */ }
      setPin('')
      onOk(user)
      return
    }
    setPin('')
    setWrong(true)
    pad.current?.shake()
  }

  return (
    <div>
      {users.length > 1 && (
        <div className="mb-5">
          <div className="mb-2 text-center text-xs font-medium text-stone-500">{t('lk_who')}</div>
          <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={t('lk_who')}>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={u.id === user?.id}
                onClick={() => pick(u.id)}
                className={cx(
                  'flex items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm transition-colors cursor-pointer',
                  u.id === user?.id ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800' : 'border-stone-200 text-stone-700 hover:bg-stone-50',
                )}
              >
                <Avatar name={u.name} className="size-7 text-xs" />
                <span className="max-w-32 truncate">{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {user && (
        <p className="mb-4 text-center text-sm text-stone-600">
          {t('lk_enterPin', { name: user.name })} <span className="text-stone-400">({t('role_' + user.role)})</span>
        </p>
      )}
      <PinPad ref={pad} value={pin} onChange={(v) => { setPin(v); setWrong(false) }} onSubmit={submit} disabled={busy || waiting || !user} keyboard={keyboard} />
      <div className="mt-4 min-h-10 text-center text-sm" aria-live="polite">
        {waiting
          ? <span className="font-medium text-red-700">{t('lk_wait', { n: waitSeconds })}</span>
          : wrong
            ? <span className="font-medium text-red-700">{t('lk_wrong')} {fails > 0 && t('lk_triesLeft', { n: triesLeft })}</span>
            : <span className="text-stone-400">{t('lk_hint')}</span>}
      </div>
    </div>
  )
}
