import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { REPORT_GROUPS, REPORTS } from '../../components/reports/registry'
import { RequirePerm } from '../../components/security/RequirePerm'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../lib/access'
import { useData } from '../../lib/data'
import { useI18n } from '../../lib/i18n'
import { reportPath } from '../../lib/paths'

/** the reports hub: every report grouped, each card opens /reports/<key> */
export default function Reports() {
  return <RequirePerm perm="reports"><ReportsHub /></RequirePerm>
}

function ReportsHub() {
  const { t } = useI18n()
  const { settings } = useData()
  const { can } = useAccess()
  const list = REPORTS.filter((r) => (!r.show || r.show(settings)) && (!r.perm || can(r.perm)))
  return (
    <div>
      <PageHeader title={t('navReports')} subtitle={t('rp_hubText')} />
      <div className="space-y-6">
        {REPORT_GROUPS.filter((g) => list.some((r) => r.group === g.key)).map((g) => (
          <section key={g.key} aria-labelledby={`rg-${g.key}`}>
            <h2 id={`rg-${g.key}`} className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              {g.icon}{t(g.title)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.filter((r) => r.group === g.key).map((r) => (
                <Link
                  key={r.key}
                  to={reportPath(r.key)}
                  className="group flex items-start gap-3 rounded-xl border border-stone-200 bg-surface p-4 shadow-sm transition hover:border-brand-500 hover:shadow focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-900">{t(r.title)}</span>
                    <span className="mt-0.5 block text-sm text-stone-500">{t(r.desc)}</span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-stone-400 transition group-hover:text-brand-700 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
