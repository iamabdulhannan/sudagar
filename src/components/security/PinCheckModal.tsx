import { useMemo } from 'react'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import type { AppUser, Role } from '../../lib/types'
import { canSignIn } from '../../lib/users'
import { Modal } from '../ui'
import { PinSignIn } from './PinSignIn'

const OWNER: Role[] = ['owner']

/** asks for the PIN of one of the users with the given roles (e.g. before turning app lock on) */
export function PinCheckModal({ open, onClose, onOk, roles = OWNER, title, text }: {
  open: boolean
  onClose: () => void
  onOk: (u: AppUser) => void
  roles?: Role[]
  title: string
  text?: string
}) {
  const { t } = useI18n()
  const { firm, users } = useData()
  const people = useMemo(() => users.filter((u) => canSignIn(u) && roles.includes(u.role)), [users, roles])
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {text && <p className="mb-4 text-sm text-stone-600">{text}</p>}
      {people.length === 0
        ? <p className="text-sm text-stone-500">{t('sec_needOwner')}</p>
        : <PinSignIn firmId={firm.id} users={people} onOk={onOk} />}
    </Modal>
  )
}
