import {
  Boxes, Factory, Hammer, Pill, Shirt, ShoppingBasket, Smartphone, Sprout, Store, Truck, UtensilsCrossed, Wrench, type LucideIcon,
} from 'lucide-react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { CtaLink, Reveal, SectionHead, wrap, useStartHref } from './shared'

export const BUSINESS_TYPES: { key: string; icon: LucideIcon }[] = [
  { key: 'retail', icon: Store },
  { key: 'grocery', icon: ShoppingBasket },
  { key: 'wholesale', icon: Boxes },
  { key: 'distributor', icon: Truck },
  { key: 'manufacturer', icon: Factory },
  { key: 'pharmacy', icon: Pill },
  { key: 'electronics', icon: Smartphone },
  { key: 'garments', icon: Shirt },
  { key: 'hardware', icon: Hammer },
  { key: 'restaurant', icon: UtensilsCrossed },
  { key: 'services', icon: Wrench },
  { key: 'agri', icon: Sprout },
]

const TONES = [
  'bg-brand-50 text-brand-700',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-sky-50 text-sky-800',
]

export function BusinessTypes() {
  const startHref = useStartHref()
  const { t } = useI18n()
  return (
    <section id="who" tabIndex={-1} aria-labelledby="ld-who-title" className="scroll-mt-20 border-y border-stone-200 bg-surface py-20 outline-none sm:py-28">
      <div className={wrap}>
        <SectionHead id="ld-who-title" kicker={t('ld_whoKicker')} title={t('ld_whoTitle')} sub={t('ld_whoSub')} center />
        <ul className="mt-14 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {BUSINESS_TYPES.map(({ key, icon: Icon }, i) => (
            <Reveal as="li" key={key} delay={(i % 4) * 50}>
              <div className="flex h-full items-center gap-4 rounded-2xl border border-stone-200 bg-page p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40 sm:p-5">
                <span className={cx('grid size-12 shrink-0 place-items-center rounded-xl', TONES[i % TONES.length])}>
                  <Icon aria-hidden className="size-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold leading-snug text-stone-900">{t(`bt_${key}`)}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-stone-500">{t(`ld_bh_${key}`)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal className="mt-12 text-center">
          <CtaLink to={startHref} arrow>{t('ld_whoCta')}</CtaLink>
        </Reveal>
      </div>
    </section>
  )
}
