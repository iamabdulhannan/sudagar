import {
  CloudUpload, Download, FileJson, HandCoins, Laptop, Package, ReceiptText, ShoppingCart, Smartphone, WifiOff, type LucideIcon,
} from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { DEEP, INK, Reveal, SectionHead, WHATSAPP, wrap } from './shared'

const POINTS: { icon: LucideIcon; key: string }[] = [
  { icon: Download, key: 'ld_mob1' },
  { icon: WifiOff, key: 'ld_mob2' },
  { icon: CloudUpload, key: 'ld_mob3' },
  { icon: Laptop, key: 'ld_mob4' },
]

/** a phone showing the installed app's home screen (picture of the app: English, left to right) */
function PhoneMock() {
  const actions: { icon: LucideIcon; label: string; tone: string }[] = [
    { icon: ReceiptText, label: 'Sale', tone: 'bg-brand-50 text-brand-700' },
    { icon: ShoppingCart, label: 'Purchase', tone: 'bg-amber-50 text-amber-700' },
    { icon: HandCoins, label: 'Payment in', tone: 'bg-emerald-50 text-emerald-700' },
    { icon: Package, label: 'Items', tone: 'bg-sky-50 text-sky-800' },
  ]
  return (
    <div aria-hidden dir="ltr" className="relative mx-auto w-full max-w-[22rem] px-6 pb-6 sm:px-10">
      <div className="mx-auto w-[15.5rem] rounded-[2.6rem] p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10" style={{ background: INK }}>
        <div className="relative h-[31rem] overflow-hidden rounded-[2.1rem] bg-page">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full" style={{ background: INK }} />
          {/* app header */}
          <div className="bg-[#0f766e] px-4 pb-4 pt-9 text-white">
            <div className="flex items-center justify-between text-[10px] text-white/70">
              <span>Saudagar</span>
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white"><WifiOff className="size-3" /> Offline, all saved</span>
            </div>
            <div className="mt-2 text-[15px] font-bold">Madina Traders</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/12 p-2.5">
                <div className="text-[10px] text-white/70">Today's sale</div>
                <div className="num text-[13px] font-bold">Rs 48,250</div>
              </div>
              <div className="rounded-xl bg-white/12 p-2.5">
                <div className="text-[10px] text-white/70">To receive</div>
                <div className="num text-[13px] font-bold">Rs 1,26,900</div>
              </div>
            </div>
          </div>
          {/* quick actions */}
          <div className="grid grid-cols-4 gap-1 px-3 py-4">
            {actions.map(({ icon: Icon, label, tone }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-4.5" /></span>
                <span className="text-[9.5px] font-medium leading-tight text-stone-700">{label}</span>
              </div>
            ))}
          </div>
          {/* recent */}
          <div className="mx-3 rounded-xl border border-stone-200 bg-surface">
            {[['Ali Traders', '14,868', 'Paid'], ['Bilal Store', '6,420', 'Due'], ['Walk-in', '1,150', 'Paid']].map(([n, a, s]) => (
              <div key={n} className="flex items-center justify-between border-t border-stone-100 px-3 py-2 first:border-t-0">
                <span className="text-[11px] font-semibold text-stone-800">{n}</span>
                <span className="flex items-center gap-1.5">
                  <span className="num text-[11px] font-bold text-stone-900">{a}</span>
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${s === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{s}</span>
                </span>
              </div>
            ))}
          </div>
          {/* install prompt */}
          <div className="absolute inset-x-3 bottom-4 rounded-2xl bg-surface p-3 shadow-xl ring-1 ring-stone-200">
            <div className="flex items-center gap-2.5">
              <img src="/favicon.svg" alt="" className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-stone-900">Install Saudagar</div>
                <div className="text-[9.5px] text-stone-500">Add to Home screen</div>
              </div>
              <span className="rounded-lg bg-[#0f766e] px-2.5 py-1.5 text-[10px] font-bold text-white">Install</span>
            </div>
          </div>
        </div>
      </div>

      {/* floating backup chip */}
      <div className="absolute bottom-24 left-0 w-44 rounded-2xl bg-surface p-3 shadow-2xl ring-1 ring-stone-200">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><FileJson className="size-4" /></span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold text-stone-900">Backup ready</div>
            <div className="truncate text-[9.5px] text-stone-500">madina-traders.json</div>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 text-[9.5px] font-semibold">
          <span className="flex-1 rounded-md py-1 text-center text-white" style={{ background: WHATSAPP }}>WhatsApp</span>
          <span className="flex-1 rounded-md bg-stone-100 py-1 text-center text-stone-700">Drive</span>
        </div>
      </div>
      <div className="absolute right-0 top-16 flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[10.5px] font-bold text-[#1c1917] shadow-xl">
        <Smartphone className="size-3.5" /> Installed
      </div>
    </div>
  )
}

export function MobileBand() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="ld-mob-title" className="relative overflow-hidden py-20 text-white sm:py-28" style={{ background: DEEP }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -start-32 -top-32 size-[28rem] rounded-full bg-[#14b8a6] opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 end-0 size-[26rem] rounded-full bg-amber-400 opacity-15 blur-3xl" />
      </div>
      <div className={`${wrap} relative grid items-center gap-14 lg:grid-cols-2`}>
        <div>
          <SectionHead id="ld-mob-title" kicker={t('ld_mobKicker')} title={t('ld_mobTitle')} sub={t('ld_mobText')} light />
          <Reveal delay={80}>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {POINTS.map(({ icon: Icon, key }) => (
                <li key={key} className="flex gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Icon aria-hidden className="size-5" /></span>
                  <span className="text-[15px] leading-snug text-white/90">{t(key)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 flex items-start gap-2.5 text-sm text-white/70">
              <span className="mt-0.5 shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-[#1c1917]">{t('ld_soon')}</span>
              <span>{t('ld_mobSoon')}</span>
            </p>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <PhoneMock />
        </Reveal>
      </div>
    </section>
  )
}
