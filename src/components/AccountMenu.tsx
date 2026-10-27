import { Building2, Cloud, CloudOff, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { cx } from '../lib/cx'
import { useFirmCtx } from '../lib/data'
import { deleteFirm } from '../lib/db'
import { fmtDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { cloudConfigured } from '../lib/supabase'
import { useSync, type SyncState } from '../lib/syncProvider'
import { useUi } from './ui'

const DOT: Record<SyncState, string> = {
  local: 'bg-stone-400', syncing: 'bg-sky-500 animate-pulse', synced: 'bg-emerald-500', offline: 'bg-amber-500', error: 'bg-red-500',
}

/** signed-in account, sync status and sign out (top bar) */
export function AccountMenu() {
  const { t } = useI18n()
  const { session, name, signOut } = useAuth()
  const { firms } = useFirmCtx()
  const sync = useSync()
  const { confirm } = useUi()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!cloudConfigured || !session) return null

  const label = t('sy_' + sync.state)
  const out = async (clear: boolean) => {
    if (clear) {
      if (!(await confirm({ title: t('au_signOutClear'), text: t('au_signOutClearHint'), okLabel: t('au_signOut') }))) return
      for (const f of firms) await deleteFirm(f.id)
    }
    await signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('ac_account')}
        title={label}
        className="relative grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 hover:ring-2 hover:ring-brand-200 cursor-pointer"
      >
        {name.slice(0, 1).toUpperCase()}
        <span className={cx('absolute -bottom-0.5 -end-0.5 size-3 rounded-full ring-2 ring-surface', DOT[sync.state])} />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-72 rounded-xl border border-stone-200 bg-surface p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <div className="truncate font-semibold text-stone-900">{name}</div>
            <div className="truncate text-xs text-stone-500" dir="ltr">{session.user.email}</div>
          </div>
          <div className="mx-1.5 my-1 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <div className="flex items-center gap-2 font-medium text-stone-800">
              {sync.state === 'offline' || sync.state === 'error' ? <CloudOff className="size-3.5" /> : <Cloud className="size-3.5" />}{label}
            </div>
            {sync.pending > 0 && <div className="mt-0.5">{t('sy_pending', { n: sync.pending })}</div>}
            {sync.lastSync && <div className="mt-0.5">{t('sy_last', { when: fmtDateTime(sync.lastSync) })}</div>}
            <button type="button" onClick={sync.syncNow} className="mt-1.5 flex items-center gap-1 font-semibold text-brand-700 hover:underline cursor-pointer">
              <RefreshCw className="size-3.5" />{t('sy_now')}
            </button>
          </div>
          <MenuItem icon={<Building2 className="size-4" />} onClick={() => { setOpen(false); navigate('/welcome?add=1') }}>{t('ac_businesses')}</MenuItem>
          <MenuItem icon={<LogOut className="size-4" />} onClick={() => void out(false)}>{t('au_signOut')}</MenuItem>
          <MenuItem icon={<Trash2 className="size-4" />} onClick={() => void out(true)} danger>{t('au_signOutClear')}</MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm cursor-pointer', danger ? 'text-red-700 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-100')}>
      {icon}<span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}
