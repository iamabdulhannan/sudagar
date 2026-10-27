import { scanLookup, useBarcodeScanner } from '../../../lib/scanner'
import { PackageSearch } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../../lib/data'
import { MAIN_GODOWN } from '../../../lib/db'
import { useI18n } from '../../../lib/i18n'
import { txnPath } from '../../../lib/paths'
import { TXN_META, lineFor } from '../../../lib/txn'
import type { ID, Item } from '../../../lib/types'
import { ItemSearch } from '../../items/ItemSearch'
import { PartyPicker } from '../../parties/PartyPicker'
import { Card, Field, Input, Select, Textarea, useUi } from '../../ui'
import { addOrIncrement, isInvoice, isReturn, itemSide, partySide, previewNumber, repriceLines } from '../logic'
import { lastRates, redeemPatch } from '../payLogic'
import { AddLineButton, LinesEditor, freeLine } from './LinesEditor'
import { LoyaltyRedeem } from './LoyaltyRedeem'
import { PartyBalance } from './PartyBalance'
import { BlockField } from './PaymentFields'
import { TotalsPanel } from './TotalsPanel'
import type { DraftApi } from './useDraft'
import { WarningNotes, sameGodown, useStockIn, type FormWarnings } from './warnings'

const SHIP_TO = new Set(['sale', 'estimate', 'sale_order', 'delivery_challan'])
const WALK_IN = new Set(['sale', 'estimate', 'sale_return'])

/** form for documents with item lines: invoices, bills, returns, estimates, orders, challans */
export function ItemDocForm({ api, warnings }: { api: DraftApi; warnings: FormWarnings }) {
  const { t } = useI18n()
  const { settings, partyById, itemById, txnById, txns, godowns, items } = useData()
  const { toast } = useUi()
  const { draft: d, update, original, isNew, fullPay } = api
  const type = d.type
  const meta = TXN_META[type]
  const f = settings.features
  const party = d.partyId ? partyById.get(d.partyId) : undefined
  const walkIn = WALK_IN.has(type)
  const source = d.sourceId ? txnById.get(d.sourceId) : undefined
  const against = d.againstId ? txnById.get(d.againstId) : undefined
  const stock = useStockIn(d.godownId)
  const keepOriginal = original && sameGodown(original.godownId, d.godownId) ? original : undefined
  // last rate this party got: from sale invoices on the sale side, purchase bills on the purchase side
  const rateSide = itemSide(type)
  const last = useMemo(() => lastRates(txns, d.partyId, rateSide, original?.id), [txns, d.partyId, rateSide, original?.id])
  const godownList = godowns.filter((g) => g.active || g.id === (d.godownId || MAIN_GODOWN))

  const onParty = (id: ID | undefined) => {
    const next = id ? partyById.get(id) : undefined
    update((x) => ({
      partyId: id,
      partyName: id ? undefined : x.partyName,
      partyPhone: id ? undefined : x.partyPhone,
      lines: repriceLines(x.lines, { lines: x.lines, party }, { lines: x.lines, party: next }, itemById, type, settings),
      // leaving walk-in: the forced full payment no longer applies
      received: !x.partyId && id && !fullPay ? 0 : x.received,
      // points belong to the customer they were redeemed for
      ...(x.pointsRedeemed && x.partyId !== id ? redeemPatch(x, 0, settings) : {}),
    }))
  }

  const addItem = (item: Item, qty = 1) => update((x) => ({ lines: addOrIncrement(x.lines, lineFor(item, itemSide(type), party, settings, qty)) }))
  // a barcode scanner adds lines wherever the cursor is
  useBarcodeScanner((code) => {
    const hit = scanLookup(items.filter((i) => i.active), code)
    if (hit) addItem(hit.item, hit.qty)
    else toast(t('posNotFound', { q: code }), 'error')
  })
  const addFree = () => update((x) => ({ lines: [...x.lines, freeLine()] }))

  const refLabel = type === 'purchase' || type === 'purchase_order' ? t('txSupplierBillNo') : isReturn(type) ? t('txAgainstInvoice') : t('txRefNo')

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <BlockField label={meta.side === 'sale' ? t('txCustomer') : t('txSupplier')} required={meta.partyRequired}>
              <PartyPicker value={d.partyId} onChange={onParty} side={partySide(type)} allowWalkIn={walkIn} autoFocus={isNew && !d.partyId} />
            </BlockField>
            <PartyBalance partyId={d.partyId} className="mt-1" />
            {!d.partyId && walkIn && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input value={d.partyName ?? ''} onChange={(e) => update({ partyName: e.target.value || undefined })} placeholder={t('txWalkInName')} aria-label={t('txWalkInName')} />
                <Input value={d.partyPhone ?? ''} onChange={(e) => update({ partyPhone: e.target.value || undefined })} placeholder={t('phone')} inputMode="tel" aria-label={t('phone')} className="num" />
              </div>
            )}
          </div>
          <Field label={t('txNumber')} hint={isNew ? t('txNumberHint') : undefined}>
            <Input value={isNew ? previewNumber(type, settings) : d.number} readOnly className="num bg-stone-50" />
          </Field>
          <Field label={t('date')} required>
            <Input type="date" value={d.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          {f.dueDates && isInvoice(type) && (
            <Field label={t('txDueDate')}>
              <Input type="date" value={d.dueDate ?? ''} min={d.date} onChange={(e) => update({ dueDate: e.target.value || undefined })} />
            </Field>
          )}
          {f.godowns && (
            <Field label={meta.stock === 1 ? t('txGodownIn') : t('txGodown')}>
              <Select value={d.godownId || MAIN_GODOWN} onChange={(e) => update({ godownId: e.target.value === MAIN_GODOWN ? undefined : e.target.value })}>
                {godownList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label={refLabel}>
            <Input value={d.refNo ?? ''} onChange={(e) => update({ refNo: e.target.value || undefined })} />
          </Field>
          {SHIP_TO.has(type) && (
            <Field label={t('txShipTo')} className="sm:col-span-2">
              <Textarea rows={2} value={d.shipTo ?? ''} onChange={(e) => update({ shipTo: e.target.value || undefined })} placeholder={party?.address ?? t('txShipToPh')} className="min-h-10" />
            </Field>
          )}
        </div>
        {(source || against) && (
          <p className="mt-3 text-sm text-stone-600">
            {source && <>{t('txConvertedFrom')}: <Link className="font-medium text-brand-700 hover:underline" to={txnPath(source.type, source.id)}>{t(TXN_META[source.type].label)} {source.number}</Link></>}
            {against && <>{t('txAgainstInvoice')}: <Link className="font-medium text-brand-700 hover:underline" to={txnPath(against.type, against.id)}>{t(TXN_META[against.type].label)} {against.number}</Link></>}
          </p>
        )}
      </Card>

      <Card title={t('txItems')} actions={<AddLineButton onClick={addFree} label={t('txAddFreeLine')} />} padded={false}>
        <div className="border-b border-stone-100 p-3">
          <ItemSearch onPick={addItem} side={itemSide(type)} placeholder={t('txAddItemPh')} autoFocus={!isNew || !!d.partyId} />
        </div>
        {d.lines.length ? (
          <div className="px-1 sm:px-2">
            <LinesEditor
              lines={d.lines}
              onChange={(lines) => update({ lines })}
              type={type}
              party={party}
              original={keepOriginal}
              stock={stock}
              lastRates={last}
              lastKey={rateSide === 'sale' ? 'txLastSold' : 'txLastBought'}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center text-sm text-stone-500">
            <PackageSearch className="size-8 text-stone-300" />
            {t('txNoLinesYet')}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <WarningNotes w={warnings} />
          {f.loyalty && type === 'sale' && d.partyId && <LoyaltyRedeem api={api} />}
          <Card>
            <Field label={t('notes')}>
              <Textarea rows={3} value={d.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} placeholder={t('txNotesPh')} />
            </Field>
          </Card>
        </div>
        <Card>
          <TotalsPanel api={api} />
        </Card>
      </div>
    </div>
  )
}
