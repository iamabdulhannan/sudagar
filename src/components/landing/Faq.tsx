import { Mail, Plus } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { Reveal, SectionHead, wrap } from './shared'

// placeholder address until the real support inbox exists
export const CONTACT_EMAIL = 'hello@saudagar.app'

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function Faq() {
  const { t } = useI18n()
  const [open, setOpen] = useState<number | null>(1)
  return (
    <section id="faq" tabIndex={-1} aria-labelledby="ld-faq-title" className="scroll-mt-20 py-20 outline-none sm:py-28">
      <div className={cx(wrap, 'grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16')}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="ld-faq-title" kicker={t('ld_faqKicker')} title={t('ld_faqTitle')} sub={t('ld_faqSub')} />
          <Reveal delay={80}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-surface px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Mail aria-hidden className="size-4 text-brand-700" />
              <span dir="ltr">{CONTACT_EMAIL}</span>
            </a>
          </Reveal>
        </div>

        <Reveal>
          <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-surface shadow-sm">
            {QUESTIONS.map((n) => {
              const isOpen = open === n
              const btn = `ld-faq-q${n}`
              const panel = `ld-faq-a${n}`
              return (
                <div key={n}>
                  <h3>
                    <button
                      id={btn}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panel}
                      onClick={() => setOpen(isOpen ? null : n)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-5 text-start text-base font-semibold text-stone-900 hover:text-brand-700 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 sm:px-6"
                    >
                      <span>{t(`ld_q${n}`)}</span>
                      <span className={cx('grid size-8 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-300 motion-reduce:transition-none', isOpen ? 'rotate-45 bg-brand-600 text-white' : 'bg-stone-100 text-stone-600')}>
                        <Plus aria-hidden className="size-4" />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panel}
                    role="region"
                    aria-labelledby={btn}
                    aria-hidden={!isOpen}
                    className={cx('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-stone-600 sm:px-6">{t(`ld_a${n}`)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
