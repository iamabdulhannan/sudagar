import { BellRing, Check, MessageCircle, Phone, RotateCcw, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { normalizePkPhone, waLink } from '../../components/parties/partyUtils'
import { RequirePerm } from '../../components/security/RequirePerm'
import { Badge, Button, Card, Empty, Field, NumberInput, PageHeader, SearchInput, Select, Stat, Textarea, useUi } from '../../components/ui'
import { cx } from '../../lib/cx'
import { updateSettings, useBooks, useData } from '../../lib/data'
import { today } from '../../lib/db'
import { fmtDate, fmtMoney, fmtNum } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { partyPath } from '../../lib/paths'
import { fillTemplate, reminderRows, type ReminderRow } from '../../lib/reports'

type Filter = 'all' | 'overdue' | 'above'

export default function Reminders() {
  return <RequirePerm perm="parties"><RemindersPage /></RequirePerm>
}

const sentKey = (firmId: string) => `saudagar.remindersSent.${firmId}.${today()}`

/** parties sent a reminder in this tab today */
function useSent(firmId: string) {
  const [sent, setSent] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(sentKey(firmId)) ?? '[]') as string[]) } catch { return new Set() }
  })
  const mark = (id: string) => setSent((s) => {
    const n = new Set(s).add(id)
    try { sessionStorage.setItem(sentKey(firmId), JSON.stringify([...n])) } catch { /* private mode */ }
    return n
  })
  const clear = () => {
    setSent(new Set())
    try { sessionStorage.removeItem(sentKey(firmId)) } catch { /* ignore */ }
  }
  return { sent, mark, clear }
}

function RemindersPage() {
  const { t } = useI18n()
  const data = useData()
  const books = useBooks()
  const { firm, settings, db } = data
  const { toast } = useUi()
  const sym = firm.currencySymbol
  const d = today()
  const all = useMemo(() => reminderRows(data, books, d), [data, books, d])

  const [filter, setFilter] = useState<Filter>('all')
  const [min, setMin] = useState(0)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { sent, mark, clear } = useSent(firm.id)

  const defaultTemplate = t('rm_template')
  const saved = settings.reminderTemplate?.trim() ? settings.reminderTemplate : undefined
  const [template, setTemplate] = useState(saved ?? defaultTemplate)
  useEffect(() => { setTemplate(saved ?? defaultTemplate) }, [saved, defaultTemplate])
  const templateDirty = template !== (saved ?? defaultTemplate)

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter((r) =>
      (filter !== 'overdue' || r.overdueCount > 0) &&
      (filter !== 'above' || r.balance >= min) &&
      (!s || r.name.toLowerCase().includes(s) || (r.phone ?? '').includes(s)))
  }, [all, filter, min, q])

  const message = (r: ReminderRow) => fillTemplate(template, {
    party: r.name, amount: fmtMoney(r.balance, sym), firm: firm.name, phone: firm.phone ?? '',
    due: r.oldestDue ? fmtDate(r.oldestDue) : '', days: String(r.daysLate),
  })
  const linkFor = (r: ReminderRow) => waLink(r.phone, message(r))

  const picked = rows.filter((r) => selected.has(r.partyId))
  const queue = picked.filter((r) => !sent.has(r.partyId) && linkFor(r))
  const preview = picked[0] ?? rows[0]
  const allPicked = rows.length > 0 && rows.every((r) => selected.has(r.partyId))

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(rows.map((r) => r.partyId)))
  const sendNext = () => {
    const r = queue[0]
    const url = r && linkFor(r)
    if (!r || !url) return
    window.open(url, '_blank', 'noopener')
    mark(r.partyId)
  }
  const saveTemplate = async (text?: string) => {
    await updateSettings(db, { reminderTemplate: text })
    toast(t('setSaved'))
  }

  const totalDue = all.reduce((a, r) => a + r.balance, 0)
  const overdueParties = all.filter((r) => r.overdueCount > 0)

  return (
    <div className="space-y-5">
      <PageHeader title={t('navReminders')} subtitle={t('rm_subtitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('rm_parties')} value={fmtNum(all.length)} />
        <Stat label={t('receivable')} value={fmtMoney(totalDue, sym)} tone="good" />
        <Stat label={t('rm_overdueParties')} value={fmtNum(overdueParties.length)} tone={overdueParties.length ? 'bad' : 'neutral'} />
        <Stat label={t('rm_overdueAmount')} value={fmtMoney(overdueParties.reduce((a, r) => a + r.overdueAmount, 0), sym)} tone="bad" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card padded={false} className="min-w-0">
          <div className="flex flex-wrap items-end gap-3 border-b border-stone-100 p-3">
            <SearchInput value={q} onChange={setQ} className="w-full sm:w-56" />
            <Field label={t('rm_show')}>
              <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-auto">
                <option value="all">{t('rm_fAll')}</option>
                <option value="overdue">{t('rm_fOverdue')}</option>
                <option value="above">{t('rm_fAbove')}</option>
              </Select>
            </Field>
            {filter === 'above' && (
              <Field label={t('rm_minAmount', { sym })}><NumberInput value={min} onValue={setMin} className="w-32" /></Field>
            )}
          </div>

          {rows.length === 0 ? (
            <Empty icon={<BellRing className="size-7" />} title={all.length ? t('noResults') : t('rm_none')} text={all.length ? undefined : t('rm_noneText')} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-8"><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label={t('rm_selectAll')} className="size-4 accent-brand-700" /></th>
                    <th>{t('dash_party')}</th>
                    <th className="r">{t('balance')}</th>
                    <th className="r">{t('rm_overdueInv')}</th>
                    <th>{t('rm_oldestDue')}</th>
                    <th className="r">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const wa = linkFor(r)
                    const tel = normalizePkPhone(r.phone)
                    const done = sent.has(r.partyId)
                    return (
                      <tr key={r.partyId} className={cx(selected.has(r.partyId) && 'bg-brand-50/50')}>
                        <td><input type="checkbox" checked={selected.has(r.partyId)} onChange={() => toggle(r.partyId)} aria-label={r.name} className="size-4 accent-brand-700" /></td>
                        <td>
                          <Link to={partyPath(r.partyId)} className="font-medium text-brand-700 hover:underline">{r.name}</Link>
                          <span className="num block text-xs text-stone-500" dir="ltr">{r.phone || t('rm_noPhone')}</span>
                        </td>
                        <td className="r num font-semibold">{fmtMoney(r.balance, sym)}</td>
                        <td className="r">
                          {r.overdueCount > 0
                            ? <span className="num text-red-700">{r.overdueCount} <span className="text-xs">({fmtMoney(r.overdueAmount, sym)})</span></span>
                            : <span className="num text-stone-400">0</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          {r.oldestDue
                            ? <><span className="num">{fmtDate(r.oldestDue)}</span>{r.daysLate > 0 && <span className="block text-xs text-red-700">{t('dash_daysLate', { n: r.daysLate })}</span>}</>
                            : <span className="text-stone-400">-</span>}
                        </td>
                        <td className="r">
                          <span className="inline-flex items-center gap-1">
                            {done && <Badge tone="good"><Check className="size-3" />{t('rm_sent')}</Badge>}
                            {tel && (
                              <a href={`tel:+${tel}`} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title={t('rm_call')} aria-label={t('rm_call')}>
                                <Phone className="size-4" />
                              </a>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" onClick={() => mark(r.partyId)} title={t('txWhatsApp')}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50">
                                <MessageCircle className="size-4" />{t('txWhatsApp')}
                              </a>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={t('rm_sendTitle')}>
            <p className="text-sm text-stone-600">{t('rm_selected', { n: picked.length, left: queue.length })}</p>
            <Button className="mt-3 w-full" variant="success" onClick={sendNext} disabled={!queue.length}>
              <Send className="size-4 rtl:-scale-x-100" />{queue[0] ? t('rm_sendTo', { name: queue[0].name }) : t('rm_sendNext')}
            </Button>
            <p className="mt-2 text-xs text-stone-500">{t('rm_sendHint')}</p>
            {sent.size > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={clear}><RotateCcw className="size-3.5" />{t('rm_clearSent')}</Button>}
          </Card>

          <Card title={t('rm_message')}>
            <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={6} />
            <p className="mt-1 text-xs text-stone-500">{t('rm_placeholders')}</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setTemplate(defaultTemplate); saveTemplate(undefined) }} disabled={!saved}>{t('rm_reset')}</Button>
              <Button size="sm" onClick={() => saveTemplate(template)} disabled={!templateDirty || !template.trim()}>{t('rm_saveTemplate')}</Button>
            </div>
            {preview && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-stone-500">{t('rm_preview', { name: preview.name })}</div>
                <div className="whitespace-pre-wrap rounded-xl rounded-ss-none bg-emerald-50 p-3 text-sm text-stone-800">{message(preview)}</div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
