import { Warehouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GodownList } from '../../components/stock/GodownList'
import { GodownStockTable } from '../../components/stock/GodownStockTable'
import { GodownSummary } from '../../components/stock/GodownSummary'
import { FeatureOff } from '../../components/stock/StockBits'
import { TransferForm } from '../../components/stock/TransferForm'
import { TransferList } from '../../components/stock/TransferList'
import { PageHeader, Tabs } from '../../components/ui'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { Txn } from '../../lib/types'

type Tab = 'stock' | 'transfers' | 'summary' | 'godowns'
const TABS: Tab[] = ['stock', 'transfers', 'summary', 'godowns']

/** godowns / branches: stock in each, transfers between them, a summary report, and the list itself */
export default function Godowns() {
  const { settings, godowns, txns, txnById } = useData()
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'stock') as Tab
  const [editing, setEditing] = useState<Txn | null>(null)

  // ?edit=<txnId> (from the transaction view) opens that transfer for editing
  useEffect(() => {
    const id = params.get('edit')
    if (!id) return
    const x = txnById.get(id)
    if (x?.type === 'stock_transfer') setEditing(x)
    setParams({ tab: 'transfers' }, { replace: true })
  }, [params, setParams, txnById])

  if (!settings.features.godowns) {
    return (
      <div>
        <PageHeader title={t('navGodowns')} />
        <FeatureOff icon={<Warehouse className="size-6" />} title={t('stGodownsOffTitle')} text={t('stGodownsOffText')} />
      </div>
    )
  }

  const transfers = txns.filter((x) => x.type === 'stock_transfer').length
  return (
    <div>
      <PageHeader title={t('navGodowns')} subtitle={t('stGodownsSub')} />
      <div className="rounded-xl border border-stone-200 bg-surface shadow-sm">
        <Tabs
          className="px-3 pt-1"
          value={tab}
          onChange={(v) => setParams(v === 'stock' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'stock', label: t('stTabStock') },
            { value: 'transfers', label: t('tp_stock_transfer'), count: transfers },
            { value: 'summary', label: t('stGodownSummary') },
            { value: 'godowns', label: t('navGodowns'), count: godowns.length },
          ]}
        />
        {tab === 'stock' && <GodownStockTable />}
        {tab === 'transfers' && <TransferList />}
        {tab === 'summary' && <GodownSummary />}
        {tab === 'godowns' && <GodownList />}
      </div>
      <TransferForm open={!!editing} initial={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  )
}
