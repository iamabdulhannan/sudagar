import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input } from '../../components/ui'
import { authErrorKey, useAuth } from '../../lib/auth'
import { safeNext } from '../../lib/paths'
import { useI18n } from '../../lib/i18n'
import { AuthShell, FormError, PasswordField } from './AuthShell'


export default function SignIn() {
  const { t } = useI18n()
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (session) return <Navigate to={`/welcome${next ? `?next=${encodeURIComponent(next)}` : ''}`} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
      navigate(`/welcome${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true })
    } catch (err) {
      setError(t(authErrorKey(err)))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('au_welcomeBack')}
      text={t('au_signInText')}
      footer={<>{t('au_noAccount')} <Link to={`/signup${params.toString() ? `?${params}` : ''}`} className="font-semibold text-brand-700 hover:underline">{t('au_signUp')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('au_email')}>
          <Input type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('au_emailPh')} className="h-11" autoFocus required />
        </Field>
        <Field label={
          <span className="flex items-center justify-between">
            {t('au_password')}
            <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[13px] font-medium text-brand-700 hover:underline">{t('au_forgot')}</Link>
          </span>
        }>
          <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <FormError text={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email.trim() || !password}>{t('au_signIn')}</Button>
      </form>
    </AuthShell>
  )
}
