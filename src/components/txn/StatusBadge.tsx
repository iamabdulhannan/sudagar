import { Badge } from '../ui'
import { useI18n } from '../../lib/i18n'
import type { Txn } from '../../lib/types'
import { STATUS_TONE, statusKey, type DocStatus } from './logic'

/** paid / partly paid / unpaid / overdue / open / converted / cancelled */
export function StatusBadge({ status, className }: { status?: DocStatus; className?: string }) {
  const { t } = useI18n()
  if (!status) return null
  return <Badge tone={STATUS_TONE[status]} className={className}>{t(statusKey(status))}</Badge>
}

/** in hand / issued, cleared or bounced, for payments by cheque */
export function ChequeBadge({ txn, className }: { txn: Pick<Txn, 'type' | 'chequeStatus' | 'paymentMode'>; className?: string }) {
  const { t } = useI18n()
  const s = txn.paymentMode === 'cheque' ? txn.chequeStatus : undefined
  if (!s) return null
  const key = s === 'open' ? (txn.type === 'payment_in' ? 'chq_open_in' : 'chq_open_out') : 'chq_' + s
  return <Badge tone={s === 'open' ? 'warn' : s === 'cleared' ? 'good' : 'bad'} className={className}>{t(key)}</Badge>
}
