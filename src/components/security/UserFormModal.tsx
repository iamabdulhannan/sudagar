import { useEffect, useState } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { AppUser, Role } from '../../lib/types'
import { PIN_MAX, PIN_MIN, ROLES, saveUser, UserError, validPin } from '../../lib/users'
import { Button, Field, Input, Modal, Select, Toggle, useUi } from '../ui'
import { RoleHint } from './RoleTable'

export type UserFormMode = 'add' | 'edit' | 'pin'

/** a PIN box: digits only, never shown */
function PinInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Input
      type="password"
      inputMode="numeric"
      autoComplete="new-password"
      autoFocus={autoFocus}
      maxLength={PIN_MAX}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
      className="num tracking-[0.4em]"
      dir="ltr"
    />
  )
}

/** add a user, edit name / role / active, or set a new PIN */
export function UserFormModal({ open, mode, user, onClose, firstUser }: {
  open: boolean
  mode: UserFormMode
  user?: AppUser
  onClose: () => void
  /** no users yet: the first one is always an owner */
  firstUser?: boolean
}) {
  const { t } = useI18n()
  const { db, firm } = useData()
  const { toast } = useUi()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('cashier')
  const [active, setActive] = useState(true)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(user?.name ?? (firstUser ? firm.ownerName ?? '' : ''))
    setRole(user?.role ?? (firstUser ? 'owner' : 'cashier'))
    setActive(user?.active ?? true)
    setPin(''); setPin2(''); setError('')
  }, [open, user, firstUser, firm.ownerName])

  const askPin = mode !== 'edit'
  const pinProblem = askPin && pin && !validPin(pin) ? t('us_errPin') : ''
  const matchProblem = askPin && pin2 && pin !== pin2 ? t('us_errPinMatch') : ''
  const ready = (mode === 'pin' || name.trim()) && (!askPin || (validPin(pin) && pin === pin2))

  const save = async () => {
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      await saveUser(db, firm.id, {
        id: user?.id,
        name: mode === 'pin' ? user!.name : name,
        role: mode === 'pin' ? user!.role : role,
        active: mode === 'pin' ? user!.active : active,
        pin: askPin ? pin : undefined,
      })
      toast(mode === 'pin' ? t('us_pinChanged') : t('saved'))
      onClose()
    } catch (e) {
      setError(e instanceof UserError ? t(e.key) : String(e))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'add' ? t('us_add') : mode === 'pin' ? t('us_changePinFor', { name: user?.name ?? '' }) : t('us_edit')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={busy} disabled={!ready}>{t('save')}</Button>
      </>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        {mode !== 'pin' && (
          <>
            <Field label={t('name')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} />
            </Field>
            <Field label={t('us_role')} hint={<RoleHint role={role} />}>
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={firstUser}>
                {ROLES.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
              </Select>
            </Field>
            {firstUser && <p className="text-xs text-stone-500">{t('us_firstOwner')}</p>}
          </>
        )}
        {askPin && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('us_pin')} hint={t('us_pinHint', { min: PIN_MIN, max: PIN_MAX })} error={pinProblem}>
              <PinInput value={pin} onChange={setPin} autoFocus={mode === 'pin'} />
            </Field>
            <Field label={t('us_pinAgain')} error={matchProblem}>
              <PinInput value={pin2} onChange={setPin2} />
            </Field>
          </div>
        )}
        {mode === 'edit' && <Toggle checked={active} onChange={setActive} label={t('active')} hint={t('us_activeHint')} />}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
