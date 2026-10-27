import { Printer } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { useData } from '../../../lib/data'
import { round2 } from '../../../lib/format'
import { useI18n } from '../../../lib/i18n'
import { TXN_META } from '../../../lib/txn'
import type { Txn } from '../../../lib/types'
import { Button, Money } from '../../ui'

export type SaveMode = 'view' | 'new' | 'print'

/** sticky bar under the form: total, balance and the save buttons */
export function FormFooter({ draft, saving, onSave, onBack }: {
  draft: Txn; saving: boolean; onSave: (m: SaveMode) => void; onBack: () => void
}) {
  const { t } = useI18n()
  const { firm } = useData()
  const m = TXN_META[draft.type]
  const due = round2(draft.total - draft.received)
  const showDue = m.posts && m.lines && due > 0.001
  return (
    <div className="no-print sticky bottom-0 z-10 -mx-3 mt-5 border-t border-stone-200 bg-surface/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="me-auto min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-stone-500">{t('total')}</span>
            <Money value={draft.total} symbol={firm.currencySymbol} className="text-lg font-bold text-stone-900" />
          </div>
          {showDue && (
            <div className={cx('text-xs text-red-700')}>
              {t('txBalanceDue')}: <Money value={due} symbol={firm.currencySymbol} />
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={onBack} className="hidden sm:inline-flex">{t('cancel')}</Button>
        <Button variant="secondary" onClick={() => onSave('print')} disabled={saving} title={t('txSavePrint')}>
          <Printer className="size-4" /><span className="hidden sm:inline">{t('txSavePrint')}</span>
        </Button>
        <Button variant="secondary" onClick={() => onSave('new')} disabled={saving} title="Ctrl+Enter">{t('saveNew')}</Button>
        <Button onClick={() => onSave('view')} loading={saving} title="Ctrl+S">{t('save')}</Button>
      </div>
      <p className="mt-1 hidden text-[11px] text-stone-400 lg:block">{t('txShortcuts')}</p>
    </div>
  )
}
