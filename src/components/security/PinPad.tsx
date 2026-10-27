import { Delete, LogIn } from 'lucide-react'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { PIN_MAX } from '../../lib/users'

export interface PinPadHandle {
  /** wobble the dots after a wrong PIN */
  shake: () => void
}

/**
 * Number pad for PINs: dots for the digits typed, 0-9, delete and OK.
 * With `keyboard`, the number keys, Backspace, Escape and Enter work too.
 * The digits are never shown.
 */
export function PinPad({ value, onChange, onSubmit, disabled, keyboard = true, minLength = 4, ref }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  keyboard?: boolean
  minLength?: number
  ref?: Ref<PinPadHandle>
}) {
  const { t } = useI18n()
  const dots = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({
    shake: () => {
      dots.current?.animate?.(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 380, easing: 'ease-in-out' },
      )
    },
  }), [])

  // the typed value is tracked in a ref too, so fast typing never drops a digit between renders
  const cur = useRef(value)
  cur.current = value
  const set = (v: string) => { cur.current = v; onChange(v) }
  const press = (d: string) => { if (!disabled && cur.current.length < PIN_MAX) set(cur.current + d) }
  const back = () => { if (!disabled) set(cur.current.slice(0, -1)) }
  const ready = value.length >= minLength && !disabled

  // keep the latest handlers for the window listener
  const latest = useRef({ press, back, onSubmit, ready, onChange, disabled })
  latest.current = { press, back, onSubmit, ready, onChange, disabled }
  useEffect(() => {
    if (!keyboard) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      const l = latest.current
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); l.press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); l.back() }
      else if (e.key === 'Escape') { if (!l.disabled) l.onChange('') }
      else if (e.key === 'Enter') { e.preventDefault(); if (l.ready) l.onSubmit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard])

  const key = 'grid h-14 place-items-center rounded-2xl text-xl font-semibold transition-colors cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="mx-auto w-full max-w-[260px]" dir="ltr">
      <div ref={dots} className="mb-5 flex h-4 items-center justify-center gap-3" role="status" aria-label={t('lk_digits', { n: value.length })}>
        {Array.from({ length: Math.max(minLength, value.length) }, (_, i) => (
          <span key={i} className={cx('size-3.5 rounded-full border-2 transition-colors', i < value.length ? 'border-brand-700 bg-brand-700' : 'border-stone-300')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={cx(key, 'num bg-stone-100 text-stone-900 hover:bg-stone-200')}>{d}</button>
        ))}
        <button type="button" disabled={disabled || !value} onClick={back} className={cx(key, 'text-stone-600 hover:bg-stone-100')} aria-label={t('lk_backspace')}>
          <Delete className="size-6" />
        </button>
        <button type="button" disabled={disabled} onClick={() => press('0')} className={cx(key, 'num bg-stone-100 text-stone-900 hover:bg-stone-200')}>0</button>
        <button type="button" disabled={!ready} onClick={onSubmit} className={cx(key, 'bg-primary text-white hover:bg-primary-hover')} aria-label={t('lk_unlock')}>
          <LogIn className="size-6 rtl:rotate-180" />
        </button>
      </div>
    </div>
  )
}
