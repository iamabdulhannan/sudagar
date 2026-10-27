import { useLiveQuery } from 'dexie-react-hooks'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { binSorted } from '../components/cash/moneyLogic'
import { txnErrorText } from '../components/txn/logic'
import { Button, Card, Empty, Money, PageHeader, useUi } from '../components/ui'
import { useData } from '../lib/data'
import { fmtDate, fmtDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { TXN_META, restoreTxn } from '../lib/txn'
import type { BinEntry } from '../lib/types'

/** /recycle-bin: deleted transactions, newest first, to restore or delete for good */
export default function RecycleBin() {
  const { t } = useI18n()
  const { db, firm, partyById } = useData()
  const { toast, confirm } = useUi()
  const raw = useLiveQuery(() => db.bin.toArray(), [db])
  const entries = useMemo(() => binSorted(raw ?? []), [raw])
  const sym = firm.currencySymbol

  const name = (e: BinEntry) => `${t(TXN_META[e.txn.type].label)} ${e.txn.number}`
  const party = (e: BinEntry) => (e.txn.partyId ? partyById.get(e.txn.partyId)?.name : undefined) ?? e.txn.partyName ?? ''

  const restore = async (e: BinEntry) => {
    try {
      await restoreTxn(db, e.id)
      toast(t('binRestored', { name: name(e) }))
    } catch (err) {
      toast(txnErrorText(err, t), 'error')
    }
  }
  const purge = async (e: BinEntry) => {
    if (!(await confirm({ title: t('binDeleteQ', { name: name(e) }), text: t('cannotUndo'), danger: true, okLabel: t('binDeleteForever') }))) return
    await db.bin.delete(e.id)
    toast(t('deleted'))
  }
  const empty = async () => {
    if (!(await confirm({ title: t('binEmptyQ', { n: entries.length }), text: t('cannotUndo'), danger: true, okLabel: t('binEmpty') }))) return
    await db.bin.clear()
    toast(t('binEmptied'))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('navBin')}
        subtitle={t('binSubtitle')}
        actions={entries.length > 0 && <Button variant="danger" onClick={() => void empty()}><Trash2 className="size-4" />{t('binEmpty')}</Button>}
      />
      {raw === undefined ? null : entries.length === 0 ? (
        <Card><Empty icon={<Trash2 className="size-7" />} title={t('binNone')} text={t('binNoneText')} /></Card>
      ) : (
        <Card padded={false}>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('type')}</th>
                  <th>{t('number')}</th>
                  <th>{t('date')}</th>
                  <th>{t('txParty')}</th>
                  <th className="r">{t('amount')}</th>
                  <th>{t('binDeletedAt')}</th>
                  <th className="r"><span className="sr-only">{t('actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{t(TXN_META[e.txn.type].label)}</td>
                    <td className="num font-medium">{e.txn.number}</td>
                    <td className="num whitespace-nowrap text-stone-600">{fmtDate(e.txn.date)}</td>
                    <td className="max-w-56 truncate">{party(e) || <span className="text-stone-400">-</span>}</td>
                    <td className="r font-semibold"><Money value={e.txn.total} symbol={sym} /></td>
                    <td className="num whitespace-nowrap text-xs text-stone-500">{fmtDateTime(e.deletedAt)}</td>
                    <td className="r">
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="secondary" onClick={() => void restore(e)}><RotateCcw className="size-3.5" />{t('binRestore')}</Button>
                        <Button size="xs" variant="ghost" className="text-red-700" onClick={() => void purge(e)}><Trash2 className="size-3.5" />{t('binDeleteForever')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
