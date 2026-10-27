import { useState } from 'react'
import { Button, Field, Input, Select } from '../ui'
import { cx } from '../../lib/cx'
import { useI18n } from '../../lib/i18n'
import type { BusinessType, Firm } from '../../lib/types'

const TYPES: BusinessType[] = ['retail', 'grocery', 'wholesale', 'distributor', 'manufacturer', 'pharmacy', 'electronics', 'garments', 'hardware', 'restaurant', 'services', 'agri', 'other']

const CURRENCIES = [
  { code: 'PKR', symbol: 'Rs' }, { code: 'INR', symbol: '₹' }, { code: 'BDT', symbol: '৳' }, { code: 'AED', symbol: 'AED' },
  { code: 'SAR', symbol: 'SAR' }, { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' }, { code: 'EUR', symbol: '€' },
]

export type NewBusiness = Pick<Firm, 'name' | 'businessType' | 'ownerName' | 'phone' | 'currency' | 'currencySymbol'>

/** name, kind of business, owner, phone and currency of a new business */
export function CreateBusinessForm({ onCreate, defaultOwner, busy }: { onCreate: (b: NewBusiness) => void; defaultOwner?: string; busy?: boolean }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(defaultOwner ?? '')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState<BusinessType>('retail')
  const [currency, setCurrency] = useState('PKR')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const c = CURRENCIES.find((x) => x.code === currency)!
        onCreate({ name: name.trim(), businessType: type, ownerName: owner.trim() || undefined, phone: phone.trim() || undefined, currency: c.code, currencySymbol: c.symbol })
      }}
    >
      <Field label={t('obName')} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('obNamePh')} autoFocus />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-stone-700">{t('obType')}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES.map((bt) => (
            <button
              key={bt}
              type="button"
              onClick={() => setType(bt)}
              aria-pressed={type === bt}
              className={cx(
                'rounded-lg border px-3 py-2 text-start text-[13px] font-medium transition-colors cursor-pointer',
                type === bt ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600' : 'border-stone-200 text-stone-700 hover:border-stone-300',
              )}
            >
              {t('bt_' + bt)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('obOwner')}><Input value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
        <Field label={t('phone')}><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" /></Field>
        <Field label={t('obCurrency')}>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </Select>
        </Field>
      </div>
      <Button type="submit" size="lg" loading={busy} disabled={!name.trim() || busy}>{t('obStart')}</Button>
    </form>
  )
}
