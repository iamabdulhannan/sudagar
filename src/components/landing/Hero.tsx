import { Check, Languages, ShieldCheck, WifiOff, type LucideIcon } from 'lucide-react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { HeroMockup } from './HeroMockup'
import { CtaLink, Reveal, useTight, wrap, useStartHref } from './shared'

export function Hero() {
  const startHref = useStartHref()
  const { t } = useI18n()
  const tight = useTight()
  const trust: { icon: LucideIcon; text: string }[] = [
    { icon: WifiOff, text: t('ld_trustOffline') },
    { icon: Languages, text: 'English + اردو' },
    { icon: Check, text: t('ld_trustCard') },
    { icon: ShieldCheck, text: t('ld_trustData') },
  ]
  return (
    <section aria-labelledby="ld-hero-title" className="relative -mt-16 overflow-hidden pt-16">
      {/* backdrop: soft colour fields and a faint grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[56rem] max-w-none -translate-x-1/2 rounded-full bg-brand-100 opacity-60 blur-3xl" />
        <div className="absolute top-40 -end-40 size-[28rem] rounded-full bg-amber-100 opacity-60 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full text-stone-200 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]">
          <defs>
            <pattern id="ld-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ld-grid)" />
        </svg>
      </div>

      <div className={cx(wrap, 'relative grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:pb-24 lg:pt-20')}>
        <div className="text-center lg:text-start">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface/70 px-3.5 py-1.5 text-[13px] font-semibold text-brand-800 shadow-sm">
              <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
              {t('ld_heroKicker')}
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h1 id="ld-hero-title" className={cx('mt-6 text-[2.5rem] font-bold leading-[1.08] text-stone-900 sm:text-6xl lg:text-[4rem]', tight)}>
              {t('ld_heroTitleA')}{' '}
              <span className="bg-linear-to-r from-brand-600 via-brand-500 to-amber-500 box-decoration-clone bg-clip-text text-transparent">
                {t('ld_heroTitleB')}
              </span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600 sm:text-xl lg:mx-0">{t('ld_heroSub')}</p>
          </Reveal>
          <Reveal delay={180} className="mt-8 flex flex-col items-stretch justify-center gap-3 min-[400px]:flex-row min-[400px]:items-center lg:justify-start">
            <CtaLink to={startHref} arrow>{t('ld_startFree')}</CtaLink>
            <CtaLink to="/signin" variant="secondary">{t('ld_signIn')}</CtaLink>
          </Reveal>
          <Reveal delay={240}>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-sm text-stone-600 lg:justify-start">
              {trust.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon aria-hidden className="size-4 text-brand-600" />
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:-me-6">
          <HeroMockup />
        </Reveal>
      </div>
    </section>
  )
}
