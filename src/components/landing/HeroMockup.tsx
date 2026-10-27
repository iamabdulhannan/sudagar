import { useI18n } from '../../lib/i18n'
import { INK, WHATSAPP } from './shared'

/*
 * Laptop + phone composition drawn as one SVG so it scales cleanly at every width.
 * Surfaces use fill-* utilities, so the palette remap gives a dark version for free.
 * The mock content is English and left to right on purpose (it is a picture of the app).
 */

const TEAL = '#0f766e'
const AMBER = '#f59e0b'

const SIDEBAR = ['Dashboard', 'Sale', 'Purchase', 'Items', 'Parties', 'Cash & bank', 'Reports', 'Settings']
const TILES = [
  { label: "Today's sale", value: 'Rs 48,250', hint: '+12% vs yesterday', good: true },
  { label: 'To receive', value: 'Rs 1,26,900', hint: '18 customers' },
  { label: 'To pay', value: 'Rs 38,400', hint: '5 suppliers' },
  { label: 'Cash in hand', value: 'Rs 62,150', hint: 'Bank Rs 2,40,000' },
]
const BARS = [42, 58, 36, 64, 50, 72, 76]
const DAYS = ['W', 'T', 'F', 'S', 'S', 'M', 'T']
const RECENT = [
  { name: 'Ali Traders', amt: 'Rs 14,868', paid: true },
  { name: 'Bilal Store', amt: 'Rs 6,420', paid: false },
  { name: 'Walk-in customer', amt: 'Rs 1,150', paid: true },
  { name: 'Usman & Sons', amt: 'Rs 22,300', paid: false },
]
const LINES = [
  { name: 'Basmati rice 25 kg', qty: '2 x 4,250', amt: '8,500' },
  { name: 'Cooking oil 5 L', qty: '1 x 2,950', amt: '2,950' },
  { name: 'Tea 950 g', qty: '1 x 1,150', amt: '1,150' },
]

export function HeroMockup() {
  const { t } = useI18n()
  return (
    <div dir="ltr" className="relative mx-auto w-full max-w-[640px]">
      <div aria-hidden className="absolute inset-x-[8%] top-[12%] bottom-[6%] rounded-full bg-brand-200 opacity-50 blur-3xl" />
      <svg viewBox="0 0 640 470" role="img" aria-labelledby="ld-hero-art" className="relative h-auto w-full select-none" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        <title id="ld-hero-art">{t('ld_heroArt')}</title>
        <defs>
          <filter id="ld-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0c0a09" floodOpacity="0.22" />
          </filter>
          <filter id="ld-shadow-sm" x="-30%" y="-40%" width="160%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#0c0a09" floodOpacity="0.16" />
          </filter>
          <linearGradient id="ld-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14b8a6" />
            <stop offset="1" stopColor={TEAL} />
          </linearGradient>
          <clipPath id="ld-screen"><rect x="50" y="20" width="480" height="298" rx="6" /></clipPath>
        </defs>

        {/* ---------- laptop ---------- */}
        <g filter="url(#ld-shadow)">
          <rect x="40" y="10" width="500" height="318" rx="14" fill={INK} />
          <path d="M6 328 H574 Q574 344 556 347 H24 Q6 344 6 328 Z" className="fill-stone-300" />
        </g>
        <rect x="255" y="328" width="70" height="5" rx="2.5" className="fill-stone-400" />
        <circle cx="290" cy="15" r="1.8" fill="#44403c" />

        <g clipPath="url(#ld-screen)">
          <rect x="50" y="20" width="480" height="298" className="fill-page" />
          {/* top bar */}
          <rect x="50" y="20" width="480" height="26" className="fill-surface" />
          <line x1="50" y1="46" x2="530" y2="46" className="stroke-stone-200" strokeWidth="1" />
          <rect x="60" y="27" width="12" height="12" rx="3" fill={TEAL} />
          <path d="M63 31.5h6l-.7 5h-4.6z" fill="#fff" />
          <text x="78" y="36.5" fontSize="8" fontWeight="700" className="fill-stone-800">Saudagar</text>
          <rect x="200" y="27.5" width="160" height="11" rx="5.5" className="fill-stone-100" />
          <text x="208" y="35.2" fontSize="5.5" className="fill-stone-400">Search items, parties, invoices</text>
          <rect x="436" y="26.5" width="60" height="13" rx="4" fill={TEAL} />
          <text x="466" y="35.3" fontSize="6" fontWeight="600" textAnchor="middle" fill="#fff">+ New sale</text>
          <circle cx="513" cy="33" r="6.5" fill="#fbbf24" />
          <text x="513" y="35" fontSize="5" fontWeight="700" textAnchor="middle" fill={INK}>MT</text>

          {/* sidebar */}
          <rect x="50" y="46" width="78" height="272" className="fill-surface" />
          <line x1="128" y1="46" x2="128" y2="318" className="stroke-stone-200" strokeWidth="1" />
          {SIDEBAR.map((s, i) => {
            const y = 56 + i * 16
            const active = i === 0
            return (
              <g key={s}>
                {active && <rect x="55" y={y} width="68" height="12" rx="3" className="fill-brand-50" />}
                <rect x="60" y={y + 3} width="6" height="6" rx="1.5" className={active ? 'fill-brand-600' : 'fill-stone-300'} />
                <text x="71" y={y + 8.2} fontSize="5.8" fontWeight={active ? 700 : 500} className={active ? 'fill-brand-700' : 'fill-stone-600'}>{s}</text>
              </g>
            )
          })}

          {/* greeting */}
          <text x="138" y="62" fontSize="8.5" fontWeight="700" className="fill-stone-900">Madina Traders</text>
          <text x="138" y="71.5" fontSize="5.5" className="fill-stone-500">Here is your business today</text>
          <rect x="452" y="56" width="68" height="12" rx="6" className="fill-emerald-100" />
          <circle cx="460" cy="62" r="2" fill="#10b981" />
          <text x="465" y="64" fontSize="5.2" fontWeight="600" className="fill-emerald-700">Offline, all saved</text>

          {/* stat tiles */}
          {TILES.map((s, i) => {
            const x = 138 + i * 97.33
            return (
              <g key={s.label}>
                <rect x={x} y="80" width="89" height="44" rx="6" className="fill-surface stroke-stone-200" strokeWidth="0.8" />
                <rect x={x + 8} y="87" width="10" height="3" rx="1.5" fill={i === 0 ? AMBER : TEAL} opacity={i === 0 ? 1 : 0.55} />
                <text x={x + 8} y="99" fontSize="5.4" className="fill-stone-500">{s.label}</text>
                <text x={x + 8} y="110" fontSize="9.5" fontWeight="700" className="fill-stone-900">{s.value}</text>
                <text x={x + 8} y="118.5" fontSize="4.8" fontWeight={s.good ? 600 : 400} className={s.good ? 'fill-emerald-700' : 'fill-stone-400'}>{s.hint}</text>
              </g>
            )
          })}

          {/* sales chart */}
          <rect x="138" y="132" width="240" height="130" rx="6" className="fill-surface stroke-stone-200" strokeWidth="0.8" />
          <text x="148" y="146" fontSize="6.8" fontWeight="700" className="fill-stone-800">Sales, last 7 days</text>
          <text x="368" y="146" fontSize="6" fontWeight="600" textAnchor="end" className="fill-stone-500">Rs 2,84,600</text>
          {[166, 186, 206, 226].map((y) => <line key={y} x1="148" y1={y} x2="368" y2={y} className="stroke-stone-100" strokeWidth="0.8" />)}
          <line x1="148" y1="242" x2="368" y2="242" className="stroke-stone-200" strokeWidth="0.8" />
          {BARS.map((h, i) => {
            const x = 154 + i * 30.5
            const today = i === BARS.length - 1
            return (
              <g key={i}>
                <rect x={x} y={242 - h} width="18" height={h} rx="3" fill={today ? AMBER : 'url(#ld-bar)'} opacity={today ? 1 : 0.9} />
                <text x={x + 9} y="253" fontSize="5" textAnchor="middle" fontWeight={today ? 700 : 400} className={today ? 'fill-stone-800' : 'fill-stone-400'}>{DAYS[i]}</text>
              </g>
            )
          })}
          <g>
            <rect x="322" y="150" width="48" height="12" rx="3.5" fill={INK} />
            <text x="346" y="158" fontSize="5.2" fontWeight="600" textAnchor="middle" fill="#fff">Today 48,250</text>
          </g>

          {/* recent invoices */}
          <rect x="386" y="132" width="134" height="130" rx="6" className="fill-surface stroke-stone-200" strokeWidth="0.8" />
          <text x="396" y="146" fontSize="6.8" fontWeight="700" className="fill-stone-800">Recent invoices</text>
          {RECENT.map((r, i) => {
            const y = 156 + i * 26
            return (
              <g key={r.name}>
                {i > 0 && <line x1="396" y1={y - 3} x2="510" y2={y - 3} className="stroke-stone-100" strokeWidth="0.8" />}
                <circle cx="402" cy={y + 8} r="5.5" className={r.paid ? 'fill-brand-50' : 'fill-amber-50'} />
                <text x="402" y={y + 10} fontSize="5" fontWeight="700" textAnchor="middle" className={r.paid ? 'fill-brand-700' : 'fill-amber-700'}>{r.name[0]}</text>
                <text x="411" y={y + 6.5} fontSize="5.6" fontWeight="600" className="fill-stone-800">{r.name}</text>
                <text x="411" y={y + 14} fontSize="4.6" className="fill-stone-400">INV-{1042 - i}</text>
                <text x="510" y={y + 6.5} fontSize="5.6" fontWeight="700" textAnchor="end" className="fill-stone-900">{r.amt}</text>
                <rect x="489" y={y + 9.5} width="21" height="7" rx="3.5" className={r.paid ? 'fill-emerald-100' : 'fill-amber-100'} />
                <text x="499.5" y={y + 14.5} fontSize="4.3" fontWeight="700" textAnchor="middle" className={r.paid ? 'fill-emerald-700' : 'fill-amber-700'}>{r.paid ? 'Paid' : 'Due'}</text>
              </g>
            )
          })}

          {/* low stock + reminders */}
          <rect x="138" y="270" width="240" height="40" rx="6" className="fill-amber-50 stroke-amber-200" strokeWidth="0.8" />
          <path d="M152 280 l6 11 h-12 z" fill={AMBER} />
          <rect x="151.4" y="283.5" width="1.2" height="4" fill="#fff" />
          <rect x="151.4" y="288.6" width="1.2" height="1.2" fill="#fff" />
          <text x="166" y="284" fontSize="6.5" fontWeight="700" className="fill-amber-900">Low stock: 3 items</text>
          <text x="166" y="294" fontSize="5.2" className="fill-amber-800">Sugar 50 kg, Cooking oil 5 L, Tea 950 g</text>
          <rect x="328" y="282" width="42" height="14" rx="4" className="fill-surface stroke-amber-300" strokeWidth="0.8" />
          <text x="349" y="291.2" fontSize="5.4" fontWeight="600" textAnchor="middle" className="fill-amber-800">Reorder</text>

          <rect x="386" y="270" width="134" height="40" rx="6" className="fill-surface stroke-stone-200" strokeWidth="0.8" />
          <circle cx="400" cy="290" r="7" fill={WHATSAPP} />
          <path d="M397 292.6 l.6-2.2 a3.6 3.6 0 1 1 1.4 1.4 z" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
          <text x="412" y="287" fontSize="6.2" fontWeight="700" className="fill-stone-800">Payment reminders</text>
          <text x="412" y="296" fontSize="5.2" className="fill-stone-500">4 due today, send on WhatsApp</text>
        </g>

        {/* ---------- floating chips ---------- */}
        <g filter="url(#ld-shadow-sm)">
          <rect x="0" y="112" width="104" height="30" rx="9" className="fill-surface" />
        </g>
        <circle cx="16" cy="127" r="8" className="fill-brand-50" />
        <path d="M12 127.5 l2.6 2.6 l5-5.2" fill="none" className="stroke-brand-700" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="29" y="124.5" fontSize="5.3" className="fill-stone-500">No internet?</text>
        <text x="29" y="133.5" fontSize="6.6" fontWeight="700" className="fill-stone-900">Still billing</text>

        <g filter="url(#ld-shadow-sm)">
          <rect x="30" y="364" width="170" height="40" rx="11" className="fill-surface" />
        </g>
        <circle cx="52" cy="384" r="10" className="fill-emerald-100" />
        <text x="52" y="387.5" fontSize="9" fontWeight="700" textAnchor="middle" className="fill-emerald-700">Rs</text>
        <text x="69" y="380" fontSize="5.6" className="fill-stone-500">Payment received</text>
        <text x="69" y="391" fontSize="7.2" fontWeight="700" className="fill-stone-900">Rs 12,000, Bilal Store</text>

        {/* ---------- phone ---------- */}
        <g filter="url(#ld-shadow)">
          <rect x="476" y="148" width="152" height="308" rx="24" fill={INK} />
        </g>
        <rect x="482" y="154" width="140" height="296" rx="19" className="fill-surface" />
        <rect x="530" y="159" width="44" height="9" rx="4.5" fill={INK} />

        <text x="492" y="186" fontSize="8" fontWeight="700" className="fill-stone-900">Sale invoice</text>
        <rect x="582" y="178" width="30" height="11" rx="5.5" className="fill-emerald-100" />
        <text x="597" y="185.6" fontSize="5.4" fontWeight="700" textAnchor="middle" className="fill-emerald-700">Paid</text>

        <rect x="490" y="194" width="124" height="176" rx="8" className="fill-page stroke-stone-200" strokeWidth="0.8" />
        <rect x="498" y="202" width="11" height="11" rx="3" fill={TEAL} />
        <path d="M500.6 206.2h5.8l-.7 4.6h-4.4z" fill="#fff" />
        <text x="513" y="208.5" fontSize="6.4" fontWeight="700" className="fill-stone-900">Madina Traders</text>
        <text x="513" y="214.5" fontSize="4.2" className="fill-stone-500">Liberty Market, Lahore</text>
        <text x="498" y="225" fontSize="4.2" className="fill-stone-500">NTN 4417282-6   STRN 32-77-8761-401-12</text>
        <text x="498" y="235" fontSize="5" fontWeight="600" className="fill-stone-800">Bill to: Ali Traders</text>
        <text x="606" y="235" fontSize="4.6" textAnchor="end" className="fill-stone-500">INV-1042</text>
        <line x1="498" y1="241" x2="606" y2="241" className="stroke-stone-200" strokeWidth="0.8" />
        {LINES.map((l, i) => {
          const y = 251 + i * 12
          return (
            <g key={l.name}>
              <text x="498" y={y} fontSize="4.9" fontWeight="500" className="fill-stone-800">{l.name}</text>
              <text x="498" y={y + 5.5} fontSize="4" className="fill-stone-400">{l.qty}</text>
              <text x="606" y={y + 2} fontSize="5" fontWeight="600" textAnchor="end" className="fill-stone-800">{l.amt}</text>
            </g>
          )
        })}
        <line x1="498" y1="287" x2="606" y2="287" className="stroke-stone-200" strokeWidth="0.8" />
        <text x="498" y="296" fontSize="4.8" className="fill-stone-500">Subtotal</text>
        <text x="606" y="296" fontSize="4.8" textAnchor="end" className="fill-stone-700">12,600</text>
        <text x="498" y="305" fontSize="4.8" className="fill-stone-500">Sales tax (GST 18%)</text>
        <text x="606" y="305" fontSize="4.8" textAnchor="end" className="fill-stone-700">2,268</text>
        <rect x="498" y="311" width="108" height="16" rx="4" className="fill-brand-50" />
        <text x="503" y="321.6" fontSize="5.8" fontWeight="700" className="fill-brand-800">Total</text>
        <text x="601" y="321.8" fontSize="7" fontWeight="700" textAnchor="end" className="fill-brand-800">Rs 14,868</text>
        <text x="552" y="340" fontSize="4.2" textAnchor="middle" className="fill-stone-400">Thank you for shopping with us</text>
        {/* tiny barcode */}
        {[0, 2, 3, 5, 8, 9, 11, 14, 15, 17, 20, 21, 23, 26, 27, 29, 31, 32].map((b, i) => (
          <rect key={i} x={533 + b * 2.1} y="347" width={i % 3 === 0 ? 1.6 : 0.9} height="12" className="fill-stone-700" />
        ))}

        <rect x="490" y="380" width="124" height="21" rx="6" fill={WHATSAPP} />
        <circle cx="508" cy="390.5" r="4.6" fill="none" stroke="#fff" strokeWidth="1" />
        <path d="M505 394 l.8 -2" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        <text x="558" y="393" fontSize="6.4" fontWeight="700" textAnchor="middle" fill="#fff">Share on WhatsApp</text>
        <rect x="490" y="407" width="59" height="18" rx="6" className="fill-surface stroke-stone-300" strokeWidth="0.8" />
        <text x="519.5" y="418.6" fontSize="5.8" fontWeight="600" textAnchor="middle" className="fill-stone-700">Print</text>
        <rect x="555" y="407" width="59" height="18" rx="6" className="fill-surface stroke-stone-300" strokeWidth="0.8" />
        <text x="584.5" y="418.6" fontSize="5.8" fontWeight="600" textAnchor="middle" className="fill-stone-700">PDF</text>
        <rect x="527" y="437" width="50" height="3.5" rx="1.75" className="fill-stone-300" />
      </svg>
    </div>
  )
}
