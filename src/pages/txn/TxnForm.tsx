import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ExpenseForm } from '../../components/txn/form/ExpenseForm'
import { FormFooter, type SaveMode } from '../../components/txn/form/FormFooter'
import { ItemDocForm } from '../../components/txn/form/ItemDocForm'
import { MoneyDocForm } from '../../components/txn/form/MoneyDocForm'
import { initialDraft, useDraft, type DraftApi, type Initial } from '../../components/txn/form/useDraft'
import { useWarnings } from '../../components/txn/form/warnings'
import { isItemDoc, txnErrorText } from '../../components/txn/logic'
import { printTxn } from '../../components/print/printTxn'
import { Button, Card, Empty, PageHeader, useUi } from '../../components/ui'
import { useData } from '../../lib/data'
import { fmtQty } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { txnListPath, txnNewPath, txnPath } from '../../lib/paths'
import { TXN_META, saveTxn, typeFromSlug } from '../../lib/txn'
import type { TxnType } from '../../lib/types'

/** /txn/:slug/new and /txn/:slug/:id/edit for every transaction type */
export default function TxnForm() {
  const { slug = '', id } = useParams()
  const type = typeFromSlug(slug)
  const loc = useLocation()
  if (!type) return <Navigate to="/dashboard" replace />
  // stock transfers and manufacturing entries have their own screens
  if (type === 'stock_transfer') return <Navigate to={'/godowns' + (id ? `?edit=${id}` : '')} replace />
  if (type === 'manufacture') return <Navigate to={'/manufacturing' + (id ? `?edit=${id}` : '')} replace />
  // a new location (Save & new, another query) starts a fresh form
  return <FormLoader key={loc.key + type + (id ?? '')} type={type} id={id} />
}

function FormLoader({ type, id }: { type: TxnType; id?: string }) {
  const data = useData()
  const [q] = useSearchParams()
  const { t } = useI18n()
  const [init] = useState<Initial>(() => initialDraft(type, id, q, data))
  if (init.notFound) {
    return (
      <Card>
        <Empty title={t('txNotFound')} action={<Link to={txnListPath(type)}><Button variant="secondary">{t('back')}</Button></Link>} />
      </Card>
    )
  }
  if (init.original?.cancelled) return <Navigate to={txnPath(init.original.type, init.original.id)} replace />
  return <DraftForm init={init} />
}

function DraftForm({ init }: { init: Initial }) {
  const data = useData()
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const { draft, update, fullPay, setFullPay, dirty } = useDraft(init, data.settings)
  const [saving, setSaving] = useState(false)
  const type = draft.type
  const isNew = !init.original
  const api: DraftApi = { draft, update, original: init.original, isNew, fullPay, setFullPay }
  const warnings = useWarnings(draft, init.original)
  const name = t(TXN_META[type].label)

  const back = useCallback(async () => {
    if (dirty && !(await confirm({ title: t('txDiscardQ'), text: t('txDiscardText'), danger: true, okLabel: t('txDiscard') }))) return
    if (window.history.length > 1) navigate(-1)
    else navigate(txnListPath(type))
  }, [dirty, confirm, t, navigate, type])

  const save = async (mode: SaveMode) => {
    if (saving) return
    if (data.settings.negativeStock === 'block' && warnings.shortages.length) {
      const s = warnings.shortages[0]
      toast(t('errNegativeStock', { name: s.name, qty: fmtQty(s.inStock) }), 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await saveTxn(data.db, draft)
      toast(t('txSavedToast', { name: `${name} ${saved.number}` }))
      if (mode === 'print') printTxn(data, saved)
      if (mode === 'new') navigate(txnNewPath(type), { replace: true })
      else navigate(txnPath(type, saved.id), { replace: true })
    } catch (e) {
      toast(txnErrorText(e, t), 'error')
      setSaving(false)
    }
  }

  // keyboard: Ctrl/Cmd+S save, Ctrl/Cmd+Enter save & new, Esc back
  const keys = useRef({ save, back })
  keys.current = { save, back }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void keys.current.save('view') }
      else if (mod && e.key === 'Enter') { e.preventDefault(); void keys.current.save('new') }
      else if (e.key === 'Escape' && !e.defaultPrevented) {
        const active = document.activeElement as HTMLElement | null
        if (document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')) return
        if (active?.getAttribute('aria-expanded') === 'true') return
        void keys.current.back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const title = isNew ? t('txNewOf', { name }) : t('txEditOf', { name, number: draft.number })
  const subtitle = init.source ? t('txFromDoc', { name: `${t(TXN_META[init.source.type].label)} ${init.source.number}` }) : undefined

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        back={
          <button type="button" onClick={() => void back()} className="mb-1 inline-flex cursor-pointer items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('back')}
          </button>
        }
      />
      {isItemDoc(type) ? <ItemDocForm api={api} warnings={warnings} /> : type === 'expense' ? <ExpenseForm api={api} /> : <MoneyDocForm api={api} />}
      <FormFooter draft={draft} saving={saving} onSave={(m) => void save(m)} onBack={() => void back()} />
    </div>
  )
}
