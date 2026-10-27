import { AlertTriangle, BellRing, CheckCheck, MessageCircle, Printer, ScanBarcode, TrendingUp } from 'lucide-react'
import { cx } from '../../lib/cx'
import { WHATSAPP } from './shared'

/*
 * Illustrated panels for the feature rows. They are pictures of the app, so they stay English and
 * left to right (the Stage wrapper sets dir="ltr") and are hidden from screen readers; the row text says it all.
 */

const card = 'rounded-2xl border border-stone-200 bg-surface shadow-xl shadow-stone-900/5'

function Logo() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0f766e]">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M5 9h14l-1.6 11H6.6z" fill="#fff" />
        <path d="M9 9V7.5a3 3 0 0 1 6 0V9" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** a believable EAN-13 style barcode from a fixed pattern */
export function Barcode({ className }: { className?: string }) {
  const w = [1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 1]
  let x = 0
  const bars = w.map((b, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y="0" width={b} height="20" /> : null
    x += b
    return r
  })
  return <svg viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" className={cx('fill-current', className)} aria-hidden>{bars}</svg>
}

// ---------- 1. GST invoice + WhatsApp ----------

export function InvoiceMock() {
  const rows = [
    { item: 'Basmati rice 25 kg', qty: 2, rate: '4,250', amt: '8,500' },
    { item: 'Cooking oil 5 L', qty: 1, rate: '2,950', amt: '2,950' },
    { item: 'Tea 950 g', qty: 1, rate: '1,150', amt: '1,150' },
  ]
  return (
    <div aria-hidden className="relative pb-16 sm:pb-12">
      <div className={cx(card, 'p-4 text-[12px] sm:p-6 sm:text-[13px]')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0">
              <div className="truncate font-bold text-stone-900">Madina Traders</div>
              <div className="truncate text-[11px] text-stone-500">Shop 12, Liberty Market, Lahore</div>
            </div>
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[10px] font-bold tracking-wider text-brand-700">TAX INVOICE</div>
            <div className="num font-semibold text-stone-800">INV-1042</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-stone-600">NTN <span className="num">4417282-6</span></span>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-stone-600">STRN <span className="num">32-77-8761-401-12</span></span>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-stone-600">Bill to: Ali Traders</span>
        </div>
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-[10.5px] uppercase tracking-wide text-stone-500">
              <th className="py-1.5 text-start font-semibold">Item</th>
              <th className="py-1.5 text-end font-semibold">Qty</th>
              <th className="hidden py-1.5 text-end font-semibold min-[420px]:table-cell">Rate</th>
              <th className="py-1.5 text-end font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r) => (
              <tr key={r.item} className="border-b border-stone-100">
                <td className="py-2 font-medium text-stone-800">{r.item}</td>
                <td className="py-2 text-end text-stone-600">{r.qty}</td>
                <td className="hidden py-2 text-end text-stone-600 min-[420px]:table-cell">{r.rate}</td>
                <td className="py-2 text-end font-semibold text-stone-800">{r.amt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ms-auto mt-3 grid max-w-[15rem] grid-cols-[1fr_auto] gap-x-6 gap-y-1">
          <dt className="text-stone-500">Subtotal</dt><dd className="num text-end text-stone-700">12,600</dd>
          <dt className="text-stone-500">Sales tax (GST 18%)</dt><dd className="num text-end text-stone-700">2,268</dd>
          <dt className="mt-1 border-t border-stone-200 pt-1.5 font-bold text-stone-900">Total</dt>
          <dd className="num mt-1 border-t border-stone-200 pt-1.5 text-end text-base font-bold text-brand-700">Rs 14,868</dd>
        </dl>
      </div>

      {/* WhatsApp bubble */}
      <div className="absolute bottom-0 left-3 right-3 sm:left-auto sm:right-[-0.5rem] sm:w-72">
        <div className="rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-[12px] text-[#111b21] shadow-xl">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-bold text-[#b91c1c]">PDF</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">INV-1042 Madina Traders.pdf</div>
              <div className="text-[11px] text-[#54656f]">Total Rs 14,868, thank you!</div>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#54656f]">
            7:42 pm <CheckCheck className="size-3.5 text-[#53bdeb]" />
          </div>
        </div>
      </div>
      <div className="absolute -top-3 right-4 hidden items-center gap-1.5 rounded-full bg-[#1c1917] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg min-[420px]:flex">
        <Printer className="size-3.5 text-amber-300" /> A4, A5, 80 mm, 58 mm
      </div>
    </div>
  )
}

// ---------- 2. stock with barcode, batches, godowns ----------

export function StockMock() {
  const items = [
    { name: 'Panadol 500 mg', meta: 'Batch B-2207, exp Mar 2027', qty: '24 box + 6 strip', tone: 'ok' as const },
    { name: 'Cooking oil 5 L', meta: 'Reorder at 10', qty: '4 tin', tone: 'low' as const },
    { name: 'Infinix Hot 50', meta: 'IMEI 35 8812 1045 2219', qty: '7 pcs', tone: 'ok' as const },
  ]
  return (
    <div aria-hidden className="relative">
      <div className={cx(card, 'overflow-hidden text-[12px] sm:text-[13px]')}>
        <div className="flex items-center gap-1 border-b border-stone-200 bg-stone-50 p-2">
          {['Main shop', 'Godown 2', 'Cold room'].map((g, i) => (
            <span key={g} className={cx('rounded-lg px-3 py-1.5 font-semibold', i === 0 ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500')}>{g}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0"><b className="font-semibold">Low stock:</b> Cooking oil 5 L, 4 left</span>
        </div>
        <ul className="divide-y divide-stone-100">
          {items.map((it) => (
            <li key={it.name} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-10 w-14 shrink-0 place-items-center rounded-md border border-stone-200 bg-white px-1.5 text-[#1c1917]">
                <Barcode className="h-6 w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-stone-900">{it.name}</div>
                <div className="truncate text-[11px] text-stone-500">{it.meta}</div>
              </div>
              <span className={cx('num shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', it.tone === 'low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700')}>{it.qty}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 border-t border-stone-200 bg-stone-50 text-center text-[11px]">
          {[['Items', '1,284'], ['Stock value', 'Rs 7.8 lakh'], ['Expiring', '3 batches']].map(([k, v]) => (
            <div key={k} className="border-s border-stone-200 px-2 py-2.5 first:border-s-0">
              <div className="text-stone-500">{k}</div>
              <div className="num font-bold text-stone-900">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -top-4 right-3 flex items-center gap-2 rounded-xl bg-[#1c1917] px-3 py-2 text-[11px] text-white shadow-xl">
        <ScanBarcode className="size-4 text-amber-300" />
        <span>Scanned <span className="num font-semibold">8964000123457</span></span>
      </div>
    </div>
  )
}

// ---------- 3. khata + WhatsApp reminder ----------

export function KhataMock() {
  const rows = [
    { d: '02 Oct', what: 'Sale INV-1018', dr: '12,400', cr: '', bal: '12,400' },
    { d: '09 Oct', what: 'Payment in, JazzCash', dr: '', cr: '5,000', bal: '7,400' },
    { d: '15 Oct', what: 'Sale INV-1036', dr: '11,100', cr: '', bal: '18,500' },
  ]
  return (
    <div aria-hidden className="relative pb-24 sm:pb-16">
      <div className={cx(card, 'overflow-hidden text-[12px] sm:text-[13px]')}>
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 font-bold text-amber-800">BS</span>
            <div className="min-w-0">
              <div className="truncate font-bold text-stone-900">Bilal Store</div>
              <div className="truncate text-[11px] text-stone-500">Credit limit Rs 25,000</div>
            </div>
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[11px] text-stone-500">You will get</div>
            <div className="num text-lg font-bold text-red-600">Rs 18,500</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-stone-50 text-stone-500">
                <th className="px-4 py-2 text-start font-semibold">Date</th>
                <th className="px-2 py-2 text-start font-semibold">Details</th>
                <th className="px-2 py-2 text-end font-semibold">Debit</th>
                <th className="px-2 py-2 text-end font-semibold">Credit</th>
                <th className="px-4 py-2 text-end font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.d} className="border-t border-stone-100">
                  <td className="num whitespace-nowrap px-4 py-2 text-stone-500">{r.d}</td>
                  <td className="px-2 py-2 text-stone-800">{r.what}</td>
                  <td className="num px-2 py-2 text-end text-stone-700">{r.dr}</td>
                  <td className="num px-2 py-2 text-end text-emerald-700">{r.cr}</td>
                  <td className="num px-4 py-2 text-end font-semibold text-stone-900">{r.bal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-amber-800"><BellRing className="size-3.5" /> 1 invoice overdue by 5 days</span>
          <span className="rounded-md px-2.5 py-1 font-semibold text-white" style={{ background: WHATSAPP }}>Remind</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-3 right-3 sm:left-auto sm:right-[-0.5rem] sm:w-80">
        <div className="rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-[12px] leading-relaxed text-[#111b21] shadow-xl">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#008069]"><MessageCircle className="size-3.5" /> Madina Traders</div>
          Assalam o Alaikum, Bilal Store. Your balance with us is <b>Rs 18,500</b>. Kindly pay at your convenience. Thank you!
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#54656f]">10:15 am <CheckCheck className="size-3.5 text-[#53bdeb]" /></div>
        </div>
      </div>
    </div>
  )
}

// ---------- 4. accounting reports ----------

export function ReportsMock() {
  const pl = [
    { k: 'Sales', v: '8,45,000' },
    { k: 'Cost of goods sold', v: '(5,92,300)', muted: true },
    { k: 'Gross profit', v: '2,52,700', strong: true },
    { k: 'Expenses', v: '(96,400)', muted: true },
  ]
  const flow = [
    { m: 'May', i: 52, o: 40 }, { m: 'Jun', i: 60, o: 46 }, { m: 'Jul', i: 48, o: 44 },
    { m: 'Aug', i: 70, o: 52 }, { m: 'Sep', i: 66, o: 50 }, { m: 'Oct', i: 82, o: 58 },
  ]
  return (
    <div aria-hidden className="relative grid gap-4 sm:grid-cols-[1.15fr_1fr]">
      <div className={cx(card, 'p-4 text-[12px] sm:p-5 sm:text-[13px]')}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-stone-900">Profit &amp; loss</div>
          <div className="rounded-md bg-stone-100 px-2 py-0.5 text-[10.5px] text-stone-600">Jul to Oct</div>
        </div>
        <dl className="mt-3 space-y-2">
          {pl.map((r) => (
            <div key={r.k} className={cx('flex justify-between gap-3', r.strong && 'border-t border-stone-200 pt-2')}>
              <dt className={r.muted ? 'text-stone-500' : 'font-medium text-stone-800'}>{r.k}</dt>
              <dd className={cx('num', r.muted ? 'text-stone-500' : 'font-semibold text-stone-900')}>{r.v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
          <span className="font-bold text-emerald-800">Net profit</span>
          <span className="num flex items-center gap-1 text-base font-bold text-emerald-700"><TrendingUp className="size-4" /> Rs 1,56,300</span>
        </div>
      </div>

      <div className="grid gap-4">
        <div className={cx(card, 'p-4 text-[12px] sm:p-5')}>
          <div className="font-bold text-stone-900">Cash flow</div>
          <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
            {flow.map((f) => (
              <div key={f.m} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end justify-center gap-0.5">
                  <span className="w-1/2 max-w-2.5 rounded-t-sm bg-[#0d9488]" style={{ height: `${f.i}%` }} />
                  <span className="w-1/2 max-w-2.5 rounded-t-sm bg-amber-400" style={{ height: `${f.o}%` }} />
                </div>
                <span className="text-[10px] text-stone-500">{f.m}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-[10.5px] text-stone-500">
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#0d9488]" />Money in</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-amber-400" />Money out</span>
          </div>
        </div>
        <div className={cx(card, 'p-4 text-[12px] sm:p-5')}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900">Balance sheet</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Balanced</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-stone-50 p-2"><div className="text-stone-500">Assets</div><div className="num font-bold text-stone-900">24,80,000</div></div>
            <div className="rounded-lg bg-stone-50 p-2"><div className="text-stone-500">Liabilities + capital</div><div className="num font-bold text-stone-900">24,80,000</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
