import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { uid } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { ID, MoneyCategoryKind } from '../../lib/types'
import { Button, Card, IconButton, Input, useUi } from '../ui'

/** expense heads and other-income heads, side by side */
export function MoneyHeads() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <HeadList kind="expense" />
      <HeadList kind="income" />
    </div>
  )
}

function HeadList({ kind }: { kind: MoneyCategoryKind }) {
  const { t } = useI18n()
  const { db, moneyCategories, txns } = useData()
  const { toast, confirm } = useUi()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<ID | null>(null)
  const [editName, setEditName] = useState('')

  const heads = moneyCategories.filter((c) => c.kind === kind)
  const used = useMemo(() => {
    const m = new Map<ID, number>()
    for (const x of txns) if (x.categoryId) m.set(x.categoryId, (m.get(x.categoryId) ?? 0) + 1)
    return m
  }, [txns])

  const taken = (n: string, except?: ID) => heads.some((c) => c.id !== except && c.name.trim().toLowerCase() === n.trim().toLowerCase())

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (taken(n)) { toast(t('cb_headExists'), 'error'); return }
    await db.moneyCategories.add({ id: uid(), kind, name: n })
    setName('')
  }
  const rename = async () => {
    const n = editName.trim()
    if (!editId || !n) return
    if (taken(n, editId)) { toast(t('cb_headExists'), 'error'); return }
    await db.moneyCategories.update(editId, { name: n })
    setEditId(null)
    toast(t('saved'))
  }
  const remove = async (id: ID, n: string) => {
    if (used.get(id)) { toast(t('cb_headInUse'), 'error'); return }
    if (!(await confirm({ title: t('cb_deleteHeadQ', { name: n }), danger: true, okLabel: t('delete') }))) return
    await db.moneyCategories.delete(id)
    toast(t('deleted'))
  }

  return (
    <Card title={kind === 'expense' ? t('cb_expenseHeads') : t('cb_incomeHeads')} padded={false}>
      <div className="flex gap-2 p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'expense' ? t('cb_expenseHeadPh') : t('cb_incomeHeadPh')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button onClick={add} disabled={!name.trim()}><Plus className="size-4" />{t('add')}</Button>
      </div>
      {heads.length === 0 ? (
        <p className="px-4 pb-6 text-center text-sm text-stone-500">{t('nothingYet')}</p>
      ) : (
        <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto border-t border-stone-100">
          {heads.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-1.5">
              {editId === c.id ? (
                <>
                  <Input
                    autoFocus
                    value={editName}
                    className="h-9"
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); rename() }
                      if (e.key === 'Escape') setEditId(null)
                    }}
                  />
                  <IconButton label={t('save')} onClick={rename}><Check className="size-4" /></IconButton>
                  <IconButton label={t('cancel')} onClick={() => setEditId(null)}><X className="size-4" /></IconButton>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm text-stone-800">{c.name}</span>
                  {!!used.get(c.id) && <span className="text-xs text-stone-500">{t('cb_nUsed', { n: used.get(c.id)! })}</span>}
                  <IconButton label={t('edit')} onClick={() => { setEditId(c.id); setEditName(c.name) }}><Pencil className="size-4" /></IconButton>
                  <IconButton
                    label={used.get(c.id) ? t('cb_headInUse') : t('delete')}
                    disabled={!!used.get(c.id)}
                    onClick={() => remove(c.id, c.name)}
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
    </Card>
  )
}
