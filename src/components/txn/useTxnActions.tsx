import { useAccess } from '../../lib/access'
import { today } from '../../lib/db'
import { ArrowRightLeft, Ban, Copy, Eye, Pencil, Printer, Share2, Trash2, Undo2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { txnEditPath, txnNewPath, txnPath } from '../../lib/paths'
import { cancelTxn, deleteTxn, TXN_META } from '../../lib/txn'
import type { PrintSize, Txn, TxnType } from '../../lib/types'
import { printTxn, shareTxnWhatsApp } from '../print/printTxn'
import { useUi } from '../ui'
import { convertQuery, convertTargets, isReturn, isStockDoc, txnErrorText } from './logic'
import type { MenuItem } from './Menu'

/** the actions available on a document, shared by the list rows and the view page */
export function useTxnActions() {
  const { can } = useAccess()
  const data = useData()
  const { t } = useI18n()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()

  const label = (x: Txn) => `${t(TXN_META[x.type].label)} ${x.number}`

  const a = {
    view: (x: Txn) => navigate(txnPath(x.type, x.id)),
    edit: (x: Txn) => navigate(txnEditPath(x.type, x.id)),
    print: (x: Txn, size?: PrintSize) => printTxn(data, x, size),
    share: (x: Txn) => shareTxnWhatsApp(data, x),
    duplicate: (x: Txn) => navigate(txnNewPath(x.type, 'dup=' + x.id)),
    convert: (x: Txn, to: TxnType) => navigate(txnNewPath(to, convertQuery(x, to))),
    cancel: async (x: Txn) => {
      const ok = await confirm({ title: t('txCancelQ', { name: label(x) }), text: t('txCancelText'), danger: true, okLabel: t('txCancelDoc') })
      if (!ok) return false
      try {
        await cancelTxn(data.db, x)
      } catch (e) {
        toast(txnErrorText(e, t), 'error')
        return false
      }
      toast(t('txCancelledToast', { name: label(x) }))
      return true
    },
    remove: async (x: Txn) => {
      const ok = await confirm({ title: t('txDeleteQ', { name: label(x) }), text: t('txDeleteToBin'), danger: true, okLabel: t('delete') })
      if (!ok) return false
      try {
        await deleteTxn(data.db, x)
      } catch (e) {
        toast(txnErrorText(e, t), 'error')
        return false
      }
      toast(t('txMovedToBin'))
      return true
    },
  }

  /** menu items for a conversion (estimate → invoice, invoice → return ...) */
  const convertItems = (x: Txn): MenuItem[] => convertTargets(x, data.settings.features).map((to) => ({
    label: isReturn(to) ? t('txMakeReturn') : t('txConvertTo', { name: t(TXN_META[to].label) }),
    icon: isReturn(to) ? <Undo2 /> : <ArrowRightLeft />,
    onClick: () => a.convert(x, to),
  }))

  // staff roles: entries before today need "editPast"; cancel and delete need "delete"
  const canEdit = (x: Txn) => can('editPast') || x.date >= today()
  const canDelete = can('delete')

  /** the "more" menu of a list row */
  const rowMenu = (x: Txn): MenuItem[] => [
    { label: t('txView'), icon: <Eye />, onClick: () => a.view(x) },
    { label: t('edit'), icon: <Pencil />, onClick: () => a.edit(x), hidden: !!x.cancelled || isStockDoc(x.type) || !canEdit(x) },
    { label: t('print'), icon: <Printer />, onClick: () => a.print(x) },
    { label: t('txWhatsApp'), icon: <Share2 />, onClick: () => a.share(x) },
    { label: t('duplicate'), icon: <Copy />, onClick: () => a.duplicate(x), divider: true, hidden: isStockDoc(x.type) },
    ...convertItems(x),
    { label: t('txCancelDoc'), icon: <Ban />, onClick: () => { void a.cancel(x) }, hidden: !!x.cancelled || !canDelete, danger: true, divider: true },
    { label: t('delete'), icon: <Trash2 />, onClick: () => { void a.remove(x) }, danger: true, hidden: !canDelete },
  ]

  return { ...a, convertItems, rowMenu, canEdit, canDelete }
}
