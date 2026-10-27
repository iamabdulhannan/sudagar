import { useMemo } from 'react'
import { useData } from '../../lib/data'
import { fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { partyPath } from '../../lib/paths'
import { loyaltyRows, type LoyaltyRow } from '../../lib/reports'
import { ReportShell } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'

/** loyalty points per customer: earned, spent, left and what they are worth */
export default function LoyaltyReport() {
  const { t } = useI18n()
  const data = useData()
  const { settings, firm } = data
  const { rows, totals } = useMemo(() => loyaltyRows(data, settings), [data, settings])
  const doc: ReportDoc = {
    summary: [
      { label: t('ly_members'), value: rows.length, kind: 'int' },
      { label: t('ly_earned'), value: totals.earned, kind: 'int', tone: 'brand' },
      { label: t('ly_redeemed'), value: totals.redeemed, kind: 'int' },
      { label: t('ly_outstanding'), value: totals.value, kind: 'money', tone: 'warn' },
    ],
    sections: [
      section<LoyaltyRow>({
        cols: [
          { key: 'name', label: t('name'), value: (r) => r.name, href: (r) => partyPath(r.partyId), sub: (r) => r.phone },
          { key: 'earned', label: t('ly_earned'), kind: 'int', value: (r) => r.earned },
          { key: 'redeemed', label: t('ly_redeemed'), kind: 'int', value: (r) => r.redeemed },
          { key: 'balance', label: t('ly_balance'), kind: 'int', value: (r) => r.balance, tone: true },
          { key: 'value', label: t('ly_value'), kind: 'money', value: (r) => r.value },
        ],
        rows,
        foot: { earned: totals.earned, redeemed: totals.redeemed, balance: totals.balance, value: totals.value },
        empty: t('ly_none'),
        rowKey: (r) => r.partyId,
        note: t('ly_rule', { per: fmtMoney(settings.loyalty.earnPer, firm.currencySymbol), value: fmtMoney(settings.loyalty.pointValue, firm.currencySymbol) }),
      }),
    ],
  }
  return <ReportShell title={t('rp_loyalty')} period={t('rp_allDates')} fileName="loyalty-points" doc={doc} />
}
