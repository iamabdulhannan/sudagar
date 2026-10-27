import { Factory, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BomList } from '../../components/stock/BomList'
import { ManufactureForm } from '../../components/stock/ManufactureForm'
import { ManufactureList } from '../../components/stock/ManufactureList'
import { ProductionRegister } from '../../components/stock/ProductionRegister'
import { FeatureOff } from '../../components/stock/StockBits'
import { Button, PageHeader, Tabs } from '../../components/ui'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { ID, Txn } from '../../lib/types'

type Tab = 'entries' | 'boms' | 'register'
const TABS: Tab[] = ['entries', 'boms', 'register']

/** manufacturing: make finished goods from raw materials, recipes (BOMs) and the production register */
export default function Manufacturing() {
  const { settings, txns, items, txnById } = useData()
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'entries') as Tab
  const [form, setForm] = useState<{ initial?: Txn; itemId?: ID } | null>(null)

  // ?make=<itemId> opens the form for that item (item page); ?edit=<txnId> edits an entry (transaction view)
  useEffect(() => {
    const make = params.get('make')
    const edit = params.get('edit')
    if (!make && !edit) return
    const initial = edit ? txnById.get(edit) : undefined
    if (make) setForm({ itemId: make })
    else if (initial?.type === 'manufacture') setForm({ initial })
    const p = new URLSearchParams(params)
    p.delete('make')
    p.delete('edit')
    setParams(p, { replace: true })
  }, [params, setParams, txnById])

  if (!settings.features.manufacturing) {
    return (
      <div>
        <PageHeader title={t('navManufacturing')} />
        <FeatureOff icon={<Factory className="size-6" />} title={t('stMfgOffTitle')} text={t('stMfgOffText')} />
      </div>
    )
  }

  const count = txns.filter((x) => x.type === 'manufacture').length
  const boms = items.filter((i) => i.kind === 'product' && i.bom?.length).length
  return (
    <div>
      <PageHeader
        title={t('navManufacturing')}
        subtitle={t('stMfgSub')}
        actions={<Button onClick={() => setForm({})}><Plus className="size-4" />{t('stMakeItems')}</Button>}
      />
      <div className="rounded-xl border border-stone-200 bg-surface shadow-sm">
        <Tabs
          className="px-3 pt-1"
          value={tab}
          onChange={(v) => setParams(v === 'entries' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'entries', label: t('tp_manufacture'), count },
            { value: 'boms', label: t('stBoms'), count: boms },
            { value: 'register', label: t('stRegister') },
          ]}
        />
        {tab === 'entries' && <ManufactureList onMake={() => setForm({})} onEdit={(x) => setForm({ initial: x })} />}
        {tab === 'boms' && <BomList onMake={(itemId) => setForm({ itemId })} />}
        {tab === 'register' && <ProductionRegister />}
      </div>
      <ManufactureForm open={!!form} initial={form?.initial} defaultItemId={form?.itemId} onClose={() => setForm(null)} />
    </div>
  )
}
