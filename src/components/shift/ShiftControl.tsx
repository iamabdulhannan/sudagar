import { ChevronDown, FileBarChart2, Lock, LockOpen, Timer, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { CashMoveType, Shift } from '../../lib/types'
import { Button } from '../ui'
import { CashMoveModal, CloseShiftModal, OpenShiftModal, printShiftReport } from './ShiftModals'

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** shift button for the POS header: open a shift, or the shift menu (pay in / out, drop, X report, close) */
export function ShiftControl({ shift }: { shift?: Shift }) {
  const { t } = useI18n()
  const data = useData()
  const [menu, setMenu] = useState(false)
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [move, setMove] = useState<CashMoveType | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  if (!shift) {
    return (
      <>
        <button type="button" onClick={() => setOpening(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 text-sm font-semibold text-stone-900 hover:bg-amber-300 cursor-pointer">
          <LockOpen className="size-4" /><span className="hidden sm:inline">{t('sh_open')}</span>
        </button>
        <OpenShiftModal open={opening} onClose={() => setOpening(false)} onOpened={() => {}} />
      </>
    )
  }

  const item = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button type="button" onClick={() => { setMenu(false); onClick() }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-stone-700 hover:bg-stone-100 cursor-pointer">{icon}{label}</button>
  )
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-white/85 hover:bg-white/10 cursor-pointer" title={`${shift.number} · ${shift.register}`}>
        <span className="size-2 rounded-full bg-emerald-400" />
        <Timer className="size-4" />
        <span className="hidden sm:inline">{shift.number}</span>
        <span className="hidden text-white/55 lg:inline">{t('sh_since', { time: hhmm(shift.openedAt) })}</span>
        <ChevronDown className="size-4" />
      </button>
      {menu && (
        <div className="absolute end-0 top-full z-40 mt-2 w-64 rounded-xl border border-stone-200 bg-surface p-1.5 shadow-xl">
          <div className="px-3 py-2 text-xs text-stone-500">{shift.register} · {t('sh_by', { name: shift.openedBy })}</div>
          {item(<Wallet className="size-4" />, t('sh_payIn'), () => setMove('pay_in'))}
          {item(<Wallet className="size-4" />, t('sh_payOut'), () => setMove('pay_out'))}
          {item(<Wallet className="size-4" />, t('sh_drop'), () => setMove('drop'))}
          {item(<LockOpen className="size-4" />, t('sh_noSale'), () => setMove('no_sale'))}
          {item(<FileBarChart2 className="size-4" />, t('sh_xReport'), () => printShiftReport(data, shift, 'x'))}
          <div className="p-1.5"><Button variant="danger" size="sm" className="w-full" onClick={() => { setMenu(false); setClosing(true) }}><Lock className="size-4" />{t('sh_close')}</Button></div>
        </div>
      )}
      <CashMoveModal open={!!move} onClose={() => setMove(null)} shift={shift} initial={move ?? 'pay_out'} />
      <CloseShiftModal open={closing} onClose={() => setClosing(false)} shift={shift} onClosed={() => {}} />
    </div>
  )
}

/** shown over the POS when a shift is required and none is open */
export function NeedShift() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-30 grid place-items-center bg-page/90 p-4 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-surface p-6 text-center shadow-xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-800"><LockOpen className="size-7" /></div>
        <h2 className="mt-4 text-lg font-bold text-stone-900">{t('sh_needShift')}</h2>
        <p className="mt-2 text-sm text-stone-500">{t('sh_needShiftText')}</p>
        <Button size="lg" className="mt-5 w-full" onClick={() => setOpen(true)}>{t('sh_open')}</Button>
      </div>
      <OpenShiftModal open={open} onClose={() => setOpen(false)} onOpened={() => {}} />
    </div>
  )
}
