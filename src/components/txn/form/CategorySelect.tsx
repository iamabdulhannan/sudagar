import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../../../lib/data'
import { uid } from '../../../lib/db'
import { useI18n } from '../../../lib/i18n'
import type { ID, MoneyCategoryKind } from '../../../lib/types'
import { Button, Field, IconButton, Input, Modal, Select, useUi } from '../../ui'

/** expense or income head picker with an inline "add new head" */
export function CategorySelect({ kind, value, onChange }: { kind: MoneyCategoryKind; value?: ID; onChange: (id: ID | undefined) => void }) {
  const { t } = useI18n()
  const { moneyCategories, db } = useData()
  const { toast } = useUi()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const list = moneyCategories.filter((c) => c.kind === kind)
  const label = t(kind === 'expense' ? 'txExpenseHead' : 'txIncomeHead')

  const add = async () => {
    const n = name.trim()
    if (!n) return
    const existing = list.find((c) => c.name.toLowerCase() === n.toLowerCase())
    if (existing) { onChange(existing.id) } else {
      const id = uid()
      await db.moneyCategories.add({ id, kind, name: n })
      onChange(id)
      toast(t('saved'))
    }
    setAdding(false)
    setName('')
  }

  return (
    <>
      <Field label={label}>
        <div className="flex gap-1.5">
          <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className="min-w-0 flex-1">
            <option value="">{t('la_other')}</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <IconButton label={t('txAddHead')} onClick={() => setAdding(true)} className="size-10 shrink-0 border border-stone-300">
            <Plus className="size-4" />
          </IconButton>
        </div>
      </Field>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('txAddHead')}
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setAdding(false)}>{t('cancel')}</Button>
          <Button onClick={add} disabled={!name.trim()}>{t('add')}</Button>
        </>}
      >
        <Field label={t('name')} required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
            placeholder={kind === 'expense' ? t('txHeadPh') : t('txIncomeHeadPh')}
          />
        </Field>
      </Modal>
    </>
  )
}
