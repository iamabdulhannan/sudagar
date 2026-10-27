import { Banknote, HandCoins, Landmark, Smartphone } from 'lucide-react'
import { cx } from '../../lib/cx'
import type { AccountKind } from '../../lib/types'

const TONES: Record<AccountKind, string> = {
  cash: 'bg-emerald-100 text-emerald-800',
  bank: 'bg-sky-100 text-sky-800',
  wallet: 'bg-amber-100 text-amber-800',
  loan: 'bg-red-100 text-red-800',
}

/** round icon for a cash, bank, wallet or loan account */
export function AccountIcon({ kind, className }: { kind: AccountKind; className?: string }) {
  const Icon = kind === 'cash' ? Banknote : kind === 'bank' ? Landmark : kind === 'loan' ? HandCoins : Smartphone
  return (
    <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', TONES[kind], className)}>
      <Icon className="size-5" />
    </span>
  )
}
