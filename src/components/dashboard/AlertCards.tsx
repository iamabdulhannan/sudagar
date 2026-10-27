import { BellRing, ChevronRight, Landmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'

function LinkCard({ to, icon, title, value, hint, tone }: { to: string; icon: ReactNode; title: string; value: string; hint: string; tone: 'bad' | 'warn' }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-stone-200 bg-surface p-4 shadow-sm transition hover:border-brand-500 hover:shadow"
    >
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-lg', tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-stone-500">{title}</span>
        <span className="num block text-lg font-bold text-stone-900">{value}</span>
        <span className="block truncate text-xs text-stone-500">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-stone-400 group-hover:text-brand-700 rtl:rotate-180" />
    </Link>
  )
}

/** overdue customers to remind and cheques waiting to clear; only shown when there is something */
export function AlertCards({ overdue, cheques, symbol }: {
  overdue?: { parties: number; amount: number }
  cheques?: { countIn: number; inHand: number; countOut: number; issued: number }
  symbol: string
}) {
  const { t } = useI18n()
  const showOverdue = !!overdue && overdue.parties > 0
  const showCheques = !!cheques && cheques.countIn + cheques.countOut > 0
  if (!showOverdue && !showCheques) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showOverdue && (
        <LinkCard
          to="/reminders"
          tone="bad"
          icon={<BellRing className="size-5" />}
          title={t('dash_remindTitle')}
          value={fmtMoney(overdue!.amount, symbol)}
          hint={t('dash_remindHint', { n: overdue!.parties })}
        />
      )}
      {showCheques && (
        <LinkCard
          to="/cheques"
          tone="warn"
          icon={<Landmark className="size-5" />}
          title={t('dash_chequesTitle')}
          value={fmtMoney(cheques!.inHand, symbol)}
          hint={t('dash_chequesHint', { in: cheques!.countIn, out: cheques!.countOut, issued: fmtMoney(cheques!.issued, symbol) })}
        />
      )}
    </div>
  )
}
