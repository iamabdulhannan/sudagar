import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input } from '../../components/ui'
import { authErrorKey, useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { AuthShell, FormError, PasswordField } from './AuthShell'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function SignUp() {
  const { t } = useI18n()
  const { session, signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const invite = (params.get('invite') ?? '').toUpperCase()
  const after = `/welcome${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  if (session) return <Navigate to={after} replace />

  if (sentTo) {
    return (
      <AuthShell title={t('au_checkEmailTitle')} footer={<Link to={`/signin?email=${encodeURIComponent(sentTo)}${invite ? `&invite=${invite}` : ''}`} className="font-semibold text-brand-700 hover:underline">{t('au_backToSignIn')}</Link>}>
        <div className="flex gap-4 rounded-2xl border border-stone-200 bg-surface p-5">
          <MailCheck className="size-8 shrink-0 text-brand-700" />
          <p className="text-[15px] text-stone-700">{t('au_checkEmailText', { email: sentTo })}</p>
        </div>
      </AuthShell>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError(t('au_errName'))
    if (!EMAIL.test(email.trim())) return setError(t('au_errEmail'))
    if (password.length < 8) return setError(t('au_errShort'))
    if (password !== confirm) return setError(t('au_errMatch'))
    setBusy(true)
    try {
      const { needsConfirm } = await signUp(name, email, password)
      if (needsConfirm) { setSentTo(email.trim()); setBusy(false); return }
      navigate(after, { replace: true })
    } catch (err) {
      setError(t(authErrorKey(err)))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('au_createTitle')}
      text={invite ? t('au_inviteNote') : t('au_createText')}
      footer={<>{t('au_haveAccount')} <Link to={`/signin${invite ? `?invite=${invite}` : ''}`} className="font-semibold text-brand-700 hover:underline">{t('au_signIn')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('au_name')}>
          <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('au_namePh')} className="h-11" autoFocus />
        </Field>
        <Field label={t('au_email')}>
          <Input type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('au_emailPh')} className="h-11" />
        </Field>
        <Field label={t('au_password')} hint={t('au_passwordHint')}>
          <PasswordField autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('au_passwordConfirm')}>
          <PasswordField autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <FormError text={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('au_signUp')}</Button>
        <p className="text-center text-xs text-stone-500">{t('au_terms')}</p>
      </form>
    </AuthShell>
  )
}
