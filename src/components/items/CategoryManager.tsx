import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { Category, ID } from '../../lib/types'
import { Button, IconButton, Input, Modal, useUi } from '../ui'

/** add, rename and delete item categories (delete only when no item uses it) */
export function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, items, categories } = useData()
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: ID; name: string } | null>(null)

  const counts = useMemo(() => {
    const m = new Map<ID, number>()
    for (const i of items) if (i.categoryId) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1)
    return m
  }, [items])

  const exists = (n: string, except?: ID) => categories.some((c) => c.id !== except && c.name.trim().toLowerCase() === n.trim().toLowerCase())

  async function add() {
    const n = name.trim()
    if (!n) return
    if (exists(n)) { toast(t('itCatExists'), 'error'); return }
    await db.categories.add({ id: uid(), name: n })
    setName('')
  }

  async function rename() {
    if (!editing) return
    const n = editing.name.trim()
    if (!n) return
    if (exists(n, editing.id)) { toast(t('itCatExists'), 'error'); return }
    await db.categories.update(editing.id, { name: n })
    setEditing(null)
  }

  async function remove(c: Category) {
    if (counts.get(c.id)) { toast(t('itCatInUse', { n: counts.get(c.id)! }), 'error'); return }
    if (!(await confirm({ title: t('itCatDelete', { name: c.name }), danger: true, okLabel: t('delete') }))) return
    await db.categories.delete(c.id)
    toast(t('deleted'))
  }

  return (
    <Modal open={open} onClose={onClose} title={t('itCategories')} footer={<Button variant="secondary" onClick={onClose}>{t('done')}</Button>}>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('itCategoryName')} autoFocus />
        <Button type="submit" disabled={!name.trim()}><Plus className="size-4" />{t('add')}</Button>
      </form>
      {categories.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{t('nothingYet')}</p>}
      <ul className="divide-y divide-stone-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            {editing?.id === c.id ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); rename() }}>
                <Input
                  value={editing.name}
                  autoFocus
                  onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } }}
                />
                <IconButton label={t('save')} type="submit" className="text-emerald-700"><Check className="size-4" /></IconButton>
                <IconButton label={t('cancel')} onClick={() => setEditing(null)}><X className="size-4" /></IconButton>
              </form>
            ) : (
              <>
                <span className="flex-1 truncate text-sm text-stone-800">{c.name}</span>
                <span className="num text-xs text-stone-500">{t('itItemsCount', { n: counts.get(c.id) ?? 0 })}</span>
                <IconButton label={t('edit')} onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil className="size-4" /></IconButton>
                <IconButton label={t('delete')} onClick={() => remove(c)} disabled={!!counts.get(c.id)} className="hover:text-red-700">
                  <Trash2 className="size-4" />
                </IconButton>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
