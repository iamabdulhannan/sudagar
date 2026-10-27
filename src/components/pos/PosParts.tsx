import { ArrowLeft, CheckCircle2, Clock, Languages, PauseCircle, Play, Printer, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/data'
import { fmtDateTime, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { Txn } from '../../lib/types'
import { Badge, Button, Empty, IconButton, Modal } from '../ui'
import type { HeldBill } from './cart'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** POS top bar: back, business name, clock, held bills, last receipt, language */
export function PosHeader({ heldCount, onHeld, lastSale, onReprint, extra }: {
  heldCount: number
  onHeld: () => void
  lastSale?: Txn
  onReprint: () => void
  /** more controls before the held bills button (godown picker) */
  extra?: ReactNode
}) {
  const { firm } = useData()
  const { t, lang, setLang } = useI18n()
  const now = useClock()
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-[#0c0a09] px-2 text-white sm:px-4">
      <Link to="/dashboard" className="grid size-9 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white" aria-label={t('navDashboard')} title={t('navDashboard')}>
        <ArrowLeft className="size-5 rtl:rotate-180" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold sm:text-base">{firm.name}</div>
        <div className="hidden text-[11px] text-white/55 sm:block">{t('navPos')}</div>
      </div>
      <div className="hidden items-center gap-1.5 text-sm text-white/75 md:flex" aria-live="off">
        <Clock className="size-4" />
        <span className="num">{date}</span>
        <span className="num font-semibold text-white">{time}</span>
      </div>
      {extra}
      <button
        type="button"
        onClick={onHeld}
        className="relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
        title={t('posHeldBills')}
      >
        <PauseCircle className="size-4" />
        <span className="hidden sm:inline">{t('posHeldBills')}</span>
        {heldCount > 0 && <span className="num rounded-full bg-amber-400 px-1.5 text-xs font-bold text-stone-900">{heldCount}</span>}
      </button>
      <button
        type="button"
        onClick={onReprint}
        disabled={!lastSale}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        title={lastSale ? t('posReprintN', { no: lastSale.number }) : t('posReprint')}
      >
        <Printer className="size-4" />
        <span className="hidden lg:inline">{t('posReprint')}</span>
      </button>
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
        title={t('language')}
      >
        <Languages className="size-4" /><span className="hidden sm:inline">{lang === 'en' ? 'اردو' : 'English'}</span>
      </button>
    </header>
  )
}

/** list of bills put on hold, to resume or discard */
export function HeldBillsModal({ open, onClose, bills, onResume, onDiscard }: {
  open: boolean
  onClose: () => void
  bills: HeldBill[]
  onResume: (b: HeldBill) => void
  onDiscard: (b: HeldBill) => void
}) {
  const { firm } = useData()
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={t('posHeldBills')}>
      {bills.length === 0 ? (
        <Empty icon={<PauseCircle className="size-6" />} title={t('posNoHeld')} text={t('posNoHeldText')} />
      ) : (
        <ul className="divide-y divide-stone-100">
          {bills.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-stone-900">{b.label || t('walkIn')}</div>
                <div className="num text-xs text-stone-500">{fmtDateTime(b.at)} · {t('posLinesN', { n: b.draft.lines.length })}</div>
              </div>
              <span className="num text-sm font-semibold">{fmtMoney(b.total, firm.currencySymbol)}</span>
              <Button size="sm" onClick={() => onResume(b)}><Play className="size-3.5" />{t('posResume')}</Button>
              <IconButton label={t('delete')} onClick={() => onDiscard(b)} className="hover:text-red-700"><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/** shown after a sale is saved: amount, change, print or start the next bill */
export function SaleDone({ txn, change, onPrint, onNew }: { txn: Txn | null; change: number; onPrint: () => void; onNew: () => void }) {
  const { firm } = useData()
  const { t } = useI18n()
  const sym = firm.currencySymbol
  const due = txn ? txn.total - txn.received : 0
  return (
    <Modal
      open={!!txn}
      onClose={onNew}
      size="sm"
      title={t('posSaleSaved')}
      footer={<>
        <Button variant="secondary" onClick={onPrint}><Printer className="size-4" />{t('posPrintReceipt')}</Button>
        <Button onClick={onNew} autoFocus>{t('posNewBill')}</Button>
      </>}
    >
      {txn && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <div className="num text-sm text-stone-500">{txn.number}</div>
          <div className="num text-3xl font-extrabold text-stone-900">{fmtMoney(txn.total, sym)}</div>
          {change > 0 && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <div className="text-xs font-medium text-emerald-800">{t('posChange')}</div>
              <div className="num text-2xl font-bold text-emerald-700">{fmtMoney(change, sym)}</div>
            </div>
          )}
          {due > 0.001 && <Badge tone="warn">{t('posDueN', { amount: fmtMoney(due, sym) })}</Badge>}
        </div>
      )}
    </Modal>
  )
}

/** keyboard shortcut legend at the bottom of the POS */
export function ShortcutLegend() {
  const { t } = useI18n()
  const keys: [string, string][] = [
    ['F2', t('posKeySearch')], ['F4', t('posKeyCustomer')], ['F7', t('posDiscount')], ['F8', t('posHold')],
    ['F9', t('posPay')], ['Esc', t('posClear')],
  ]
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200 bg-surface px-3 py-1.5 text-[11px] text-stone-500 lg:flex">
      {keys.map(([k, label]) => (
        <span key={k} className="flex items-center gap-1">
          <kbd className="num rounded border border-stone-300 bg-stone-50 px-1.5 py-px font-semibold text-stone-700">{k}</kbd>{label}
        </span>
      ))}
      <span className="flex items-center gap-1"><kbd className="num rounded border border-stone-300 bg-stone-50 px-1.5 py-px font-semibold text-stone-700">Ctrl+Enter</kbd>{t('posPay')}</span>
    </div>
  )
}
