import { Settings as SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/data'
import { MAIN_GODOWN } from '../../lib/db'
import { useI18n } from '../../lib/i18n'
import type { ID } from '../../lib/types'
import { Card, Empty, Select } from '../ui'
import { useGodownOptions } from './useStock'

/** shown instead of a page whose feature switch is off */
export function FeatureOff({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  const { t } = useI18n()
  return (
    <Card>
      <Empty
        icon={icon}
        title={title}
        text={text}
        action={
          <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-hover">
            <SettingsIcon className="size-4" />{t('stTurnOn')}
          </Link>
        }
      />
    </Card>
  )
}

/** godown picker; empty value means the main godown */
export function GodownSelect({ value, onChange, className, all, ariaLabel }: {
  value: ID | undefined
  onChange: (id: ID) => void
  className?: string
  /** offer "All godowns" as the empty value */
  all?: boolean
  ariaLabel?: string
}) {
  const { t } = useI18n()
  const options = useGodownOptions(value)
  return (
    <Select value={all ? value ?? '' : value || MAIN_GODOWN} onChange={(e) => onChange(e.target.value)} className={className} aria-label={ariaLabel ?? t('stGodown')}>
      {all && <option value="">{t('stAllGodowns')}</option>}
      {options.map((g) => <option key={g.id} value={g.id}>{g.name}{g.active ? '' : ` (${t('inactive')})`}</option>)}
    </Select>
  )
}

/** name of a godown by id (empty = main) */
export function useGodownName() {
  const { godowns } = useData()
  return (id?: ID) => godowns.find((g) => g.id === (id || MAIN_GODOWN))?.name ?? ''
}
