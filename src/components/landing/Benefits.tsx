import { BadgeCheck, BellRing, ChevronDown, Clock, LockKeyhole, Palette, Percent, PiggyBank, WifiOff, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { Reveal, SectionHead, wrap } from './shared'

const BENEFITS: { n: number; icon: LucideIcon }[] = [
  { n: 1, icon: Clock },
  { n: 2, icon: PiggyBank },
  { n: 3, icon: BadgeCheck },
  { n: 4, icon: Percent },
  { n: 5, icon: Palette },
  { n: 6, icon: BellRing },
  { n: 7, icon: LockKeyhole },
  { n: 8, icon: WifiOff },
]

function Benefit({ n, icon: Icon }: { n: number; icon: LucideIcon }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const panel = `ld-why-more-${n}`
  return (
    <article className="flex h-full flex-col rounded-2xl border border-stone-200 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
      <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-brand-600 to-brand-500 text-white shadow-md shadow-brand-700/20">
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-bold text-stone-900">{t(`ld_b${n}Title`)}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{t(`ld_b${n}Text`)}</p>
      <div
        id={panel}
        aria-hidden={!open}
        className={cx('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
      >
        <div className="overflow-hidden">
          <p className="pt-3 text-[15px] leading-relaxed text-stone-600">{t(`ld_b${n}More`)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panel}
        className="mt-4 inline-flex items-center gap-1 self-start rounded-md text-sm font-semibold text-brand-700 hover:text-brand-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {open ? t('ld_readLess') : t('ld_readMore')}
        <ChevronDown aria-hidden className={cx('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
    </article>
  )
}

export function Benefits() {
  const { t } = useI18n()
  return (
    <section id="why" tabIndex={-1} aria-labelledby="ld-why-title" className="scroll-mt-20 py-20 outline-none sm:py-28">
      <div className={wrap}>
        <SectionHead id="ld-why-title" kicker={t('ld_whyKicker')} title={t('ld_whyTitle')} sub={t('ld_whySub')} center />
        <ul className="mt-14 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal as="li" key={b.n} delay={(i % 4) * 60}>
              <Benefit {...b} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
