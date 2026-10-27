import { CheckCircle2, Download, FileUp, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { downloadCsv, parseCsv } from '../../lib/csv'
import { useData } from '../../lib/data'
import { fmtMoney, fmtQty } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, Modal, useUi } from '../ui'
import { ITEM_CSV_HEADERS, ITEM_CSV_SAMPLE, readItemRows, resolveCategories, type ImportResult } from './itemCsv'

const PREVIEW = 300

/** import items from a CSV file: template, preview with row errors, then save the good rows */
export function ImportItems({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, items, categories, settings, firm } = useData()
  const { t } = useI18n()
  const { toast } = useUi()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setResult(null); setFileName('') } }, [open])

  const good = result?.rows.filter((r) => r.problems.length === 0) ?? []
  const bad = (result?.rows.length ?? 0) - good.length

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setResult(readItemRows(parseCsv(text), items, settings))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    if (!good.length) return
    setSaving(true)
    try {
      const { create, items: toAdd } = resolveCategories(good, categories)
      await db.transaction('rw', [db.items, db.categories, db.audit], async () => {
        if (create.length) await db.categories.bulkAdd(create)
        await db.items.bulkAdd(toAdd)
        await db.audit.add({ at: Date.now(), action: 'create', entity: 'item', entityId: 'import', summary: `import ${toAdd.length} items` })
      })
      toast(t('itImpDone', { n: toAdd.length }))
      onClose()
    } catch {
      toast(t('somethingWrong'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const template = () => downloadCsv('saudagar-items-template', [...ITEM_CSV_HEADERS], ITEM_CSV_SAMPLE)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('itImport')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save} loading={saving} disabled={!good.length}>{t('itImpSave', { n: good.length })}</Button>
      </>}
    >
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 ps-5 text-sm text-stone-600">
          <li>{t('itImpStep1')}</li>
          <li>{t('itImpStep2')}</li>
          <li>{t('itImpStep3')}</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={template}><Download className="size-4" />{t('itImpTemplate')}</Button>
          <Button onClick={() => fileRef.current?.click()}><FileUp className="size-4" />{t('itImpChoose')}</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          {fileName && <span className="self-center truncate text-sm text-stone-500">{fileName}</span>}
        </div>

        {result?.fileProblem && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{t(result.fileProblem.key, result.fileProblem.vars)}</div>
        )}

        {result && !result.fileProblem && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone="good"><CheckCircle2 className="size-3.5" />{t('itImpGood', { n: good.length })}</Badge>
              {bad > 0 && <Badge tone="bad"><XCircle className="size-3.5" />{t('itImpBad', { n: bad })}</Badge>}
            </div>
            <div className="table-wrap max-h-[45dvh] rounded-lg border border-stone-200">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="r">#</th><th>{t('name')}</th><th>{t('itCategory')}</th><th>{t('unit')}</th>
                    <th className="r">{t('itSalePrice')}</th><th className="r">{t('itPurchasePrice')}</th><th className="r">{t('itOpeningStock')}</th><th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, PREVIEW).map((r) => (
                    <tr key={r.line} className={r.problems.length ? 'bg-red-50' : undefined}>
                      <td className="r num text-stone-500">{r.line}</td>
                      <td className="font-medium">{r.item.name || '-'}<span className="ms-1 text-xs text-stone-500">{r.item.code}</span></td>
                      <td>{r.categoryName}</td>
                      <td>{r.item.unit}</td>
                      <td className="r num">{fmtMoney(r.item.salePrice, firm.currencySymbol)}</td>
                      <td className="r num">{fmtMoney(r.item.purchasePrice, firm.currencySymbol)}</td>
                      <td className="r num">{r.item.kind === 'product' ? fmtQty(r.item.openingStock) : '-'}</td>
                      <td>
                        {r.problems.length === 0
                          ? <Badge tone="good">{t('itImpOk')}</Badge>
                          : <span className="text-xs text-red-700">{r.problems.map((p) => t(p.key, p.vars)).join(' ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > PREVIEW && <p className="text-xs text-stone-500">{t('itImpMore', { n: result.rows.length - PREVIEW })}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
