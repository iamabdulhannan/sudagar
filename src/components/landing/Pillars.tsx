import { Landmark, Package, ReceiptText, ScanBarcode, type LucideIcon } from 'lucide-react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { Checks, Reveal, SectionHead, wrap } from './shared'

const PILLARS: { n: number; icon: LucideIcon; tone: string }[] = [
  { n: 1, icon: ReceiptText, tone: 'bg-brand-50 text-brand-700 ring-brand-200' },
  { n: 2, icon: Package, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { n: 3, icon: Landmark, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { n: 4, icon: ScanBarcode, tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
]

export function Pillars() {
  const { t } = useI18n()
  return (
    <section id="features" tabIndex={-1} aria-labelledby="ld-features-title" className="scroll-mt-20 py-20 outline-none sm:py-28">
      <div className={wrap}>
        <SectionHead id="ld-features-title" kicker={t('ld_pillarsKicker')} title={t('ld_pillarsTitle')} sub={t('ld_pillarsSub')} center />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ n, icon: Icon, tone }, i) => (
            <Reveal as="li" key={n} delay={i * 70} className="h-full">
              <article className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-surface p-6 shadow-sm transition-[box-shadow,transform,border-color] hover:border-stone-300 hover:shadow-lg motion-safe:hover:-translate-y-1">
                <span className={cx('grid size-12 place-items-center rounded-xl ring-1', tone)}>
                  <Icon aria-hidden className="size-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-stone-900">{t(`ld_p${n}Title`)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{t(`ld_p${n}Text`)}</p>
                <Checks className="mt-5 border-t border-stone-100 pt-5" items={[t(`ld_p${n}a`), t(`ld_p${n}b`), t(`ld_p${n}c`)]} />
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
