import { useState } from 'react'
import { useData } from '../../../lib/data'
import { useI18n } from '../../../lib/i18n'
import type { ID } from '../../../lib/types'
import { PartyPicker } from '../../parties/PartyPicker'
import { Card, Field, Input, NumberInput, Textarea, Toggle } from '../../ui'
import { previewNumber } from '../logic'
import { AddLineButton, LinesEditor, freeLine } from './LinesEditor'
import { CategorySelect } from './CategorySelect'
import { PartyBalance } from './PartyBalance'
import { BlockField } from './PaymentFields'
import { TotalsPanel } from './TotalsPanel'
import type { DraftApi } from './useDraft'

/** expense voucher: head, optional supplier, a single amount or itemised lines, payment */
export function ExpenseForm({ api }: { api: DraftApi }) {
  const { t } = useI18n()
  const { settings } = useData()
  const { draft: d, update, isNew, fullPay } = api
  const [itemised, setItemised] = useState(d.lines.length > 0)

  const onParty = (id: ID | undefined) => update((x) => ({ partyId: id, received: !x.partyId && id && !fullPay ? 0 : x.received }))
  const toggleLines = (on: boolean) => {
    setItemised(on)
    if (on && !d.lines.length) update({ lines: [{ ...freeLine(), rate: d.total, name: '' }] })
    if (!on) update((x) => ({ lines: [], total: x.total }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CategorySelect kind="expense" value={d.categoryId} onChange={(id) => update({ categoryId: id })} />
          <Field label={t('date')} required>
            <Input type="date" value={d.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          <Field label={t('txNumber')}>
            <Input value={isNew ? previewNumber('expense', settings) : d.number} readOnly className="num bg-stone-50" />
          </Field>
          <Field label={t('txBillNo')}>
            <Input value={d.refNo ?? ''} onChange={(e) => update({ refNo: e.target.value || undefined })} />
          </Field>
          <div className="sm:col-span-2">
            <BlockField label={<>{t('txPaidToParty')} <span className="font-normal text-stone-400">({t('optional')})</span></>}>
              <PartyPicker value={d.partyId} onChange={onParty} side="purchase" />
            </BlockField>
            <PartyBalance partyId={d.partyId} className="mt-1" />
          </div>
          {!itemised && (
            <Field label={t('amount')} required className="sm:col-span-2 lg:col-span-1">
              <NumberInput value={d.total} onValue={(n) => update({ total: n })} className="h-11 text-end text-lg font-semibold" autoFocus={isNew} />
            </Field>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
          <Toggle checked={itemised} onChange={toggleLines} label={t('txItemised')} hint={t('txItemisedHint')} />
        </div>
        {itemised && (
          <div className="border-t border-stone-100 px-1 pb-2 sm:px-2">
            <LinesEditor lines={d.lines} onChange={(lines) => update({ lines })} type="expense" />
            <div className="px-2 pt-2">
              <AddLineButton onClick={() => update((x) => ({ lines: [...x.lines, freeLine()] }))} label={t('txAddLine')} />
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <Field label={t('notes')}>
            <Textarea rows={3} value={d.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} />
          </Field>
        </Card>
        <Card>
          <TotalsPanel api={api} showTotals={itemised} />
        </Card>
      </div>
    </div>
  )
}
