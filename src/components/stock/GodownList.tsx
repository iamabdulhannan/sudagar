import { Pencil, Plus, Power, Trash2, Warehouse } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { MAIN_GODOWN, uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { Godown } from '../../lib/types'
import { Badge, Button, Field, IconButton, Input, Modal, Money, Textarea, useUi } from '../ui'
import { godownSummary } from './stockLogic'
import { useCost, useGodownStock } from './useStock'

/** godowns / branches: add, rename, deactivate; the main one cannot be removed */
export function GodownList() {
  const { db, godowns, items, txns, adjustments, firm } = useData()
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const stock = useGodownStock()
  const cost = useCost()
  const [editing, setEditing] = useState<Godown | 'new' | null>(null)

  const summary = useMemo(() => new Map(godownSummary(items, stock, godowns, cost.ofItem).rows.map((r) => [r.godown.id, r])), [items, stock, godowns, cost])
  const used = (g: Godown) => txns.some((x) => x.godownId === g.id || x.toGodownId === g.id) || adjustments.some((a) => a.godownId === g.id)

  async function toggle(g: Godown) {
    const s = summary.get(g.id)
    if (g.active && s && (s.items > 0 || s.negative > 0)) {
      const ok = await confirm({ title: t('stDeactivateTitle', { name: g.name }), text: t('stDeactivateStock', { n: s.items + s.negative }), okLabel: t('itDeactivate') })
      if (!ok) return
    }
    await db.transaction('rw', [db.godowns, db.audit], async () => {
      await db.godowns.put({ ...g, active: !g.active })
      await db.audit.add({ at: Date.now(), action: 'update', entity: 'godown', entityId: g.id, summary: `${g.name} ${g.active ? 'deactivated' : 'activated'}` })
    })
    toast(g.active ? t('stGodownOff') : t('stGodownOn'))
  }

  async function remove(g: Godown) {
    if (used(g)) {
      await confirm({ title: t('stCannotDelete'), text: t('stCannotDeleteText'), okLabel: t('close') })
      return
    }
    if (!(await confirm({ title: t('stDeleteGodown', { name: g.name }), text: t('cannotUndo'), danger: true, okLabel: t('delete') }))) return
    await db.transaction('rw', [db.godowns, db.audit], async () => {
      await db.godowns.delete(g.id)
      await db.audit.add({ at: Date.now(), action: 'delete', entity: 'godown', entityId: g.id, summary: g.name })
    })
    toast(t('deleted'))
  }

  return (
    <div>
      <div className="flex justify-end p-3">
        <Button onClick={() => setEditing('new')}><Plus className="size-4" />{t('stAddGodown')}</Button>
      </div>
      <ul className="grid gap-3 p-3 pt-0 sm:grid-cols-2 xl:grid-cols-3">
        {godowns.map((g) => {
          const s = summary.get(g.id)
          const main = g.id === MAIN_GODOWN
          return (
            <li key={g.id} className={`rounded-xl border border-stone-200 p-4 ${g.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Warehouse className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold text-stone-900">{g.name}</span>
                    {main && <Badge tone="brand">{t('stMain')}</Badge>}
                    {!g.active && <Badge>{t('inactive')}</Badge>}
                  </div>
                  {g.address && <p className="mt-0.5 truncate text-xs text-stone-500">{g.address}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-stone-600">{t('stItemsInStock')}: <b className="num text-stone-900">{s?.items ?? 0}</b></span>
                    <span className="text-stone-600">{t('itStockValue')}: <Money value={s?.value ?? 0} symbol={firm.currencySymbol} className="font-semibold text-stone-900" /></span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-1 border-t border-stone-100 pt-2">
                <IconButton label={t('edit')} onClick={() => setEditing(g)}><Pencil className="size-4" /></IconButton>
                {!main && <IconButton label={g.active ? t('itDeactivate') : t('itActivate')} onClick={() => toggle(g)}><Power className="size-4" /></IconButton>}
                {!main && <IconButton label={t('delete')} onClick={() => remove(g)} className="hover:text-red-700"><Trash2 className="size-4" /></IconButton>}
              </div>
            </li>
          )
        })}
      </ul>
      <GodownFormModal godown={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function GodownFormModal({ godown, onClose }: { godown: Godown | 'new' | null; onClose: () => void }) {
  const { db, godowns } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const initial = godown && godown !== 'new' ? godown : undefined

  useEffect(() => {
    if (!godown) return
    setName(initial?.name ?? '')
    setAddress(initial?.address ?? '')
    setError('')
  }, [godown])

  async function save() {
    const n = name.trim()
    if (!n) { setError(t('errRequired')); return }
    if (godowns.some((g) => g.id !== initial?.id && g.name.trim().toLowerCase() === n.toLowerCase())) { setError(t('stErrDupGodown')); return }
    setSaving(true)
    try {
      const g: Godown = initial
        ? { ...initial, name: n, address: address.trim() || undefined }
        : { id: uid(), name: n, address: address.trim() || undefined, active: true, createdAt: Date.now() }
      await db.transaction('rw', [db.godowns, db.audit], async () => {
        await db.godowns.put(g)
        await db.audit.add({ at: Date.now(), action: initial ? 'update' : 'create', entity: 'godown', entityId: g.id, summary: g.name })
      })
      toast(t('saved'))
      onClose()
    } catch {
      toast(t('somethingWrong'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!godown}
      onClose={onClose}
      size="sm"
      title={initial ? t('stEditGodown') : t('stAddGodown')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving}>{t('save')}</Button>
      </>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label={t('stGodownName')} required error={error || undefined}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setError('') }} autoFocus placeholder={t('stGodownNamePh')} />
        </Field>
        <Field label={t('address')} hint={t('optional')}>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
