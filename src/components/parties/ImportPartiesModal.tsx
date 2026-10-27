import { AlertTriangle, CheckCircle2, Download, FileUp, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { downloadCsv, parseCsv } from '../../lib/csv'
import { useData } from '../../lib/data'
import { today, uid } from '../../lib/db'
import { fmtDate, fmtMoney } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { ID, Party, PartyGroup } from '../../lib/types'
import { Badge, Button, Modal, useUi } from '../ui'
import { PARTY_CSV_HEADER, PARTY_CSV_SAMPLE, parsePartyCsv, type PartyCsvRow } from './partyUtils'

/** import parties (with opening balances) from a CSV file, with a checked preview first */
export function ImportPartiesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { db, parties, partyGroups, firm } = useData()
  const { toast } = useUi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<PartyCsvRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => { setRows(null); setFileName(''); setError(''); if (fileRef.current) fileRef.current.value = '' }
  const close = () => { reset(); onClose() }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setFileName(f.name)
    setError('')
    try {
      const res = parsePartyCsv(parseCsv(await f.text()), { existing: parties, today: today() })
      if (res.error) { setError(t(res.error)); setRows(null) } else setRows(res.rows)
    } catch {
      setError(t('pt_csvUnreadable'))
      setRows(null)
    }
  }

  const good = rows?.filter((r) => r.errors.length === 0) ?? []
  const bad = (rows?.length ?? 0) - good.length

  const doImport = async () => {
    if (!good.length) return
    setBusy(true)
    try {
      const now = Date.now()
      const groupByName = new Map(partyGroups.map((g) => [g.name.trim().toLowerCase(), g.id]))
      const newGroups: PartyGroup[] = []
      const groupId = (name?: string): ID | undefined => {
        if (!name) return undefined
        const k = name.trim().toLowerCase()
        let id = groupByName.get(k)
        if (!id) { id = uid(); groupByName.set(k, id); newGroups.push({ id, name: name.trim() }) }
        return id
      }
      const list: Party[] = good.map((r, i) => ({
        id: uid(), name: r.name, kind: r.kind, phone: r.phone, email: r.email, address: r.address, city: r.city, ntn: r.ntn,
        groupId: groupId(r.group), openingBalance: r.openingBalance, openingDate: r.openingDate, creditLimit: r.creditLimit,
        priceTier: 'retail', notes: r.notes, active: true, createdAt: now + i,
      }))
      await db.transaction('rw', [db.parties, db.partyGroups, db.audit], async () => {
        if (newGroups.length) await db.partyGroups.bulkAdd(newGroups)
        await db.parties.bulkAdd(list)
        await db.audit.bulkAdd(list.map((p) => ({ at: now, action: 'create' as const, entity: 'party' as const, entityId: p.id, summary: `import ${p.name} ${p.openingBalance}` })))
      })
      toast(t('pt_imported', { n: list.length }))
      close()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('somethingWrong'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={t('pt_importTitle')}
      footer={<>
        <Button variant="secondary" onClick={close}>{t('cancel')}</Button>
        {rows && <Button onClick={doImport} loading={busy} disabled={!good.length}>{t('pt_importN', { n: good.length })}</Button>}
      </>}
    >
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 ps-5 text-sm text-stone-600">
          <li>{t('pt_importStep1')}</li>
          <li>{t('pt_importStep2')}</li>
          <li>{t('pt_importStep3')}</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadCsv('parties-template.csv', PARTY_CSV_HEADER, PARTY_CSV_SAMPLE)}>
            <Download className="size-4" />{t('pt_downloadTemplate')}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" />{fileName ? t('pt_chooseOther') : t('pt_chooseFile')}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {fileName && <span className="self-center text-sm text-stone-500">{fileName}</span>}
        </div>
        <p className="text-xs text-stone-500">{t('pt_importColumns')}</p>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><XCircle className="size-4 shrink-0" />{error}</div>
        )}

        {rows && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone="good"><CheckCircle2 className="size-3.5" />{t('pt_rowsReady', { n: good.length })}</Badge>
              {bad > 0 && <Badge tone="bad"><XCircle className="size-3.5" />{t('pt_rowsSkipped', { n: bad })}</Badge>}
            </div>
            <div className="table-wrap max-h-[50dvh] rounded-xl border border-stone-200">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('pt_line')}</th><th>{t('name')}</th><th>{t('type')}</th><th>{t('phone')}</th><th>{t('city')}</th>
                    <th className="r">{t('pt_openingBalance')}</th><th>{t('date')}</th><th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? 'bg-red-50/60' : undefined}>
                      <td className="num text-stone-500">{r.line}</td>
                      <td className="font-medium">{r.name || <span className="text-stone-400">{t('none')}</span>}</td>
                      <td>{t('pk_' + r.kind)}</td>
                      <td className="num">{r.phone}</td>
                      <td>{r.city}</td>
                      <td className="r num">
                        {r.openingBalance === 0 ? '' : (
                          <span className={r.openingBalance > 0 ? 'text-emerald-700' : 'text-red-700'}>
                            {fmtMoney(Math.abs(r.openingBalance), firm.currencySymbol)} {r.openingBalance > 0 ? t('receivable') : t('payable')}
                          </span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap">{fmtDate(r.openingDate)}</td>
                      <td className="min-w-48">
                        {r.errors.length === 0 && r.warnings.length === 0 && <span className="text-emerald-700">{t('pt_rowOk')}</span>}
                        {r.errors.map((k) => <div key={k} className="flex items-center gap-1 text-xs text-red-700"><XCircle className="size-3.5 shrink-0" />{t(k)}</div>)}
                        {r.warnings.map((k) => <div key={k} className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="size-3.5 shrink-0" />{t(k)}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
