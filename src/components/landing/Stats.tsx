import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { Reveal, wrap } from './shared'

/** only facts that are true of the product today (15 document types, 19 reports in the registry) */
const STATS = [
  { value: '13+', label: 'ld_stat1' },
  { value: '19', label: 'ld_stat2' },
  { value: '2', label: 'ld_stat3' },
  { value: '100%', label: 'ld_stat4' },
]

export function Stats() {
  const { t } = useI18n()
  return (
    <section aria-label={t('ld_statsLabel')} className={cx(wrap, 'relative')}>
      <Reveal>
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-stone-200 bg-surface shadow-sm lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={cx(
                'flex flex-col gap-1 p-5 sm:p-7',
                i % 2 === 1 && 'border-s border-stone-200',
                i >= 2 && 'border-t border-stone-200 lg:border-t-0',
                i === 2 && 'lg:border-s',
              )}
            >
              <dt className="order-2 text-sm leading-snug text-stone-600">{t(s.label)}</dt>
              <dd className="num order-1 text-3xl font-bold text-stone-900 sm:text-4xl">
                <span className="bg-linear-to-br from-brand-700 to-brand-500 bg-clip-text text-transparent">{s.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  )
}
