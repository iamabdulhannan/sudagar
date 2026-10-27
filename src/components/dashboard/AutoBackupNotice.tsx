import { FolderSync } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAccess } from '../../lib/access'
import { useAutoBackup } from '../../lib/autobackup'
import { useI18n } from '../../lib/i18n'
import { Button, useUi } from '../ui'

/**
 * Runs the daily folder backup when the dashboard opens and asks for one click
 * when the browser needs permission again.
 */
export function AutoBackupNotice() {
  const { t } = useI18n()
  const { can } = useAccess()
  const { toast } = useUi()
  const { status, folder, allow } = useAutoBackup()
  const told = useRef(false)

  useEffect(() => {
    if (status === 'saved' && folder && !told.current) { told.current = true; toast(t('ab_saved', { folder: folder.name }), 'info') }
  }, [status, folder, toast, t])

  if (!can('backup') || (status !== 'needs-permission' && status !== 'error')) return null
  const error = status === 'error'
  return (
    <div role="status" className={error
      ? 'flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900'
      : 'flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900'}>
      <FolderSync className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 font-medium">{error ? t('ab_failed') : t('ab_allowText', { folder: folder?.name ?? '' })}</span>
      {error
        ? <Link to="/backup" className="font-semibold underline">{t('navBackup')}</Link>
        : <Button size="sm" onClick={async () => { const s = await allow(); if (s !== 'saved') toast(t('ab_denied'), 'error') }}>{t('ab_allow')}</Button>}
    </div>
  )
}
