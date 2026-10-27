import { BookOpenText, ChartColumn, Package, ReceiptText, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { InvoiceMock, KhataMock, ReportsMock, StockMock } from './Mocks'
import { Checks, Reveal, SectionHead, Stage, useTight, wrap } from './shared'

const ROWS: { n: number; icon: LucideIcon; Mock: ComponentType }[] = [
  { n: 1, icon: ReceiptText, Mock: InvoiceMock },
  { n: 2, icon: Package, Mock: StockMock },
  { n: 3, icon: BookOpenText, Mock: KhataMock },
  { n: 4, icon: ChartColumn, Mock: ReportsMock },
]

export function DeepDives() {
  const { t } = useI18n()
  const tight = useTight()
  return (
    <section aria-labelledby="ld-dd-title" className="border-y border-stone-200 bg-surface py-20 sm:py-28">
      <div className={wrap}>
        <SectionHead id="ld-dd-title" kicker={t('ld_ddKicker')} title={t('ld_ddTitle')} center />
        <div className="mt-16 space-y-20 sm:space-y-28">
          {ROWS.map(({ n, icon: Icon, Mock }, i) => (
            <div key={n} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal className={cx(i % 2 === 1 && 'lg:order-last')}>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-50"><Icon aria-hidden className="size-4.5" /></span>
                  {t(`ld_dd${n}Kicker`)}
                </p>
                <h3 className={cx('mt-4 text-2xl font-bold text-stone-900 sm:text-3xl', tight)}>{t(`ld_dd${n}Title`)}</h3>
                <p className="mt-4 text-lg leading-relaxed text-stone-600">{t(`ld_dd${n}Text`)}</p>
                <Checks className="mt-6" items={[t(`ld_dd${n}a`), t(`ld_dd${n}b`), t(`ld_dd${n}c`)]} />
              </Reveal>
              <Reveal delay={100} className="min-w-0">
                <Stage>
                  <Mock />
                </Stage>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
