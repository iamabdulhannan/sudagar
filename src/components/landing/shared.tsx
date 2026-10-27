import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useAuth } from '../../lib/auth'
import { useFirmCtx } from '../../lib/data'
import { cloudConfigured } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'

/** page width + side gutters used by every section */
export const wrap = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

/** fixed colours that must not flip in dark mode (device bezels, the deep teal band) */
export const INK = '#1c1917'
export const DEEP = '#0b3b37'
export const WHATSAPP = '#25d366'

/** where "Open app" goes: the app when signed in, otherwise the sign-in page */
export function useAppHref() {
  const { session } = useAuth()
  const { firms } = useFirmCtx()
  if (cloudConfigured && !session) return '/signin'
  return firms.length > 0 ? '/dashboard' : '/welcome'
}

/** where "Start free" goes: create an account (or the app when already signed in) */
export function useStartHref() {
  const { session } = useAuth()
  const app = useAppHref()
  return cloudConfigured && !session ? '/signup' : app
}

/** letter spacing hurts joined Urdu script, so only tighten Latin headings */
export function useTight() {
  const { lang } = useI18n()
  return lang === 'ur' ? '' : 'tracking-tight'
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** smooth scroll to a section and keep the hash in the address bar */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
  // move focus for keyboard and screen reader users without a second jump
  el.focus({ preventScroll: true })
}

/** fades and rises its children into view once, the first time they scroll on screen */
export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: {
  children: ReactNode; className?: string; delay?: number; as?: 'div' | 'li'
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShown(true)
        io.disconnect()
      }
    }, { rootMargin: '0px 0px -6% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const style: CSSProperties | undefined = delay ? { animationDelay: `${delay}ms` } : undefined
  return (
    <Tag
      ref={ref as never}
      style={style}
      className={cx(shown ? 'motion-safe:animate-rise' : 'motion-safe:opacity-0', className)}
    >
      {children}
    </Tag>
  )
}

/** kicker + h2 + optional sub line */
export function SectionHead({ kicker, title, sub, center, id, light }: {
  kicker: string; title: string; sub?: string; center?: boolean; id?: string; light?: boolean
}) {
  const tight = useTight()
  return (
    <Reveal className={cx('max-w-3xl', center && 'mx-auto text-center')}>
      <p className={cx('text-sm font-semibold', light ? 'text-amber-300' : 'text-brand-700')}>{kicker}</p>
      <h2 id={id} className={cx('mt-3 text-3xl font-bold sm:text-4xl', tight, light ? 'text-white' : 'text-stone-900')}>{title}</h2>
      {sub && <p className={cx('mt-4 text-lg leading-relaxed', light ? 'text-white/75' : 'text-stone-600')}>{sub}</p>}
    </Reveal>
  )
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

type CtaVariant = 'primary' | 'secondary' | 'white' | 'outlineLight'
const CTA: Record<CtaVariant, string> = {
  primary: 'bg-primary text-white shadow-lg shadow-brand-700/20 hover:bg-primary-hover',
  secondary: 'border border-stone-300 bg-surface text-stone-800 shadow-sm hover:border-stone-400 hover:bg-stone-50',
  white: 'bg-white text-[#115e59] shadow-lg hover:bg-[#f0fdfa] focus-visible:outline-white',
  outlineLight: 'border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white',
}

/** a router link styled as a button */
export function CtaLink({ to, children, variant = 'primary', size = 'lg', arrow, className, onClick }: {
  to: string; children: ReactNode; variant?: CtaVariant; size?: 'md' | 'lg'; arrow?: boolean; className?: string; onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cx(
        'group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors',
        focus,
        size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
        CTA[variant],
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight aria-hidden className="size-4 transition-transform rtl:rotate-180 motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5" />}
    </Link>
  )
}

/** bullet list with check marks */
export function Checks({ items, className, light }: { items: string[]; className?: string; light?: boolean }) {
  return (
    <ul className={cx('space-y-2.5', className)}>
      {items.map((s) => (
        <li key={s} className={cx('flex gap-2.5 text-[15px]', light ? 'text-white/85' : 'text-stone-700')}>
          <span className={cx('mt-1 grid size-4.5 shrink-0 place-items-center rounded-full', light ? 'bg-amber-400/20 text-amber-300' : 'bg-brand-100 text-brand-700')}>
            <Check aria-hidden className="size-3" strokeWidth={3} />
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  )
}

/** the soft tinted stage that the HTML mockups sit on */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-3xl border border-stone-200 bg-linear-to-br from-brand-50 via-surface to-amber-50 p-4 sm:p-8', className)}>
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-brand-100 opacity-60 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -start-10 size-56 rounded-full bg-amber-100 opacity-60 blur-3xl" />
      <div dir="ltr" className="relative">{children}</div>
    </div>
  )
}
