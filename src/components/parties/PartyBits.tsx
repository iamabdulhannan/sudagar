import { cx } from '../../lib/cx'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { PartyKind } from '../../lib/types'
import { Badge } from '../ui'
import { balanceDir } from './partyUtils'

/** party balance with its direction: green "To receive", red "To pay", grey "Settled" */
export function BalanceText({ value, symbol, className, inline, big, align = 'end' }: {
  value: number; symbol: string; className?: string; inline?: boolean; big?: boolean
  /** stacked layout: line up at the end, the start, or the start on phones and the end from md up */
  align?: 'end' | 'start' | 'mdEnd'
}) {
  const { t } = useI18n()
  const dir = balanceDir(value)
  const tone = dir === 'receive' ? 'text-emerald-700' : dir === 'pay' ? 'text-red-700' : 'text-stone-500'
  const label = dir === 'receive' ? t('receivable') : dir === 'pay' ? t('payable') : t('pt_settled')
  return (
    <span className={cx(
      inline ? 'inline-flex items-baseline gap-1.5' : 'inline-flex flex-col',
      !inline && (align === 'end' ? 'items-end' : align === 'start' ? 'items-start' : 'items-start md:items-end'),
      className,
    )}>
      <span className={cx('num whitespace-nowrap font-semibold', tone, big && 'text-2xl sm:text-3xl font-bold')}>
        {fmtMoney(Math.abs(value), symbol)}
      </span>
      <span className={cx('text-[11px] font-medium', tone)}>{label}</span>
    </span>
  )
}

export function KindBadge({ kind }: { kind: PartyKind }) {
  const { t } = useI18n()
  const tone = kind === 'customer' ? 'info' : kind === 'supplier' ? 'warn' : 'brand'
  return <Badge tone={tone}>{t('pk_' + kind)}</Badge>
}
