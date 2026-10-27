import { Check, ChevronDown, Search } from 'lucide-react'
import {
  Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { useI18n } from '../lib/i18n'

/**
 * The app's dropdown. Same API as a native <select> (children are <option>s, onChange gives
 * e.target.value), but drawn by us so it looks the same everywhere: a styled list with the
 * current choice ticked, search for long lists, full keyboard use, RTL and dark mode.
 */

interface Opt { value: string; label: ReactNode; text: string; disabled?: boolean }

const textOf = (n: ReactNode): string => {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textOf).join('')
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children)
  return ''
}

/** <option>s from children, through fragments, arrays and conditionals */
function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = []
  const walk = (c: ReactNode) => Children.forEach(c, (ch) => {
    if (!isValidElement(ch)) return
    const el = ch as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; hidden?: boolean }>
    if (el.type === 'option') {
      if (el.props.hidden) return
      const text = textOf(el.props.children)
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : text, label: el.props.children, text, disabled: el.props.disabled })
    } else walk(el.props.children)
  })
  walk(children)
  return out
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  /** show a search box (default: when there are more than 8 choices) */
  searchable?: boolean
}

const fieldBase =
  'flex w-full h-10 items-center gap-2 rounded-lg border border-stone-300 bg-surface px-3 text-sm text-stone-900 text-start ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 focus-visible:border-brand-600 disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed cursor-pointer'

export function Select({ value, defaultValue, onChange, children, className, disabled, searchable, id, name, title, autoFocus, ...rest }: SelectProps) {
  const { t, dir } = useI18n()
  const options = useMemo(() => readOptions(children), [children])
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''))
  const current = value !== undefined ? String(value) : inner
  const selected = options.find((o) => o.value === current) ?? (value === undefined ? options[0] : undefined)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()
  const withSearch = searchable ?? options.length > 8

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.text.toLowerCase().includes(q)) : options
  }, [options, query])

  const pick = useCallback((o: Opt) => {
    if (o.disabled) return
    if (value === undefined) setInner(o.value)
    setOpen(false)
    btn.current?.focus()
    if (o.value !== current) {
      const target = { value: o.value, name: name ?? '', id: id ?? '' } as unknown as HTMLSelectElement
      onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>)
    }
  }, [current, id, name, onChange, value])

  const openList = () => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === current)))
    setOpen(true)
  }

  // position under the button (or above when there is no room), kept in place on scroll / resize
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number; up: boolean }>({ top: 0, left: 0, width: 0, maxH: 300, up: false })
  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    const up = below < 220 && above > below
    const width = Math.max(r.width, 200)
    const left = dir === 'rtl' ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8)
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: Math.max(8, left), width, maxH: Math.min(320, Math.max(160, up ? above : below)), up })
  }, [dir])
  useLayoutEffect(() => { if (open) place() }, [open, place])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const tg = e.target as Node
      if (!btn.current?.contains(tg) && !list.current?.parentElement?.contains(tg)) setOpen(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', onDoc)
    if (withSearch) setTimeout(() => search.current?.focus(), 0)
    else setTimeout(() => list.current?.focus(), 0)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open, place, withSearch])

  // keep the highlighted choice visible
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const move = (step: number) => {
    if (!shown.length) return
    let i = active
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length
      if (!shown[i].disabled) break
    }
    setActive(i)
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (shown[active]) pick(shown[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'Tab') setOpen(false)
    else if (!withSearch && e.key.length === 1) {
      // type a few letters to jump to a choice
      const now = Date.now()
      typed.current.text = now - typed.current.at > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase()
      typed.current.at = now
      const i = shown.findIndex((o) => o.text.toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList() }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest['aria-label']}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
        className={cx(fieldBase, open && 'border-brand-600 ring-2 ring-brand-600/30', className)}
      >
        <span className={cx('min-w-0 flex-1 truncate', !selected && 'text-stone-400')}>{selected?.label ?? ' '}</span>
        <ChevronDown className={cx('size-4 shrink-0 text-stone-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div
          className="no-print fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-surface shadow-xl"
          style={{ left: pos.left, width: pos.width, maxHeight: pos.maxH, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          dir={dir}
        >
          {withSearch && (
            <div className="relative border-b border-stone-100 p-2">
              <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input
                ref={search}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onListKey}
                placeholder={t('search')}
                aria-controls={listId}
                className="h-9 w-full rounded-lg border border-stone-200 bg-surface ps-8 pe-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none"
              />
            </div>
          )}
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            onKeyDown={onListKey}
            className="flex-1 overflow-y-auto overscroll-contain p-1 focus:outline-none"
          >
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-stone-400">{t('noResults')}</li>}
            {shown.map((o, i) => {
              const isSel = o.value === current
              return (
                <li
                  key={o.value + ':' + i}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm',
                    i === active && 'bg-stone-100',
                    isSel ? 'font-semibold text-brand-800' : 'text-stone-800',
                    o.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {isSel && <Check className="size-4 shrink-0 text-brand-700" />}
                </li>
              )
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
