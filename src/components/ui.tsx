import { AlertTriangle, CheckCircle2, Info, Loader2, Search, X } from 'lucide-react'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type Ref, type ReactNode, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { fmtMoney } from '../lib/format'
import { useI18n } from '../lib/i18n'

// ---------- buttons ----------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-stone-800 border border-stone-300 hover:bg-stone-50 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
  ghost: 'text-stone-600 hover:bg-stone-100',
}

export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'xs' | 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'xs' && 'h-7 px-2 text-xs',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base font-semibold',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx('grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer disabled:opacity-40', className)}
    >
      {children}
    </button>
  )
}

// ---------- fields ----------

export const fieldCls =
  'w-full h-10 rounded-lg border border-stone-300 bg-surface px-3 text-sm text-stone-900 placeholder:text-stone-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 disabled:bg-stone-100 disabled:text-stone-500'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      onFocus={(e) => { if (rest.type === 'number') e.currentTarget.select(); rest.onFocus?.(e) }}
      className={cx(fieldCls, rest.type === 'number' && 'num', className)}
    />
  )
}

/** number input that keeps an empty string while typing and reports numbers */
export function NumberInput({ value, onValue, className, ref, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined
  onValue: (n: number) => void
  ref?: Ref<HTMLInputElement>
}) {
  const [text, setText] = useState(value === undefined || value === 0 ? '' : String(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) { setText(value === undefined || value === 0 ? '' : String(value)); last.current = value }
  }, [value])
  return (
    <input
      {...rest}
      ref={ref}
      inputMode="decimal"
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.-]/g, '')
        setText(v)
        const n = parseFloat(v)
        last.current = Number.isFinite(n) ? n : 0
        onValue(last.current)
      }}
      className={cx(fieldCls, 'num', className)}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(fieldCls, 'h-auto min-h-16 py-2', className)} />
}

export { Select } from './Select'

export function Field({ label, hint, error, children, className, required }: {
  label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; required?: boolean
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-stone-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-stone-800">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-stone-300')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </button>
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder, className, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('search')}
        className={cx(fieldCls, 'ps-9')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700" aria-label={t('close')}>
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

// ---------- layout pieces ----------

export function Card({ className, children, title, actions, padded = true }: {
  className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode; padded?: boolean
}) {
  return (
    <section className={cx('rounded-xl border border-stone-200 bg-surface shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cx(padded && 'p-4')}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, tone = 'neutral', hint, onClick, icon }: {
  label: ReactNode; value: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'brand'; hint?: ReactNode; onClick?: () => void; icon?: ReactNode
}) {
  const tones = {
    neutral: 'text-stone-900', good: 'text-emerald-700', bad: 'text-red-700', warn: 'text-amber-700', brand: 'text-brand-700',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cx('rounded-xl border border-stone-200 bg-surface p-4 text-start shadow-sm', onClick && 'cursor-pointer transition hover:border-brand-500 hover:shadow')}
    >
      <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-stone-500">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cx('num mt-1 text-xl font-bold sm:text-2xl', tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </Tag>
  )
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'brand'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700', good: 'bg-emerald-100 text-emerald-800', bad: 'bg-red-100 text-red-800',
    warn: 'bg-amber-100 text-amber-800', info: 'bg-sky-100 text-sky-800', brand: 'bg-brand-100 text-brand-800',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>}
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; className?: string
}) {
  return (
    <div className={cx('no-print flex gap-1 overflow-x-auto border-b border-stone-200', className)}>
      {tabs.map((tb) => (
        <button
          key={tb.value}
          type="button"
          onClick={() => onChange(tb.value)}
          className={cx(
            '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
            tb.value === value ? 'border-brand-700 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800',
          )}
        >
          {tb.label}
          {tb.count !== undefined && <span className="rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-600">{tb.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** money with the business currency symbol; colours negative red when asked */
export function Money({ value, symbol = 'Rs', tone, className }: { value: number; symbol?: string; tone?: boolean; className?: string }) {
  return (
    <span className={cx('num whitespace-nowrap', tone && (value < 0 ? 'text-red-700' : value > 0 ? 'text-emerald-700' : ''), className)}>
      {fmtMoney(value, symbol)}
    </span>
  )
}

// ---------- modal ----------

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" className={cx('flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl', widths[size])}>
        <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <IconButton label={t('close')} onClick={onClose}><X className="size-5" /></IconButton>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- toasts and confirm ----------

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: number; text: string; tone: ToastTone }
interface ConfirmReq { title: string; text?: string; danger?: boolean; okLabel?: string; resolve: (ok: boolean) => void }

const UiCtx = createContext<{
  toast: (text: string, tone?: ToastTone) => void
  confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>
} | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [ask, setAsk] = useState<ConfirmReq | null>(null)
  const toast = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x, { id, text, tone }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), tone === 'error' ? 6000 : 3000)
  }, [])
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), [])
  const answer = (ok: boolean) => { ask?.resolve(ok); setAsk(null) }
  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((x) => (
          <div key={x.id} className={cx(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
            x.tone === 'success' && 'bg-stone-900', x.tone === 'error' && 'bg-red-600', x.tone === 'info' && 'bg-sky-700',
          )}>
            {x.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : x.tone === 'error' ? <AlertTriangle className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
            {x.text}
          </div>
        ))}
      </div>
      <Modal
        open={!!ask}
        onClose={() => answer(false)}
        title={ask?.title ?? ''}
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => answer(false)}>{t('cancel')}</Button>
          <Button variant={ask?.danger ? 'danger' : 'primary'} onClick={() => answer(true)} autoFocus>{ask?.okLabel ?? t('confirm')}</Button>
        </>}
      >
        <p className="text-sm text-stone-600">{ask?.text ?? t('areYouSure')}</p>
      </Modal>
    </UiCtx.Provider>
  )
}

export function useUi() {
  const c = useContext(UiCtx)
  if (!c) throw new Error('useUi outside UiProvider')
  return c
}
