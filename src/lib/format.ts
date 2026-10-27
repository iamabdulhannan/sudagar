/** money and number helpers */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** quantities keep up to 3 decimals (0.25 kg, 1.125 ltr) */
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

const nf2 = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const nf2fixed = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf3 = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 })

/** 12,500 or 12,500.50 */
export const fmtNum = (n: number) => nf2.format(round2(n || 0))
/** always two decimals: 12,500.00 (invoices) */
export const fmtFixed = (n: number) => nf2fixed.format(round2(n || 0))
export const fmtQty = (n: number) => nf3.format(round3(n || 0))

/** Rs 12,500 */
export const fmtMoney = (n: number, symbol = 'Rs') => {
  const v = round2(n || 0)
  return (v < 0 ? '-' : '') + symbol + ' ' + nf2.format(Math.abs(v))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** in Urdu (right to left) Latin dates are wrapped in bidi isolates so "19 Oct 2026" keeps its order */
const ltr = (s: string) => (typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? `\u2066${s}\u2069` : s)

/** 2026-10-19 → 19 Oct 2026 */
export function fmtDate(d?: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return ltr(`${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`)
}

export function fmtDateTime(ms: number) {
  const d = new Date(ms)
  return ltr(d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
}

export function monthStart(d: string) {
  return d.slice(0, 8) + '01'
}

export function monthEnd(d: string) {
  const [y, m] = d.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${d.slice(0, 8)}${String(last).padStart(2, '0')}`
}

/** amount in words for invoices: 12,500 → "Twelve thousand five hundred rupees only" */
export function amountInWords(n: number, currencyWord = 'Rupees'): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (x: number) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''))
  const three = (x: number) => {
    const h = Math.floor(x / 100), r = x % 100
    return [h ? ones[h] + ' Hundred' : '', r ? two(r) : ''].filter(Boolean).join(' ')
  }
  const whole = Math.floor(Math.abs(n))
  const paisa = Math.round((Math.abs(n) - whole) * 100)
  if (whole === 0 && paisa === 0) return `Zero ${currencyWord} Only`
  // South Asian grouping: crore, lakh, thousand, hundred
  const parts: string[] = []
  const crore = Math.floor(whole / 10000000)
  const lakh = Math.floor((whole % 10000000) / 100000)
  const thousand = Math.floor((whole % 100000) / 1000)
  const rest = whole % 1000
  if (crore) parts.push(three(crore) + ' Crore')
  if (lakh) parts.push(two(lakh) + ' Lakh')
  if (thousand) parts.push(two(thousand) + ' Thousand')
  if (rest) parts.push(three(rest))
  let s = parts.join(' ') + ' ' + currencyWord
  if (paisa) s += ' and ' + two(paisa) + ' Paisa'
  return s + ' Only'
}

/** parse a typed number, empty → 0 */
export const num = (v: string | number | undefined | null) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
