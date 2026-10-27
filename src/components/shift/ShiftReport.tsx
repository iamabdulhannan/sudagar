import { fmtDateTime, fmtMoney } from '../../lib/format'
import type { ShiftSummary } from '../../lib/shift'
import type { Firm, PaymentMode, Shift } from '../../lib/types'

/**
 * X / Z report on an 80 mm or 58 mm roll. It uses no React context (printNode renders it on its
 * own), so words come in through `t`.
 */
export function ShiftReport({ firm, shift, sum, t, kind }: { firm: Firm; shift: Shift; sum: ShiftSummary; t: (k: string, v?: Record<string, string | number>) => string; kind: 'x' | 'z' }) {
  const m = (n: number) => fmtMoney(n, firm.currencySymbol)
  const row = (label: string, value: string, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: bold ? 700 : 400 }}><span>{label}</span><span>{value}</span></div>
  )
  const line = <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
  const c = sum.cash
  return (
    <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11, color: '#000', width: '100%', lineHeight: 1.45 }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{firm.name}</div>
      <div style={{ textAlign: 'center', fontWeight: 700 }}>{kind === 'z' ? t('sh_zReport') : t('sh_xReport')}</div>
      {line}
      {row(t('sh_shift'), shift.number)}
      {row(t('sh_register'), shift.register)}
      {row(t('sh_opened_at'), `${fmtDateTime(shift.openedAt)} · ${shift.openedBy}`)}
      {shift.closedAt && row(t('sh_closed_at'), `${fmtDateTime(shift.closedAt)} · ${shift.closedBy ?? ''}`)}
      {line}
      <div style={{ fontWeight: 700 }}>{t('sh_sales')}</div>
      {row(t('sh_bills'), String(sum.saleCount))}
      {row(t('sh_sales'), m(sum.saleTotal), true)}
      {row(t('sh_returns'), `${sum.returnCount} · ${m(sum.returnTotal)}`)}
      {row(t('sh_discounts'), m(sum.discountTotal))}
      {sum.taxTotal > 0 && row(t('sh_tax'), m(sum.taxTotal))}
      {sum.creditSales > 0 && row(t('sh_credit'), m(sum.creditSales))}
      {line}
      <div style={{ fontWeight: 700 }}>{t('sh_byMode')}</div>
      {(Object.keys(sum.byMode) as PaymentMode[]).map((k) => <div key={k}>{row(t('pm_' + k), m(sum.byMode[k] ?? 0))}</div>)}
      {line}
      <div style={{ fontWeight: 700 }}>{t('sh_cashFlow')}</div>
      {row(t('sh_openingFloat'), m(shift.openingFloat))}
      {row(t('sh_cashSales'), m(c.sales))}
      {c.refunds !== 0 && row(t('sh_refunds'), m(c.refunds))}
      {c.receipts !== 0 && row(t('sh_receipts'), m(c.receipts))}
      {c.payments !== 0 && row(t('sh_payments'), m(c.payments))}
      {c.other !== 0 && row(t('sh_other'), m(c.other))}
      {c.payIns !== 0 && row(t('sh_payIns'), m(c.payIns))}
      {c.payOuts !== 0 && row(t('sh_payOuts'), m(c.payOuts))}
      {c.drops !== 0 && row(t('sh_drops'), m(c.drops))}
      {row(t('sh_expected'), m(sum.expected), true)}
      {kind === 'z' && shift.countedCash !== undefined && (
        <>
          {row(t('sh_counted'), m(shift.countedCash), true)}
          {row(t('sh_difference'), (shift.difference ?? 0) === 0 ? t('sh_exact') : `${m(shift.difference ?? 0)} (${(shift.difference ?? 0) > 0 ? t('sh_over') : t('sh_short')})`, true)}
          {shift.closingCount && Object.entries(shift.closingCount).filter(([, n]) => n).length > 0 && (
            <>
              {line}
              {Object.entries(shift.closingCount).filter(([, n]) => n).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, n]) => <div key={d}>{row(`${d} × ${n}`, m(Number(d) * n))}</div>)}
            </>
          )}
        </>
      )}
      {shift.moves.length > 0 && (
        <>
          {line}
          <div style={{ fontWeight: 700 }}>{t('sh_log')}</div>
          {shift.moves.map((mv) => (
            <div key={mv.id}>{row(`${fmtDateTime(mv.at).split(', ').pop()} ${t(mv.type === 'pay_in' ? 'sh_payIn' : mv.type === 'pay_out' ? 'sh_payOut' : mv.type === 'drop' ? 'sh_drop' : 'sh_noSale')}${mv.reason ? ' · ' + mv.reason : ''}`, mv.amount ? m(mv.amount) : '')}</div>
          ))}
        </>
      )}
      {shift.notes && (<>{line}<div>{shift.notes}</div></>)}
      {kind === 'z' && (<div style={{ marginTop: 24, borderTop: '1px solid #000', paddingTop: 2, textAlign: 'center' }}>{t('sh_signature')}</div>)}
    </div>
  )
}
