import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { useTheme } from '../../lib/theme'
import { CtaLink, scrollToId, useAppHref, wrap, useStartHref } from './shared'

export const NAV: { id: string; label: string }[] = [
  { id: 'features', label: 'ld_navFeatures' },
  { id: 'who', label: 'ld_navWho' },
  { id: 'why', label: 'ld_navWhy' },
  { id: 'faq', label: 'ld_navFaq' },
]

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export function Header() {
  const startHref = useStartHref()
  const { t, lang, setLang } = useI18n()
  const { resolved, toggle } = useTheme()
  const appHref = useAppHref()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const go = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setOpen(false)
    scrollToId(id)
  }
  const toTop = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setOpen(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    history.replaceState(null, '', location.pathname)
  }

  const langBtn = (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
      aria-label={t('ld_otherLangLabel')}
      lang={lang === 'en' ? 'ur' : 'en'}
      className={cx('inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-stone-700 hover:bg-stone-100 cursor-pointer', focus)}
    >
      {t('ld_otherLang')}
    </button>
  )
  const themeBtn = (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === 'dark' ? t('ld_toLight') : t('ld_toDark')}
      title={resolved === 'dark' ? t('ld_toLight') : t('ld_toDark')}
      className={cx('grid size-10 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer', focus)}
    >
      {resolved === 'dark' ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </button>
  )

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b transition-colors',
        scrolled || open ? 'border-stone-200 bg-page/85 backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <div className={cx(wrap, 'flex h-16 items-center gap-3')}>
        <a href="#top" onClick={toTop} aria-label={t('ld_home')} className={cx('flex shrink-0 items-center gap-2.5 rounded-lg', focus)}>
          <img src="/favicon.svg" alt="" className="size-9" width={36} height={36} />
          <span className="text-lg font-bold text-stone-900">{t('appName')}</span>
        </a>

        <nav aria-label={t('ld_mainNav')} className="ms-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} onClick={go(n.id)} className={cx('rounded-lg px-3 py-2 text-[15px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900', focus)}>
                  {t(n.label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 sm:flex">{langBtn}{themeBtn}</div>
          <CtaLink to={appHref} variant="secondary" size="md" className="max-md:hidden">{t('ld_openApp')}</CtaLink>
          <CtaLink to={startHref} size="md" className="max-[399px]:hidden">{t('ld_startFree')}</CtaLink>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="ld-mobile-menu"
            aria-label={open ? t('ld_menuClose') : t('ld_menuOpen')}
            className={cx('grid size-10 place-items-center rounded-lg text-stone-700 hover:bg-stone-100 cursor-pointer lg:hidden', focus)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>

      <div id="ld-mobile-menu" hidden={!open} className="border-t border-stone-200 bg-surface shadow-lg lg:hidden">
        <div className={cx(wrap, 'py-4')}>
          <nav aria-label={t('ld_mainNav')}>
            <ul className="grid gap-1">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} onClick={go(n.id)} className={cx('block rounded-lg px-3 py-3 text-base font-medium text-stone-800 hover:bg-stone-100', focus)}>
                    {t(n.label)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3 sm:hidden">{langBtn}{themeBtn}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <CtaLink to={appHref} variant="secondary" onClick={() => setOpen(false)}>{t('ld_openApp')}</CtaLink>
            <CtaLink to={startHref} onClick={() => setOpen(false)}>{t('ld_startFree')}</CtaLink>
          </div>
        </div>
      </div>
    </header>
  )
}
