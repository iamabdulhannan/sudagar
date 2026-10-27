import { FileDown, Gift, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { waLink } from '../components/parties/partyUtils'
import { RequirePerm } from '../components/security/RequirePerm'
import { Button, Card, Empty, PageHeader, SearchInput, Stat } from '../components/ui'
import { downloadCsv } from '../lib/csv'
import { useData } from '../lib/data'
import { today } from '../lib/db'
import { fmtMoney, fmtNum } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { partyPath } from '../lib/paths'
import { fillTemplate, loyaltyRows, type LoyaltyRow } from '../lib/reports'

export default function Loyalty() {
  return <RequirePerm perm="parties"><LoyaltyPage /></RequirePerm>
}

function LoyaltyPage() {
  const { t } = useI18n()
  const data = useData()
  const { settings, firm } = data
  const sym = firm.currencySymbol
  const [q, setQ] = useState('')
  const { rows, totals } = useMemo(() => loyaltyRows(data, settings), [data, settings])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const dq = s.replace(/\D/g, '')
    return s ? rows.filter((r) => r.name.toLowerCase().includes(s) || (dq.length >= 2 && (r.phone ?? '').replace(/\D/g, '').includes(dq))) : rows
  }, [rows, q])

  if (!settings.features.loyalty) {
    return (
      <Card>
        <Empty
          icon={<Gift className="size-7" />}
          title={t('ly_off')}
          text={t('ly_offText')}
          action={<Link to="/settings"><Button variant="secondary">{t('navSettings')}</Button></Link>}
        />
      </Card>
    )
  }

  const message = (r: LoyaltyRow) => fillTemplate(t('ly_waMsg'), {
    party: r.name, points: fmtNum(r.balance), value: fmtMoney(r.value, sym), firm: firm.name, phone: firm.phone ?? '',
  })
  const csv = () => downloadCsv(`loyalty-points-${today()}`, [t('name'), t('phone'), t('ly_earned'), t('ly_redeemed'), t('ly_balance'), t('ly_value')],
    shown.map((r) => [r.name, r.phone ?? '', r.earned, r.redeemed, r.balance, r.value]))

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('navLoyalty')}
        subtitle={t('ly_subtitle', { per: fmtMoney(settings.loyalty.earnPer, sym), value: fmtMoney(settings.loyalty.pointValue, sym) })}
        actions={<Button variant="secondary" onClick={csv} disabled={!shown.length}><FileDown className="size-4" />{t('exportCsv')}</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('ly_members')} value={fmtNum(rows.length)} />
        <Stat label={t('ly_earned')} value={fmtNum(totals.earned)} tone="brand" />
        <Stat label={t('ly_redeemed')} value={fmtNum(totals.redeemed)} />
        <Stat label={t('ly_outstanding')} value={fmtMoney(totals.value, sym)} tone="warn" hint={t('ly_pointsN', { n: fmtNum(totals.balance) })} />
      </div>
      <Card padded={false}>
        <div className="border-b border-stone-100 p-3"><SearchInput value={q} onChange={setQ} placeholder={t('ly_search')} className="max-w-sm" /></div>
        {shown.length === 0 ? (
          <Empty icon={<Gift className="size-7" />} title={rows.length ? t('noResults') : t('ly_none')} text={rows.length ? undefined : t('ly_noneText')} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('name')}</th><th>{t('phone')}</th><th className="r">{t('ly_earned')}</th><th className="r">{t('ly_redeemed')}</th>
                  <th className="r">{t('ly_balance')}</th><th className="r">{t('ly_value')}</th><th className="r">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const wa = r.balance > 0 ? waLink(r.phone, message(r)) : undefined
                  return (
                    <tr key={r.partyId}>
                      <td><Link to={partyPath(r.partyId)} className="font-medium text-brand-700 hover:underline">{r.name}</Link></td>
                      <td className="num text-stone-500" dir="ltr">{r.phone || '-'}</td>
                      <td className="r num">{fmtNum(r.earned)}</td>
                      <td className="r num">{fmtNum(r.redeemed)}</td>
                      <td className="r num font-semibold">{fmtNum(r.balance)}</td>
                      <td className="r num">{fmtMoney(r.value, sym)}</td>
                      <td className="r">
                        {wa
                          ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50"><MessageCircle className="size-4" />{t('ly_tell')}</a>
                          : <span className="text-xs text-stone-400">{r.balance > 0 ? t('rm_noPhone') : '-'}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
