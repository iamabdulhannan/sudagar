import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, useUi } from '../../components/ui'
import { authErrorKey, useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { AuthShell, FormError, PasswordField } from './AuthShell'

/** opened from the reset email: Supabase signs the user in with a recovery session first */
export default function ResetPassword() {
  const { t } = useI18n()
  const { session, ready, updatePassword } = useAuth()
  const { toast } = useUi()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError(t('au_errShort'))
    if (password !== confirm) return setError(t('au_errMatch'))
    setBusy(true)
    try {
      await updatePassword(password)
      toast(t('au_resetDone'))
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(t(authErrorKey(err)))
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t('au_resetTitle')} footer={<Link to="/signin" className="font-semibold text-brand-700 hover:underline">{t('au_backToSignIn')}</Link>}>
      {ready && !session ? (
        <FormError text={t('au_errGeneric')} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('au_passwordNew')} hint={t('au_passwordHint')}>
            <PasswordField autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <Field label={t('au_passwordConfirm')}>
            <PasswordField autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <FormError text={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>{t('au_savePassword')}</Button>
        </form>
      )}
    </AuthShell>
  )
}
