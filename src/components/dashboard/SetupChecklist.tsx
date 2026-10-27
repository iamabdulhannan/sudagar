import { CheckCircle2, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import { txnNewPath } from '../../lib/paths'
import { Card } from '../ui'

export interface SetupState { profile: boolean; items: boolean; parties: boolean; sale: boolean; backup: boolean }

/** first steps for a brand new business */
export function SetupChecklist({ state }: { state: SetupState }) {
  const { t } = useI18n()
  const steps: { key: keyof SetupState; to: string }[] = [
    { key: 'profile', to: '/settings' },
    { key: 'items', to: '/items' },
    { key: 'parties', to: '/parties' },
    { key: 'sale', to: txnNewPath('sale') },
    { key: 'backup', to: '/backup' },
  ]
  const done = steps.filter((s) => state[s.key]).length
  return (
    <Card title={t('dash_setupTitle')} actions={<span className="num text-sm text-stone-500">{done}/{steps.length}</span>}>
      <p className="mb-3 text-sm text-stone-500">{t('dash_setupText')}</p>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const ok = state[s.key]
          return (
            <li key={s.key}>
              <Link to={s.to} className="flex items-start gap-3 rounded-lg p-2 hover:bg-stone-50">
                {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-5 shrink-0 text-stone-300" />}
                <span className="min-w-0">
                  <span className={cx('block text-sm font-medium', ok ? 'text-stone-500 line-through' : 'text-stone-900')}>
                    <span className="num">{i + 1}.</span> {t('dash_step_' + s.key)}
                  </span>
                  <span className="block text-xs text-stone-500">{t('dash_stepHint_' + s.key)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
