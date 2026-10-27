import { useLiveQuery } from 'dexie-react-hooks'
import { FolderCheck, FolderOpen, HardDriveDownload, HardDriveUpload, Info, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RequirePerm } from '../components/security/RequirePerm'
import { Badge, Button, Card, PageHeader, useUi } from '../components/ui'
import { autoBackupSupported, chooseFolder, getFolder, runAutoBackupIfDue, stopAutoBackup } from '../lib/autobackup'
import { exportFirm, backupFileName, readBackup, restoreFirm } from '../lib/backup'
import { downloadBlob } from '../lib/csv'
import { useData, useFirmCtx } from '../lib/data'
import { meta } from '../lib/db'
import { fmtDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'

export default function Backup() {
  return <RequirePerm perm="backup"><BackupPage /></RequirePerm>
}

function BackupPage() {
  const { t } = useI18n()
  const { firm, txns, items, parties } = useData()
  const { switchFirm } = useFirmCtx()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'' | 'down' | 'up'>('')
  const last = useLiveQuery(async () => (await meta.prefs.get(`lastBackup.${firm.id}`))?.value as number | undefined, [firm.id])

  const download = async () => {
    setBusy('down')
    try {
      downloadBlob(backupFileName(firm), await exportFirm(firm))
      toast(t('saved'))
    } finally {
      setBusy('')
    }
  }

  const restore = async (f: File) => {
    const file = readBackup(await f.text())
    if (!file) { toast(t('backupBad'), 'error'); return }
    setBusy('up')
    try {
      const sameId = (await meta.firms.get(file.firm.id)) !== undefined
      const replace = sameId && await confirm({
        title: t('restoreBackup'),
        text: `${file.firm.name}: ${t('bk_replaceAsk')}`,
        okLabel: t('bk_replace'),
        danger: true,
      })
      const restored = await restoreFirm(file, replace)
      await switchFirm(restored.id)
      toast(t('restoreDone', { name: restored.name }))
      navigate('/dashboard')
    } catch (e) {
      toast(String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('backupTitle')} subtitle={t('backupText')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><HardDriveDownload className="size-5" /></div>
            <div className="min-w-0">
              <h2 className="font-semibold text-stone-900">{t('downloadBackup')}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {firm.name}: <span className="num">{items.length}</span> {t('bk_items')}, <span className="num">{parties.length}</span> {t('bk_parties')}, <span className="num">{txns.length}</span> {t('bk_txns')}
              </p>
              <p className="mt-1 text-xs text-stone-500">{last ? t('lastBackup', { when: fmtDateTime(last) }) : t('neverBackedUp')}</p>
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={download} loading={busy === 'down'}>{t('downloadBackup')}</Button>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><HardDriveUpload className="size-5" /></div>
            <div>
              <h2 className="font-semibold text-stone-900">{t('restoreBackup')}</h2>
              <p className="mt-1 text-sm text-stone-500">{t('restoreHint')}</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f) }}
          />
          <Button variant="secondary" className="mt-4 w-full" onClick={() => fileRef.current?.click()} loading={busy === 'up'}>{t('restoreBackup')}</Button>
        </Card>
      </div>
      <AutoBackupCard />
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-stone-200 bg-surface p-4 text-sm text-stone-600">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <p>{t('bk_tip')}</p>
      </div>
    </div>
  )
}

/** daily backup into a folder on this computer (Chrome / Edge) */
function AutoBackupCard() {
  const { t } = useI18n()
  const { firm } = useData()
  const { toast, confirm } = useUi()
  const supported = autoBackupSupported()
  const [folder, setFolder] = useState<Awaited<ReturnType<typeof getFolder>>>()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<'' | 'pick' | 'now'>('')
  const refresh = useCallback(async () => { setFolder(await getFolder(firm.id)); setLoaded(true) }, [firm.id])
  useEffect(() => { refresh() }, [refresh])

  const pick = async () => {
    setBusy('pick')
    try {
      const rec = await chooseFolder(firm)
      setFolder(rec)
      toast(t('ab_started', { folder: rec.name }))
    } catch (e) {
      // closing the folder picker is not an error
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast(t('ab_failed'), 'error')
      await refresh()
    } finally {
      setBusy('')
    }
  }
  const now = async () => {
    setBusy('now')
    const s = await runAutoBackupIfDue(firm, { ask: true, force: true })
    setBusy('')
    await refresh()
    if (s === 'saved') toast(t('ab_saved', { folder: folder?.name ?? '' }))
    else if (s === 'needs-permission') toast(t('ab_denied'), 'error')
    else toast(t('ab_failed'), 'error')
  }
  const stop = async () => {
    if (!(await confirm({ title: t('ab_stop'), text: t('ab_stopAsk') }))) return
    await stopAutoBackup(firm.id)
    await refresh()
    toast(t('ab_stopped'))
  }

  return (
    <Card className="mt-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          {folder ? <FolderCheck className="size-5" /> : <FolderOpen className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
            {t('ab_title')}
            {supported && loaded && (folder ? <Badge tone="good">{t('enabled')}</Badge> : <Badge>{t('disabled')}</Badge>)}
          </h2>
          {!supported ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-stone-500"><Info className="mt-0.5 size-4 shrink-0" />{t('ab_unsupported')}</p>
          ) : folder ? (
            <div className="mt-1 space-y-0.5 text-sm text-stone-600">
              <p>{t('ab_folder')}: <span className="font-medium text-stone-900" dir="auto">{folder.name}</span></p>
              <p className="text-xs text-stone-500">{folder.lastAt ? t('ab_last', { when: fmtDateTime(folder.lastAt) }) : t('ab_notYet')}</p>
              {folder.lastError && <p className="text-xs text-red-700">{t('ab_lastFailed')}</p>}
            </div>
          ) : (
            <p className="mt-1 text-sm text-stone-500">{t('ab_text')}</p>
          )}
        </div>
      </div>
      {supported && (
        <div className="mt-4 flex flex-wrap gap-2">
          {folder ? (
            <>
              <Button onClick={now} loading={busy === 'now'}>{t('ab_now')}</Button>
              <Button variant="secondary" onClick={pick} loading={busy === 'pick'}>{t('ab_change')}</Button>
              <Button variant="ghost" onClick={stop}>{t('ab_stop')}</Button>
            </>
          ) : (
            <Button onClick={pick} loading={busy === 'pick'}><FolderOpen className="size-4" />{t('ab_choose')}</Button>
          )}
        </div>
      )}
    </Card>
  )
}
