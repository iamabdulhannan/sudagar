import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Field, Input } from '../../components/ui'
import { authErrorKey, useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { AuthShell, FormError } from './AuthShell'

export default function ForgotPassword() {
  const { t } = useI18n()
  const { sendReset } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try { await sendReset(email); setSent(true) } catch (err) { setError(t(authErrorKey(err))) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title={t('au_forgotTitle')}
      text={sent ? undefined : t('au_forgotText')}
      footer={<Link to={`/signin${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="font-semibold text-brand-700 hover:underline">{t('au_backToSignIn')}</Link>}
    >
      {sent ? (
        <div className="flex gap-4 rounded-2xl border border-stone-200 bg-surface p-5">
          <MailCheck className="size-8 shrink-0 text-brand-700" />
          <p className="text-[15px] text-stone-700">{t('au_linkSent', { email: email.trim() })}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('au_email')}>
            <Input type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('au_emailPh')} className="h-11" autoFocus />
          </Field>
          <FormError text={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email.trim()}>{t('au_sendLink')}</Button>
        </form>
      )}
    </AuthShell>
  )
}
