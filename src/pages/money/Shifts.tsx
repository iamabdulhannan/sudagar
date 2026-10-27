import { Printer, ScanBarcode, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { printShiftReport, ShiftNumbers } from '../../components/shift/ShiftModals'
import { Badge, Button, Card, Empty, Modal, Money, PageHeader } from '../../components/ui'
import { useData } from '../../lib/data'
import { fmtDateTime } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { deviceId, summarizeShift } from '../../lib/shift'
import type { Shift } from '../../lib/types'

/** every cash shift with its expected and counted cash, and the drawer log */
export default function Shifts() {
  const { t } = useI18n()
  const data = useData()
  const { shifts, txns, firm } = data
  const [open, setOpen] = useState<Shift | null>(null)
  const me = deviceId()
  const rows = useMemo(() => shifts.map((s) => ({ s, expected: s.expectedCash ?? summarizeShift(s, txns).expected })), [shifts, txns])
  const sym = firm.currencySymbol

  return (
    <div>
      <PageHeader title={t('sh_shifts')} actions={<Link to="/pos"><Button><ScanBarcode className="size-4" />{t('sh_goPos')}</Button></Link>} />
      {rows.length === 0 ? (
        <Card><Empty icon={<Timer className="size-7" />} title={t('sh_none')} text={t('sh_noneText')} action={<Link to="/pos"><Button>{t('sh_goPos')}</Button></Link>} /></Card>
      ) : (
        <Card padded={false}>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('sh_shift')}</th><th>{t('sh_register')}</th><th>{t('sh_opened_at')}</th><th>{t('sh_closed_at')}</th>
                  <th className="r">{t('sh_openingFloat')}</th><th className="r">{t('sh_expected')}</th><th className="r">{t('sh_counted')}</th><th className="r">{t('sh_difference')}</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, expected }) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setOpen(s)}>
                    <td className="font-semibold">
                      {s.number}{' '}
                      <Badge tone={s.status === 'open' ? 'good' : 'neutral'}>{t('sh_status_' + s.status)}</Badge>
                      {s.status === 'open' && s.deviceId !== me && <span className="ms-1 text-xs text-stone-500">{t('sh_otherDevice')}</span>}
                    </td>
                    <td>{s.register}</td>
                    <td className="num text-sm">{fmtDateTime(s.openedAt)}<div className="text-xs text-stone-500">{s.openedBy}</div></td>
                    <td className="num text-sm">{s.closedAt ? <>{fmtDateTime(s.closedAt)}<div className="text-xs text-stone-500">{s.closedBy}</div></> : ''}</td>
                    <td className="r"><Money value={s.openingFloat} symbol={sym} /></td>
                    <td className="r"><Money value={expected} symbol={sym} /></td>
                    <td className="r">{s.countedCash !== undefined ? <Money value={s.countedCash} symbol={sym} /> : ''}</td>
                    <td className="r">{s.difference !== undefined ? (s.difference === 0 ? <Badge tone="good">{t('sh_exact')}</Badge> : <Money value={s.difference} symbol={sym} tone />) : ''}</td>
                    <td className="r"><Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); printShiftReport(data, s, s.status === 'closed' ? 'z' : 'x') }} aria-label={t('sh_reprint')}><Printer className="size-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${t('sh_shift')} ${open.number} · ${open.register}` : ''} size="lg"
        footer={open && <Button variant="secondary" onClick={() => printShiftReport(data, open, open.status === 'closed' ? 'z' : 'x')}><Printer className="size-4" />{t('sh_reprint')}</Button>}>
        {open && (
          <div className="space-y-4">
            <ShiftNumbers shift={open} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-stone-800">{t('sh_log')}</h3>
              {open.moves.length === 0 ? <p className="text-sm text-stone-500">{t('sh_noMoves')}</p> : (
                <ul className="divide-y divide-stone-100 text-sm">
                  {open.moves.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <span className="num w-36 shrink-0 text-xs text-stone-500">{fmtDateTime(m.at)}</span>
                      <span className="flex-1">{t(m.type === 'pay_in' ? 'sh_payIn' : m.type === 'pay_out' ? 'sh_payOut' : m.type === 'drop' ? 'sh_drop' : 'sh_noSale')}{m.reason ? ` · ${m.reason}` : ''} <span className="text-xs text-stone-500">({m.by})</span></span>
                      {m.amount > 0 && <Money value={m.type === 'pay_in' ? m.amount : -m.amount} symbol={sym} tone />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {open.notes && <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{open.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
