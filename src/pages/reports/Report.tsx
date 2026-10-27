import { FileQuestion } from 'lucide-react'
import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { reportByKey } from '../../components/reports/registry'
import { NoAccess } from '../../components/security/RequirePerm'
import { Button, Card, Empty } from '../../components/ui'
import { useAccess } from '../../lib/access'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'

/** /reports/:key, renders one report from the registry */
export default function Report() {
  const { key = '' } = useParams()
  const { t } = useI18n()
  const { settings } = useData()
  const { can } = useAccess()
  const meta = reportByKey(key)
  if (!can('reports') || (meta?.perm && !can(meta.perm))) return <NoAccess />
  if (!meta || (meta.show && !meta.show(settings))) {
    return (
      <Card>
        <Empty
          icon={<FileQuestion className="size-7" />}
          title={meta ? t('rp_featureOff') : t('rp_notFound')}
          text={meta ? t('rp_featureOffText') : undefined}
          action={<Link to="/reports"><Button variant="secondary">{t('navReports')}</Button></Link>}
        />
      </Card>
    )
  }
  const C = meta.Component
  return (
    <Suspense fallback={<div className="py-20 text-center text-stone-400">{t('loading')}</div>}>
      {/* key: a fresh report (and fresh filters) for each route */}
      <C key={meta.key} {...(meta.props ?? {})} />
    </Suspense>
  )
}
