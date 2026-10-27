import { HardDriveDownload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'

/** amber reminder when the last backup is older than 7 days (or there is none) */
export function BackupBanner({ lastBackup }: { lastBackup: number }) {
  const { t } = useI18n()
  const days = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : 0
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <HardDriveDownload className="size-5 shrink-0 text-amber-700" />
      <span className="min-w-0 flex-1 font-medium">{lastBackup ? t('backupReminder', { n: days }) : `${t('neverBackedUp')}. ${t('dash_backupNow')}`}</span>
      <Link to="/backup" className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-amber-600">{t('downloadBackup')}</Link>
    </div>
  )
}
