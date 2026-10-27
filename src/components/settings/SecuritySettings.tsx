import { CalendarCheck2, Lock, LockOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccess } from '../../lib/access'
import { updateSettings, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate } from '../../lib/format'
import { endOfLastMonth, endOfLastTaxYear } from '../../lib/reports'
import { useI18n } from '../../lib/i18n'
import { activeOwners, canSignIn } from '../../lib/users'
import { LockButton } from '../security/LockButton'
import { PinCheckModal } from '../security/PinCheckModal'
import { Badge, Button, Card, Field, Input, Select, Toggle, useUi } from '../ui'

const IDLE_CHOICES = [0, 5, 15, 30, 60]

/** Settings → Books & security: close the books up to a date, app lock and auto lock */
export function SecuritySettings() {
  const { t } = useI18n()
  return (
    <div className="space-y-5">
      <LockDateCard />
      <Card title={<span className="flex items-center gap-2"><Lock className="size-4" />{t('sec_appLock')}</span>}>
        <AppLockToggle />
        <AutoLockSelect />
        <div className="mt-3 border-t border-stone-100 pt-3"><LockButton compact={false} /></div>
      </Card>
    </div>
  )
}

function LockDateCard() {
  const { t } = useI18n()
  const { settings, db } = useData()
  const { toast } = useUi()
  const [date, setDate] = useState(settings.lockDate ?? '')
  useEffect(() => setDate(settings.lockDate ?? ''), [settings.lockDate])
  const dirty = (date || undefined) !== (settings.lockDate || undefined)
  const future = !!date && date > today()

  const save = async () => {
    await updateSettings(db, { lockDate: date || undefined })
    toast(date ? t('sec_closedUpTo', { date: fmtDate(date) }) : t('sec_opened'))
  }

  return (
    <Card title={<span className="flex items-center gap-2"><CalendarCheck2 className="size-4" />{t('sec_lockDate')}</span>}>
      <p className="mb-3 text-sm text-stone-500">{t('sec_lockDateText')}</p>
      <div className="mb-3">
        {settings.lockDate
          ? <Badge tone="warn"><Lock className="size-3" />{t('sec_closedUpTo', { date: fmtDate(settings.lockDate) })}</Badge>
          : <Badge tone="good"><LockOpen className="size-3" />{t('sec_allOpen')}</Badge>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('sec_closeUpTo')} error={future ? t('sec_future') : undefined}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </Field>
        <div className="flex flex-wrap gap-2 pb-0.5">
          <Button variant="secondary" size="sm" onClick={() => setDate(endOfLastMonth(today()))}>{t('sec_lastMonthEnd')}</Button>
          <Button variant="secondary" size="sm" onClick={() => setDate(endOfLastTaxYear(today()))}>{t('sec_taxYearEnd', { date: fmtDate(endOfLastTaxYear(today())) })}</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate('')} disabled={!date}>{t('sec_clear')}</Button>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save} disabled={!dirty}>{t('save')}</Button></div>
    </Card>
  )
}

/** app lock on / off; turning it on asks for an owner PIN first (so nobody locks themselves out) */
export function AppLockToggle() {
  const { t } = useI18n()
  const { settings, db, users } = useData()
  const { enter, locking, user } = useAccess()
  const { toast, confirm } = useUi()
  const [asking, setAsking] = useState(false)
  const owners = activeOwners(users).filter(canSignIn)
  const canTurnOn = owners.length > 0
  const on = settings.appLock && canTurnOn

  const change = async (v: boolean) => {
    if (v) { setAsking(true); return }
    if (locking && !(await confirm({ title: t('sec_turnOff'), text: t('sec_turnOffText') }))) return
    await updateSettings(db, { appLock: false })
    toast(t('sec_lockOff'))
  }

  return (
    <div>
      <div className={canTurnOn ? '' : 'pointer-events-none opacity-50'} aria-disabled={!canTurnOn}>
        <Toggle checked={on} onChange={change} label={t('sec_appLockLabel')} hint={t('sec_appLockHint')} />
      </div>
      {!canTurnOn && (
        <p className="mt-1 text-sm text-amber-700">
          {t('sec_needOwner')} <Link to="/users" className="font-medium text-brand-700 hover:underline">{t('navUsers')}</Link>
        </p>
      )}
      {on && user && <p className="mt-1 text-xs text-stone-500">{t('sec_signedInAs', { name: user.name, role: t('role_' + user.role) })}</p>}
      <PinCheckModal
        open={asking}
        onClose={() => setAsking(false)}
        title={t('sec_turnOn')}
        text={t('sec_turnOnText')}
        onOk={async (u) => {
          setAsking(false)
          enter(u.id)
          await updateSettings(db, { appLock: true })
          toast(t('sec_lockOn'))
        }}
      />
    </div>
  )
}

function AutoLockSelect() {
  const { t } = useI18n()
  const { settings, db } = useData()
  const { toast } = useUi()
  return (
    <Field label={t('sec_autoLock')} hint={t('sec_autoLockHint')} className="mt-3 max-w-xs">
      <Select
        value={String(settings.autoLockMinutes || 0)}
        disabled={!settings.appLock}
        onChange={async (e) => { await updateSettings(db, { autoLockMinutes: Number(e.target.value) }); toast(t('setSaved')) }}
      >
        {IDLE_CHOICES.map((m) => <option key={m} value={m}>{m ? t('sec_minutes', { n: m }) : t('sec_never')}</option>)}
      </Select>
    </Field>
  )
}
