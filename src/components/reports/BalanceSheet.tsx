import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtMoney, round2 } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { acctName, balanceOf, balanceSheet } from '../../lib/ledger'
import { accountPath, reportPath } from '../../lib/paths'
import { DateFilter, ReportShell, usePeriodLabel } from './ReportShell'
import { section, type ReportDoc } from './ReportTable'
import type { StmtRow } from './statement'

/** what the business owns and owes on a date; both sides must be equal */
export default function BalanceSheet() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const [asOf, setAsOf] = useState(today())
  const label = usePeriodLabel()
  const bs = useMemo(() => balanceSheet(books, asOf), [books, asOf])
  const names = { accounts: data.accounts, parties: data.parties, cats: data.moneyCategories }
  const diff = round2(bs.totalAssets - bs.totalLiabilities)
  const cash = round2(bs.cashBank.reduce((a, x) => a + x.amount, 0))

  const capitalAdded = round2(-balanceOf(books, 'capital', asOf))
  const openingCapital = round2(bs.capital - capitalAdded)
  const loanTotal = round2(bs.loans.reduce((a, x) => a + x.amount, 0))
  const ownerTotal = round2(bs.capital - bs.drawings + bs.profit)

  const assets: StmtRow[] = [
    { label: t('rp_cashBank'), amount: cash, style: 'total' },
    ...bs.cashBank.filter((x) => x.amount !== 0).map((x): StmtRow => ({ label: acctName(x.acct, names, t), amount: x.amount, style: 'indent', href: accountPath(x.acct.slice(4)) })),
    ...(bs.chequesInHand ? [{ label: t('la_cheques_in'), amount: bs.chequesInHand, href: reportPath('cheques') }] : []),
    { label: t('rp_receivables'), amount: bs.receivables, href: reportPath('partybalances') },
    { label: t('la_inventory'), amount: bs.inventory, href: reportPath('stock') },
    ...(bs.taxCredit ? [{ label: t('rp_taxCredit'), amount: bs.taxCredit }] : []),
  ]
  const liabilities: StmtRow[] = [
    { label: t('rp_payables'), amount: bs.payables, href: reportPath('partybalances') },
    ...(bs.chequesIssued ? [{ label: t('la_cheques_out'), amount: bs.chequesIssued, href: reportPath('cheques') }] : []),
    ...(bs.taxPayable ? [{ label: t('rp_taxPayable'), amount: bs.taxPayable, href: reportPath('tax') }] : []),
    ...(bs.loans.some((x) => x.amount !== 0) ? [
      { label: t('rp_loans'), amount: loanTotal, style: 'total' as const, href: reportPath('loans') },
      ...bs.loans.filter((x) => x.amount !== 0).map((x): StmtRow => ({ label: acctName(x.acct, names, t), amount: x.amount, style: 'indent', href: accountPath(x.acct.slice(4)) })),
    ] : []),
    { label: t('rp_ownerEquity'), amount: ownerTotal, style: 'total', href: reportPath('capital') },
    { label: t('la_opening_equity'), amount: openingCapital, style: 'indent' },
    ...(capitalAdded ? [{ label: t('la_capital'), amount: capitalAdded, style: 'indent' as const }] : []),
    ...(bs.drawings ? [{ label: t('rp_lessDrawings'), amount: -bs.drawings, style: 'indent' as const }] : []),
    { label: bs.profit < 0 ? t('rp_lossToDate') : t('rp_profitToDate'), amount: bs.profit, style: 'indent', href: reportPath('pl') },
  ]
  const cols = (title: string) => [
    { key: 'label', label: title, value: (r: StmtRow) => r.label, href: (r: StmtRow) => r.href },
    { key: 'amount', label: t('amount'), kind: 'money' as const, value: (r: StmtRow) => r.amount, tone: true },
  ]
  const doc: ReportDoc = {
    summary: [
      { label: t('rp_totalAssets'), value: bs.totalAssets, kind: 'money', tone: 'brand' },
      { label: t('rp_totalLiabilities'), value: bs.totalLiabilities, kind: 'money', tone: 'brand' },
      { label: t('rp_check'), value: diff === 0 ? t('rp_balanced') : t('rp_difference', { amount: fmtMoney(diff, data.firm.currencySymbol) }), tone: diff === 0 ? 'good' : 'bad' },
    ],
    sections: [
      section<StmtRow>({ title: t('rp_assets'), cols: cols(t('rp_assets')), rows: assets, foot: { amount: bs.totalAssets }, footLabel: t('rp_totalAssets'), rowStyle: (r) => r.style }),
      section<StmtRow>({ title: t('rp_liabilities'), cols: cols(t('rp_liabilities')), rows: liabilities, foot: { amount: bs.totalLiabilities }, footLabel: t('rp_totalLiabilities'), rowStyle: (r) => r.style, note: t('rp_bsNote') }),
    ],
  }
  return (
    <ReportShell
      title={t('rp_bs')}
      period={label.asOf(asOf)}
      fileName="balance-sheet"
      doc={doc}
      filters={<DateFilter value={asOf} onChange={setAsOf} />}
      extra={
        <div className={diff === 0
          ? 'no-print flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800'
          : 'no-print flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800'}>
          {diff === 0 ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
          {diff === 0 ? t('rp_bsBalanced') : t('rp_bsNotBalanced', { amount: fmtMoney(diff, data.firm.currencySymbol) })}
        </div>
      }
    />
  )
}
