import { Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Field, Input, Modal, NumberInput, PageHeader, Select, Tabs, Textarea, Toggle, useUi } from '../components/ui'
import { updateSettings, useData, useFirmCtx } from '../lib/data'
import { BUSINESS_PRESETS, deleteFirm } from '../lib/db'
import { useI18n } from '../lib/i18n'
import { TXN_META } from '../lib/txn'
import type { BusinessType, Features, Firm, InvoiceTheme, NegativeStock, PrintSize, Settings as S, TxnType } from '../lib/types'
import { LoyaltySettings } from '../components/settings/LoyaltySettings'
import { SecuritySettings } from '../components/settings/SecuritySettings'
import { TeamSettings } from '../components/settings/TeamSettings'
import { cloudErrorKey, deleteCloudBusiness } from '../lib/cloud'
import { connectDrawer, drawerConnected, drawerSupported, forgetDrawer, openDrawer } from '../lib/drawer'

type Tab = 'profile' | 'features' | 'tax' | 'numbers' | 'print' | 'stock' | 'security' | 'team'
const BUSINESS_TYPES = Object.keys(BUSINESS_PRESETS) as BusinessType[]
const FEATURE_KEYS: (keyof Features)[] = ['tax', 'batches', 'serials', 'wholesale', 'altUnits', 'lineDiscount', 'charges', 'roundOff', 'estimates', 'orders', 'challans', 'dueDates', 'mrp', 'godowns', 'manufacturing', 'loyalty']

/** shrink an uploaded logo so backups stay small */
function resizeImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/png'))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function Settings() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('profile')
  return (
    <div className="max-w-4xl">
      <PageHeader title={t('navSettings')} />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { value: 'profile', label: t('setProfile') },
          { value: 'features', label: t('setFeatures') },
          { value: 'tax', label: t('setTax') },
          { value: 'numbers', label: t('setNumbers') },
          { value: 'print', label: t('setPrint') },
          { value: 'stock', label: t('setStockPos') },
          { value: 'security', label: t('setSecurity') },
          { value: 'team', label: t('tm_title') },
        ]}
      />
      {tab === 'profile' && <Profile />}
      {tab === 'features' && <FeaturesTab />}
      {tab === 'tax' && <TaxTab />}
      {tab === 'numbers' && <NumbersTab />}
      {tab === 'print' && <PrintTab />}
      {tab === 'stock' && <StockTab />}
      {tab === 'security' && <SecuritySettings />}
      {tab === 'team' && <TeamSettings />}
    </div>
  )
}

/** a settings form that keeps a draft and saves on click */
function useDraft<T>(source: T) {
  const [draft, setDraft] = useState(source)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) setDraft(source) }, [source, dirty])
  const set = (patch: Partial<T>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true) }
  return { draft, set, dirty, reset: () => setDirty(false) }
}

function SaveBar({ dirty, onSave }: { dirty: boolean; onSave: () => Promise<void> }) {
  const { t } = useI18n()
  const { toast } = useUi()
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-4 flex justify-end">
      <Button
        disabled={!dirty}
        loading={busy}
        onClick={async () => {
          setBusy(true)
          try { await onSave(); toast(t('setSaved')) } catch (e) { toast(String(e), 'error') } finally { setBusy(false) }
        }}
      >
        {t('save')}
      </Button>
    </div>
  )
}

function Profile() {
  const { t } = useI18n()
  const { firm } = useData()
  const { updateFirm } = useFirmCtx()
  const { draft, set, dirty, reset } = useDraft<Firm>(firm)
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Card>
        <div className="mb-5 flex items-center gap-4">
          {draft.logo
            ? <img src={draft.logo} alt="" className="size-20 rounded-xl border border-stone-200 bg-white object-contain p-1" />
            : <div className="grid size-20 place-items-center rounded-xl bg-amber-400 text-3xl font-bold text-stone-900">{draft.name.slice(0, 1).toUpperCase()}</div>}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-4" />{t('uploadLogo')}</Button>
              {draft.logo && <Button variant="ghost" size="sm" onClick={() => set({ logo: undefined })}>{t('removeLogo')}</Button>}
            </div>
            <p className="text-xs text-stone-500">{t('logoHint')}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set({ logo: await resizeImage(f) }) }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('obName')} required><Input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('businessType')}>
            <Select value={draft.businessType} onChange={(e) => set({ businessType: e.target.value as BusinessType })}>
              {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{t('bt_' + b)}</option>)}
            </Select>
          </Field>
          <Field label={t('obOwner')}><Input value={draft.ownerName ?? ''} onChange={(e) => set({ ownerName: e.target.value })} /></Field>
          <Field label={t('phone')}><Input value={draft.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} dir="ltr" inputMode="tel" /></Field>
          <Field label={t('email')}><Input value={draft.email ?? ''} onChange={(e) => set({ email: e.target.value })} dir="ltr" type="email" /></Field>
          <Field label={t('city')}><Input value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label={t('address')} className="sm:col-span-2"><Textarea value={draft.address ?? ''} onChange={(e) => set({ address: e.target.value })} rows={2} /></Field>
          <Field label={t('ntn')}><Input value={draft.ntn ?? ''} onChange={(e) => set({ ntn: e.target.value })} dir="ltr" /></Field>
          <Field label={t('strn')}><Input value={draft.strn ?? ''} onChange={(e) => set({ strn: e.target.value })} dir="ltr" /></Field>
          <Field label={t('obCurrency')}><Input value={draft.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} dir="ltr" /></Field>
          <Field label={t('st_symbol')}><Input value={draft.currencySymbol} onChange={(e) => set({ currencySymbol: e.target.value })} dir="ltr" /></Field>
        </div>
        <SaveBar dirty={dirty && !!draft.name.trim()} onSave={async () => { await updateFirm({ ...draft, name: draft.name.trim() }); reset() }} />
      </Card>
      {(!firm.accountId || firm.role === 'owner') && <DangerZone />}
    </>
  )
}

function DangerZone() {
  const { t } = useI18n()
  const { firm } = useData()
  const { toast } = useUi()
  const { firms, switchFirm } = useFirmCtx()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  return (
    <Card className="mt-5 border-red-200" title={<span className="text-red-700">{t('setDanger')}</span>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">{t('deleteBusinessHint')}</p>
        <Button variant="danger" onClick={() => setOpen(true)}><Trash2 className="size-4" />{t('deleteBusiness')}</Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('deleteBusiness')}
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
          <Button
            variant="danger"
            disabled={typed.trim() !== firm.name}
            onClick={async () => {
              const next = firms.find((f) => f.id !== firm.id)
              // the owner deletes it everywhere; the cloud copy goes first so other devices lose access
              if (firm.accountId && firm.role === 'owner') {
                try { await deleteCloudBusiness(firm.id) } catch (e) { toast(t(cloudErrorKey(e)), 'error'); return }
              }
              await deleteFirm(firm.id)
              await switchFirm(next?.id ?? null)
              navigate(next ? '/dashboard' : '/', { replace: true })
            }}
          >
            {t('delete')}
          </Button>
        </>}
      >
        <p className="mb-3 text-sm text-stone-600">{t('deleteBusinessHint')} {t('cannotUndo')}</p>
        <Field label={t('typeToConfirm')} hint={firm.name}><Input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
      </Modal>
    </Card>
  )
}

function useSettingsDraft() {
  const { settings, db } = useData()
  const d = useDraft<S>(settings)
  // only write the fields that changed, so numbers taken meanwhile by new invoices are kept
  const save = async () => {
    const patch: Partial<S> = {}
    for (const k of Object.keys(d.draft) as (keyof S)[]) {
      if (k !== 'id' && JSON.stringify(d.draft[k]) !== JSON.stringify(settings[k])) (patch as Record<string, unknown>)[k] = d.draft[k]
    }
    await updateSettings(db, patch)
    d.reset()
  }
  return { ...d, save }
}

function FeaturesTab() {
  const { t } = useI18n()
  const { firm } = useData()
  const { draft, set, dirty, save } = useSettingsDraft()
  const setF = (k: keyof Features, v: boolean) => set({ features: { ...draft.features, [k]: v } })
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">{t('setFeaturesHint')}</p>
        <Button variant="secondary" size="sm" onClick={() => set({ features: { ...draft.features, ...BUSINESS_PRESETS[firm.businessType] } })}>
          {t('applyPreset')}
        </Button>
      </div>
      <div className="divide-y divide-stone-100">
        {FEATURE_KEYS.map((k) => <Toggle key={k} checked={draft.features[k]} onChange={(v) => setF(k, v)} label={t('f_' + k)} />)}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      {draft.features.loyalty && <div className="mt-4 border-t border-stone-100 pt-4"><LoyaltySettings /></div>}
    </Card>
  )
}

function TaxTab() {
  const { t } = useI18n()
  const { draft, set, dirty, save } = useSettingsDraft()
  const [ratesText, setRatesText] = useState(draft.taxRates.join(', '))
  return (
    <Card>
      <Toggle checked={draft.features.tax} onChange={(v) => set({ features: { ...draft.features, tax: v } })} label={t('f_tax')} />
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label={t('taxLabel')}><Input value={draft.taxLabel} onChange={(e) => set({ taxLabel: e.target.value })} /></Field>
        <Field label={t('defaultTaxRate')}><NumberInput value={draft.defaultTaxRate} onValue={(n) => set({ defaultTaxRate: n })} /></Field>
        <Field label={t('taxRates')}>
          <Input
            value={ratesText}
            onChange={(e) => {
              setRatesText(e.target.value)
              const rates = [...new Set(e.target.value.split(',').map((x) => parseFloat(x)).filter((n) => Number.isFinite(n) && n >= 0))].sort((a, b) => a - b)
              set({ taxRates: rates.length ? rates : [0] })
            }}
            dir="ltr"
          />
        </Field>
      </div>
      <SaveBar dirty={dirty} onSave={save} />
    </Card>
  )
}

function NumbersTab() {
  const { t } = useI18n()
  const { draft, set, dirty, save } = useSettingsDraft()
  const types = Object.keys(TXN_META) as TxnType[]
  return (
    <Card padded={false}>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>{t('type')}</th><th>{t('prefix')}</th><th>{t('nextNumber')}</th><th>{t('st_preview')}</th></tr></thead>
          <tbody>
            {types.map((ty) => (
              <tr key={ty}>
                <td className="font-medium">{t('tt_' + ty)}</td>
                <td><Input value={draft.prefixes[ty]} onChange={(e) => set({ prefixes: { ...draft.prefixes, [ty]: e.target.value } })} className="h-9 w-28" dir="ltr" /></td>
                <td><NumberInput value={draft.nextNo[ty]} onValue={(n) => set({ nextNo: { ...draft.nextNo, [ty]: Math.max(1, Math.floor(n)) } })} className="h-9 w-24" /></td>
                <td className="num text-stone-500" dir="ltr">{draft.prefixes[ty]}{String(draft.nextNo[ty]).padStart(4, '0')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-4"><SaveBar dirty={dirty} onSave={save} /></div>
    </Card>
  )
}

function PrintTab() {
  const { t } = useI18n()
  const { draft, set, dirty, save } = useSettingsDraft()
  const sizes: PrintSize[] = ['a4', 'a5', 'thermal80', 'thermal58']
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('printSize')} hint={t('sz_hint')}>
          <Select value={draft.printSize} onChange={(e) => set({ printSize: e.target.value as PrintSize })}>
            {sizes.map((s) => <option key={s} value={s}>{t('ps_' + s)}</option>)}
          </Select>
        </Field>
        <Field label={t('invoiceTheme')}>
          <Select value={draft.invoiceTheme} onChange={(e) => set({ invoiceTheme: e.target.value as InvoiceTheme })}>
            {(['classic', 'modern', 'compact', 'bold'] as InvoiceTheme[]).map((th) => <option key={th} value={th}>{t('th_' + th)}</option>)}
          </Select>
        </Field>
        <Field label={t('invoiceColor')}>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.invoiceColor} onChange={(e) => set({ invoiceColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-stone-300 bg-surface p-1" />
            <Input value={draft.invoiceColor} onChange={(e) => set({ invoiceColor: e.target.value })} dir="ltr" className="w-32" />
          </div>
        </Field>
        <Field label={t('invoiceTerms')} className="sm:col-span-2"><Textarea value={draft.invoiceTerms ?? ''} onChange={(e) => set({ invoiceTerms: e.target.value })} rows={3} /></Field>
        <Field label={t('invoiceFooter')} className="sm:col-span-2"><Input value={draft.invoiceFooter ?? ''} onChange={(e) => set({ invoiceFooter: e.target.value })} /></Field>
      </div>
      <div className="mt-2"><Toggle checked={draft.signature} onChange={(v) => set({ signature: v })} label={t('signature')} /></div>
      <SaveBar dirty={dirty} onSave={save} />
    </Card>
  )
}

function StockTab() {
  const { t } = useI18n()
  const { accounts } = useData()
  const { draft, set, dirty, save } = useSettingsDraft()
  const row = (label: ReactNode, control: ReactNode) => <Field label={label}>{control}</Field>
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {row(t('negativeStock'), (
          <Select value={draft.negativeStock} onChange={(e) => set({ negativeStock: e.target.value as NegativeStock })}>
            {(['allow', 'warn', 'block'] as NegativeStock[]).map((v) => <option key={v} value={v}>{t('ns_' + v)}</option>)}
          </Select>
        ))}
        {row(t('defaultDueDays'), <NumberInput value={draft.defaultDueDays} onValue={(n) => set({ defaultDueDays: Math.max(0, Math.floor(n)) })} />)}
        {row(t('defaultAccount'), (
          <Select value={draft.defaultAccountId ?? ''} onChange={(e) => set({ defaultAccountId: e.target.value || undefined })}>
            {accounts.filter((a) => a.active && a.kind !== 'loan').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        ))}
      </div>
      <div className="mt-2 divide-y divide-stone-100">
        <Toggle checked={draft.posAutoPrint} onChange={(v) => set({ posAutoPrint: v })} label={t('posAutoPrint')} />
        <Toggle checked={!!draft.requireShift} onChange={(v) => set({ requireShift: v })} label={t('sh_require')} />
        <Toggle checked={!!draft.drawerKick} onChange={(v) => set({ drawerKick: v })} label={t('sh_kick')} hint={t('sh_kickHint')} />
      </div>
      {draft.drawerKick && <DrawerSetup />}
      <Field label={t('sh_denoms')} className="mt-3">
        <Input
          defaultValue={(draft.denominations ?? []).join(', ')}
          onChange={(e) => {
            const list = [...new Set(e.target.value.split(',').map((x) => parseFloat(x)).filter((n) => Number.isFinite(n) && n > 0))].sort((x, y) => y - x)
            if (list.length) set({ denominations: list })
          }}
          dir="ltr"
        />
      </Field>
      <SaveBar dirty={dirty} onSave={save} />
    </Card>
  )
}

/** connect the receipt printer's port so the app can open the cash drawer */
function DrawerSetup() {
  const { t } = useI18n()
  const { toast } = useUi()
  const [connected, setConnected] = useState(drawerConnected())
  if (!drawerSupported()) return <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('sh_noSerial')}</p>
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
      {connected && <span className="text-sm font-medium text-emerald-700">{t('sh_connected')}</span>}
      <Button size="sm" variant="secondary" onClick={async () => { try { await connectDrawer(); setConnected(true) } catch { /* cancelled */ } }}>{t('sh_connect')}</Button>
      {connected && <Button size="sm" variant="secondary" onClick={async () => { if (!(await openDrawer().catch(() => false))) toast(t('sh_drawerFail'), 'error') }}>{t('sh_test')}</Button>}
      {connected && <Button size="sm" variant="ghost" onClick={() => { forgetDrawer(); setConnected(false) }}>{t('sh_forget')}</Button>}
    </div>
  )
}
