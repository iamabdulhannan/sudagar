import { CloudOff, Eye, EyeOff, Languages, ShieldCheck, WifiOff } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fieldCls } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { cloudConfigured } from '../../lib/supabase'

/** the two-panel layout of the sign-in, sign-up and password pages */
export function AuthShell({ title, text, children, footer }: { title: ReactNode; text?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b3b37] p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-[#14b8a6]/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -start-20 size-96 rounded-full bg-[#fbbf24]/15 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10" />
          <span className="text-2xl font-bold">{t('appName')}</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-snug">{t('tagline')}</p>
          <ul className="mt-8 space-y-4 text-[15px] text-white/80">
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#fbbf24]" />{t('au_createText')}</li>
            <li className="flex gap-3"><WifiOff className="mt-0.5 size-5 shrink-0 text-[#fbbf24]" />{t('ld_trustOffline')}</li>
          </ul>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 lg:invisible">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="text-lg font-bold text-stone-900">{t('appName')}</span>
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
          >
            <Languages className="size-4" />{lang === 'en' ? 'اردو' : 'English'}
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{title}</h1>
          {text && <p className="mt-2 text-[15px] text-stone-500">{text}</p>}
          {!cloudConfigured && (
            <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <CloudOff className="mt-0.5 size-4 shrink-0" />
              <div>
                <p>{t('au_errNotConfigured')}</p>
                <Link to="/welcome" className="mt-1 inline-block font-semibold underline">{t('au_continueLocal')}</Link>
              </div>
            </div>
          )}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-stone-600">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

/** password field with show / hide */
export function PasswordField({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <div className="relative" dir="ltr">
      <input {...rest} type={show ? 'text' : 'password'} className={cx(fieldCls, 'h-11 pe-11', className)} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('au_hide') : t('au_show')}
        title={show ? t('au_hide') : t('au_show')}
        className="absolute inset-y-0 end-0 grid w-11 place-items-center text-stone-400 hover:text-stone-700 cursor-pointer"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  )
}

export function FormError({ text }: { text: string }) {
  if (!text) return null
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{text}</p>
}
