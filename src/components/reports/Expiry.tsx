import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { today } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import { itemPath } from '../../lib/paths'
import { batchExpiry, type BatchRow, type ExpiryStatus } from '../../lib/reports'
import { ChoiceFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

type Show = '' | 'expired' | 'd30' | 'd90'

/** stock left in each batch with its expiry: expired, within 30 days, within 90 days */
export default function Expiry() {
  const { t } = useI18n()
  const data = useData()
  const [show, setShow] = useState<Show>('')
  const asOf = today()
  const label = usePeriodLabel()
  const all = useMemo(() => batchExpiry(data, asOf).rows, [data, asOf])
  const rows = all.filter((r) => !show || r.status === show || (show === 'd90' && r.status === 'd30'))
  const count = (s: ExpiryStatus) => all.filter((r) => r.status === s).length
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_exp_expired'), value: count('expired'), kind: 'int', tone: 'bad' },
      { label: t('rp_exp_d30'), value: count('d30'), kind: 'int', tone: 'warn' },
      { label: t('rp_exp_d90'), value: count('d90'), kind: 'int' },
      { label: t('rp_batches'), value: all.length, kind: 'int' },
    ],
    sections: [section<BatchRow>({
      cols: [
        { key: 'name', label: t('rp_item'), value: (r) => r.name, href: (r) => itemPath(r.itemId) },
        { key: 'batch', label: t('rp_batch'), value: (r) => r.batch, className: 'num' },
        { key: 'expiry', label: t('rp_expiryDate'), kind: 'date', value: (r) => r.expiry },
        { key: 'days', label: t('rp_daysLeft'), kind: 'int', value: (r) => r.days, tone: true },
        { key: 'qty', label: t('qty'), kind: 'qty', value: (r) => r.qty, sub: (r) => r.unit },
        { key: 'status', label: t('status'), value: (r) => t('rp_exp_' + r.status) },
      ],
      rows,
      rowStyle: (r) => (r.status === 'expired' ? 'bad' : undefined),
      empty: t('rp_noBatches'),
      rowKey: (r) => r.itemId + r.batch,
    })],
  }
  return (
    <ReportShell
      title={t('rp_expiry')}
      period={label.asOf(asOf)}
      fileName="batch-expiry"
      doc={doc}
      filters={<ChoiceFilter label={t('status')} value={show} onChange={setShow} options={[['', t('all')], ['expired', t('rp_exp_expired')], ['d30', t('rp_exp_d30')], ['d90', t('rp_exp_d90')]]} />}
    />
  )
}
