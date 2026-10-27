import { Building2, ChevronDown, Languages, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData, useFirmCtx } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { ID } from '../../lib/types'
import { canSignIn, ROLES } from '../../lib/users'
import { PinSignIn } from './PinSignIn'

/**
 * Full-screen lock shown before the business opens when app lock is on.
 * Business name and logo, who is signing in, and the PIN pad.
 */
export function LockScreen({ onUnlock }: { onUnlock: (userId: ID) => void }) {
  const { t, lang, setLang } = useI18n()
  const { firm, users } = useData()
  const { firms, switchFirm } = useFirmCtx()
  const [switching, setSwitching] = useState(false)
  const people = useMemo(
    () => users.filter(canSignIn).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name)),
    [users],
  )

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <div className="flex justify-end gap-1 p-3">
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
        >
          <Languages className="size-4" />{lang === 'en' ? 'اردو' : 'English'}
        </button>
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-surface p-6 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            {firm.logo
              ? <img src={firm.logo} alt="" className="mb-3 size-16 rounded-xl border border-stone-200 bg-white object-contain p-1" />
              : <div className="mb-3 grid size-16 place-items-center rounded-xl bg-amber-400 text-2xl font-bold text-stone-900">{firm.name.slice(0, 1).toUpperCase()}</div>}
            <h1 className="text-lg font-bold text-stone-900">{firm.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><Lock className="size-3.5" />{t('lk_locked')}</p>
          </div>

          <PinSignIn key={firm.id} firmId={firm.id} users={people} onOk={(u) => onUnlock(u.id)} />

          <p className="mt-2 text-center text-xs text-stone-400">{t('lk_forgot')}</p>

          {firms.length > 1 && (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={() => setSwitching((s) => !s)}
                className="mx-auto flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-700 cursor-pointer"
                aria-expanded={switching}
              >
                <Building2 className="size-4" />{t('switchBusiness')}<ChevronDown className="size-4" />
              </button>
              {switching && (
                <ul className="mt-2 space-y-1">
                  {firms.filter((f) => f.id !== firm.id).map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => switchFirm(f.id)}
                        className="w-full truncate rounded-lg px-3 py-2 text-start text-sm text-stone-700 hover:bg-stone-100 cursor-pointer"
                      >
                        {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
