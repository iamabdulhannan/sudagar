import { AlertTriangle, Plus } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useData } from '../../lib/data'
import { today, uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { Party, PartyKind, PriceTier } from '../../lib/types'
import { Button, Field, Input, Modal, NumberInput, Select, Textarea, Toggle, useUi } from '../ui'
import { findDuplicates, signedOpening } from './partyUtils'

interface Props {
  open: boolean
  onClose: () => void
  /** edit this party; omit to add a new one */
  initial?: Party
  /** default kind for a new party */
  kind?: PartyKind
  /** prefill the name of a new party (typed in a picker) */
  defaultName?: string
  onSaved?: (p: Party) => void
}

/** add / edit a customer or supplier */
export function PartyFormModal(p: Props) {
  if (!p.open) return null
  return <PartyForm {...p} />
}

function PartyForm({ onClose, initial, kind, defaultName, onSaved }: Props) {
  const { t } = useI18n()
  const { db, parties, partyGroups, settings } = useData()
  const { toast } = useUi()
  const formId = useId()

  const [d, setD] = useState<Party>(() => initial ?? {
    id: uid(), name: defaultName?.trim() ?? '', kind: kind ?? 'customer', openingBalance: 0, openingDate: today(),
    priceTier: 'retail', active: true, createdAt: Date.now(),
  })
  const [openAmt, setOpenAmt] = useState(Math.abs(initial?.openingBalance ?? 0))
  const [openDir, setOpenDir] = useState<'receive' | 'pay'>(() =>
    initial ? (initial.openingBalance < 0 ? 'pay' : 'receive') : kind === 'supplier' ? 'pay' : 'receive')
  const [newGroup, setNewGroup] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nameErr, setNameErr] = useState('')

  const set = (patch: Partial<Party>) => setD((x) => ({ ...x, ...patch }))
  const dup = useMemo(() => findDuplicates(parties, d), [parties, d])

  const addGroup = async () => {
    const name = (newGroup ?? '').trim()
    if (!name) { setNewGroup(null); return }
    const existing = partyGroups.find((g) => g.name.toLowerCase() === name.toLowerCase())
    if (existing) { set({ groupId: existing.id }); setNewGroup(null); return }
    const id = uid()
    await db.partyGroups.add({ id, name })
    set({ groupId: id })
    setNewGroup(null)
  }

  const submit = async (e: FormEvent) => {
    // the modal is portalled, but React events still bubble to a form around the picker
    e.preventDefault()
    e.stopPropagation()
    const name = d.name.trim().replace(/\s+/g, ' ')
    if (!name) { setNameErr(t('errRequired')); return }
    setBusy(true)
    try {
      const party: Party = {
        ...d,
        name,
        phone: d.phone?.trim() || undefined,
        email: d.email?.trim() || undefined,
        address: d.address?.trim() || undefined,
        city: d.city?.trim() || undefined,
        ntn: d.ntn?.trim() || undefined,
        notes: d.notes?.trim() || undefined,
        groupId: d.groupId || undefined,
        creditLimit: d.creditLimit && d.creditLimit > 0 ? d.creditLimit : undefined,
        openingBalance: signedOpening(openAmt, openDir),
        openingDate: d.openingDate || today(),
      }
      await db.transaction('rw', [db.parties, db.audit], async () => {
        await db.parties.put(party)
        await db.audit.add({ at: Date.now(), action: initial ? 'update' : 'create', entity: 'party', entityId: party.id, summary: `${party.name} ${party.openingBalance}` })
      })
      toast(t('saved'))
      onSaved?.(party)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('somethingWrong'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={initial ? t('pt_editParty') : t('pt_addParty')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form={formId} loading={busy}>{t('save')}</Button>
      </>}
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('pt_partyName')} required error={nameErr} className="sm:col-span-2">
          <Input
            value={d.name}
            autoFocus
            onChange={(e) => { set({ name: e.target.value }); setNameErr('') }}
            placeholder={t('pt_partyNamePh')}
          />
        </Field>

        <Field label={t('pt_partyType')} className="sm:col-span-2">
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {(['customer', 'supplier', 'both'] as PartyKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.kind === k}
                onClick={() => set({ kind: k })}
                className={
                  'h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ' +
                  (d.kind === k ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-600 hover:bg-stone-50')
                }
              >
                {t('pk_' + k)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('phone')}>
          <Input type="tel" inputMode="tel" value={d.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="03xx xxxxxxx" className="num" />
        </Field>
        <Field label={t('email')}>
          <Input type="email" value={d.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </Field>

        {(dup.byName || dup.byPhone) && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 sm:col-span-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              {dup.byName && <div>{t('pt_dupName', { name: dup.byName.name })}</div>}
              {dup.byPhone && <div>{t('pt_dupPhone', { name: dup.byPhone.name })}</div>}
            </div>
          </div>
        )}

        <Field label={t('address')} className="sm:col-span-2">
          <Textarea rows={2} value={d.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label={t('city')}>
          <Input value={d.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label={t('ntn')}>
          <Input value={d.ntn ?? ''} onChange={(e) => set({ ntn: e.target.value })} className="num" />
        </Field>

        <Field label={t('pt_group')} className="sm:col-span-2">
          {newGroup === null ? (
            <div className="flex gap-2">
              <Select value={d.groupId ?? ''} onChange={(e) => set({ groupId: e.target.value || undefined })}>
                <option value="">{t('pt_noGroup')}</option>
                {partyGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <Button variant="secondary" onClick={() => setNewGroup('')} aria-label={t('pt_newGroup')} title={t('pt_newGroup')}>
                <Plus className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={newGroup}
                placeholder={t('pt_groupNamePh')}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addGroup() }
                  if (e.key === 'Escape') { e.stopPropagation(); setNewGroup(null) }
                }}
              />
              <Button onClick={addGroup}>{t('add')}</Button>
              <Button variant="ghost" onClick={() => setNewGroup(null)}>{t('cancel')}</Button>
            </div>
          )}
        </Field>

        <fieldset className="rounded-xl border border-stone-200 p-3 sm:col-span-2">
          <legend className="px-1 text-[13px] font-semibold text-stone-700">{t('pt_openingBalance')}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('amount')}>
              <NumberInput value={openAmt} onValue={(n) => setOpenAmt(Math.abs(n))} placeholder="0" />
            </Field>
            <Field label={t('pt_direction')}>
              <Select value={openDir} onChange={(e) => setOpenDir(e.target.value as 'receive' | 'pay')}>
                <option value="receive">{t('pt_theyOweMe')}</option>
                <option value="pay">{t('pt_iOweThem')}</option>
              </Select>
            </Field>
            <Field label={t('pt_asOf')}>
              <Input type="date" value={d.openingDate} onChange={(e) => set({ openingDate: e.target.value })} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-stone-500">{t('pt_openingHint')}</p>
        </fieldset>

        <Field label={t('pt_creditLimit')} hint={t('pt_creditLimitHint')}>
          <NumberInput value={d.creditLimit} onValue={(n) => set({ creditLimit: n > 0 ? n : undefined })} placeholder="0" />
        </Field>
        {settings.features.wholesale && (
          <Field label={t('pt_priceTier')}>
            <Select value={d.priceTier} onChange={(e) => set({ priceTier: e.target.value as PriceTier })}>
              <option value="retail">{t('pt_tier_retail')}</option>
              <option value="wholesale">{t('pt_tier_wholesale')}</option>
            </Select>
          </Field>
        )}

        <Field label={t('notes')} className="sm:col-span-2">
          <Textarea rows={2} value={d.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        <div className="sm:col-span-2">
          <Toggle checked={d.active} onChange={(v) => set({ active: v })} label={t('active')} hint={t('pt_activeHint')} />
        </div>
      </form>
    </Modal>
  )
}
