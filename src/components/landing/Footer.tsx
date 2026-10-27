import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { BUSINESS_TYPES } from './BusinessTypes'
import { CONTACT_EMAIL } from './Faq'
import { NAV } from './Header'
import { CtaLink, Reveal, scrollToId, useAppHref, useTight, wrap, useStartHref } from './shared'

const link = 'rounded text-[15px] text-stone-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export function FinalCta() {
  const startHref = useStartHref()
  const { t } = useI18n()
  const tight = useTight()
  return (
    <section aria-labelledby="ld-cta-title" className={cx(wrap, 'pb-20 sm:pb-28')}>
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-white shadow-2xl shadow-brand-700/20 sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -end-20 -top-24 size-72 rounded-full bg-white/10" />
            <div className="absolute -bottom-28 -start-16 size-80 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="absolute bottom-6 end-10 hidden size-24 rounded-full border-[10px] border-amber-400/30 sm:block" />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <h2 id="ld-cta-title" className={cx('text-3xl font-bold sm:text-5xl', tight)}>{t('ld_ctaTitle')}</h2>
            <p className="mt-5 text-lg text-white/85">{t('ld_ctaText')}</p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 min-[400px]:flex-row min-[400px]:items-center">
              <CtaLink to={startHref} variant="white" arrow>{t('ld_startFree')}</CtaLink>
              <CtaLink to="/signin" variant="outlineLight">{t('ld_signIn')}</CtaLink>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function Footer() {
  const startHref = useStartHref()
  const { t } = useI18n()
  const appHref = useAppHref()
  const year = new Date().getFullYear()
  const go = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    scrollToId(id)
  }
  return (
    <footer className="border-t border-stone-200 bg-surface">
      <div className={cx(wrap, 'grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.4fr_1.2fr]')}>
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9" width={36} height={36} />
            <span className="text-lg font-bold text-stone-900">{t('appName')}</span>
          </div>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-stone-600">{t('ld_footAbout')}</p>
        </div>

        <nav aria-labelledby="ld-foot-product">
          <h2 id="ld-foot-product" className="text-sm font-bold text-stone-900">{t('ld_footProduct')}</h2>
          <ul className="mt-4 space-y-2.5">
            {NAV.map((n) => (
              <li key={n.id}><a href={`#${n.id}`} onClick={go(n.id)} className={link}>{t(n.label)}</a></li>
            ))}
            <li><Link to="/signin" className={link}>{t('ld_signIn')}</Link></li>
            <li><Link to={appHref} className={link}>{t('ld_openApp')}</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold text-stone-900">{t('ld_footTypes')}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-1 lg:grid-cols-2">
            {BUSINESS_TYPES.map((b) => (
              <li key={b.key} className="text-[15px] text-stone-600">{t(`bt_${b.key}`)}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-stone-900">{t('ld_footContact')}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-stone-600">{t('ld_footContactText')}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="mt-3 inline-block rounded text-[15px] font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{CONTACT_EMAIL}</a>
          <div className="mt-6">
            <CtaLink to={startHref} size="md" arrow>{t('ld_startFree')}</CtaLink>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-200">
        <div className={cx(wrap, 'flex flex-col gap-2 py-6 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between')}>
          <p>{t('ld_footRights', { year })}</p>
          <p>{t('ld_footLocal')}</p>
        </div>
      </div>
    </footer>
  )
}
