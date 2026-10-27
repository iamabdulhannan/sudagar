import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { ID } from '../../lib/types'
import { Button, IconButton, Input, Modal, useUi } from '../ui'

/** add, rename and delete party groups (a group in use cannot be deleted) */
export function GroupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { db, partyGroups, parties } = useData()
  const { toast, confirm } = useUi()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<ID | null>(null)
  const [editName, setEditName] = useState('')

  const counts = useMemo(() => {
    const m = new Map<ID, number>()
    for (const p of parties) if (p.groupId) m.set(p.groupId, (m.get(p.groupId) ?? 0) + 1)
    return m
  }, [parties])

  const exists = (n: string, except?: ID) => partyGroups.some((g) => g.id !== except && g.name.trim().toLowerCase() === n.trim().toLowerCase())

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (exists(n)) { toast(t('pt_groupExists'), 'error'); return }
    await db.partyGroups.add({ id: uid(), name: n })
    setName('')
  }

  const rename = async () => {
    const n = editName.trim()
    if (!editId || !n) return
    if (exists(n, editId)) { toast(t('pt_groupExists'), 'error'); return }
    await db.partyGroups.update(editId, { name: n })
    setEditId(null)
    toast(t('saved'))
  }

  const remove = async (id: ID, gname: string) => {
    if (counts.get(id)) { toast(t('pt_groupInUse'), 'error'); return }
    if (!(await confirm({ title: t('pt_deleteGroupQ', { name: gname }), danger: true, okLabel: t('delete') }))) return
    await db.partyGroups.delete(id)
    toast(t('deleted'))
  }

  return (
    <Modal open={open} onClose={onClose} title={t('pt_manageGroups')} footer={<Button variant="secondary" onClick={onClose}>{t('done')}</Button>}>
      <p className="mb-3 text-sm text-stone-500">{t('pt_groupsHint')}</p>
      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          placeholder={t('pt_groupNamePh')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button onClick={add} disabled={!name.trim()}><Plus className="size-4" />{t('add')}</Button>
      </div>
      {partyGroups.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">{t('pt_noGroups')}</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {partyGroups.map((g) => (
            <li key={g.id} className="flex items-center gap-2 px-3 py-2">
              {editId === g.id ? (
                <>
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); rename() }
                      if (e.key === 'Escape') { e.stopPropagation(); setEditId(null) }
                    }}
                    className="h-9"
                  />
                  <IconButton label={t('save')} onClick={rename}><Check className="size-4" /></IconButton>
                  <IconButton label={t('cancel')} onClick={() => setEditId(null)}><X className="size-4" /></IconButton>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium text-stone-800">{g.name}</span>
                  <span className="text-xs text-stone-500">{t('pt_nParties', { n: counts.get(g.id) ?? 0 })}</span>
                  <IconButton label={t('edit')} onClick={() => { setEditId(g.id); setEditName(g.name) }}><Pencil className="size-4" /></IconButton>
                  <IconButton
                    label={counts.get(g.id) ? t('pt_groupInUse') : t('delete')}
                    disabled={!!counts.get(g.id)}
                    onClick={() => remove(g.id, g.name)}
                    className="hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
