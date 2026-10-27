import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'

export interface MenuItem {
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  hidden?: boolean
  /** draw a separator above this item */
  divider?: boolean
}

/**
 * Dropdown menu. The list is portalled with fixed position so it is not clipped by
 * scrolling tables; it opens toward the inline end of its button (RTL aware).
 */
export function Menu({ label, children, items, className }: {
  /** accessible name of the button */
  label: string
  /** button content */
  children: ReactNode
  items: MenuItem[]
  className?: string
}) {
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const shown = items.filter((i) => !i.hidden)

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!list.current?.contains(t) && !btn.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); btn.current?.focus() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    list.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [pos])

  const toggle = (e: RMouseEvent) => {
    e.stopPropagation()
    if (pos) { setPos(null); return }
    const r = btn.current!.getBoundingClientRect()
    const rtl = document.documentElement.dir === 'rtl'
    const est = shown.length * 38 + 12
    const top = r.bottom + 4 + est > window.innerHeight && r.top - est > 0 ? r.top - est - 4 : r.bottom + 4
    setPos(rtl ? { top, left: Math.max(8, r.left) } : { top, right: Math.max(8, window.innerWidth - r.right) })
  }

  const onListKey = (e: RKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus()
  }

  if (!shown.length) return null
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={toggle}
        className={cx('cursor-pointer', className)}
      >
        {children}
      </button>
      {pos && createPortal(
        <div
          ref={list}
          role="menu"
          style={pos}
          onKeyDown={onListKey}
          onClick={(e) => e.stopPropagation()}
          className="no-print fixed z-50 min-w-44 overflow-hidden rounded-xl border border-stone-200 bg-surface py-1 shadow-lg"
        >
          {shown.map((it, i) => (
            <div key={i}>
              {it.divider && i > 0 && <div className="my-1 border-t border-stone-100" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => { setPos(null); it.onClick() }}
                className={cx(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm cursor-pointer focus:outline-none',
                  it.danger ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-stone-700 hover:bg-stone-100 focus:bg-stone-100',
                )}
              >
                {it.icon && <span className="shrink-0 [&>svg]:size-4">{it.icon}</span>}
                {it.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
