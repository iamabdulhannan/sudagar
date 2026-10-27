/**
 * Barcode helpers with no React or DOM: a Code 128 (set B) encoder for labels and
 * an EAN-13 style number generator for new items. Pure, so tests can run in node.
 */

/** bar / space widths of the 107 Code 128 symbols (0 to 105 have 6 elements, 106 = stop has 7) */
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

export const START_B = 104
export const STOP = 106

/** characters Code 128 set B can carry: printable ASCII 32 to 126 */
export const isCode128B = (text: string) => /^[\x20-\x7e]+$/.test(text)

/** symbol values for text: start B, data, checksum, stop. Throws on characters outside set B. */
export function code128Values(text: string): number[] {
  if (!text || !isCode128B(text)) throw new Error('Code 128 B supports printable ASCII only')
  const data = [...text].map((c) => c.charCodeAt(0) - 32)
  const check = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103
  return [START_B, ...data, check, STOP]
}

/** the barcode as modules: '1' = bar, '0' = space (no quiet zone) */
export function encodeCode128(text: string): string {
  let out = ''
  for (const v of code128Values(text)) {
    const p = CODE128_PATTERNS[v]
    for (let i = 0; i < p.length; i++) out += (i % 2 === 0 ? '1' : '0').repeat(Number(p[i]))
  }
  return out
}

export interface Bar { x: number; w: number }

/** bars as rectangles in module units, plus the total width including a 10 module quiet zone each side */
export function code128Bars(text: string, quiet = 10): { bars: Bar[]; width: number } {
  const mods = encodeCode128(text)
  const bars: Bar[] = []
  let i = 0
  while (i < mods.length) {
    if (mods[i] === '1') {
      let j = i
      while (j < mods.length && mods[j] === '1') j++
      bars.push({ x: quiet + i, w: j - i })
      i = j
    } else i++
  }
  return { bars, width: mods.length + quiet * 2 }
}

/** a standalone SVG string of the barcode (bars only, text is printed separately) */
export function code128Svg(text: string, opts: { height?: number; module?: number; color?: string } = {}): string {
  const { height = 40, module = 1, color = '#000' } = opts
  const { bars, width } = code128Bars(text)
  const rects = bars.map((b) => `<rect x="${b.x * module}" y="0" width="${b.w * module}" height="${height}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * module}" height="${height}" viewBox="0 0 ${width * module} ${height}" fill="${color}" shape-rendering="crispEdges">${rects}</svg>`
}

/** decode modules back to text (used by tests to check the encoder round trip) */
export function decodeCode128(mods: string): string {
  const widths: number[] = []
  let i = 0
  while (i < mods.length) {
    let j = i
    while (j < mods.length && mods[j] === mods[i]) j++
    widths.push(j - i)
    i = j
  }
  const values: number[] = []
  let k = 0
  while (k < widths.length) {
    const take = widths.length - k === 7 ? 7 : 6
    const v = CODE128_PATTERNS.indexOf(widths.slice(k, k + take).join(''))
    if (v < 0) throw new Error('bad symbol')
    values.push(v)
    k += take
  }
  if (values[0] !== START_B || values[values.length - 1] !== STOP) throw new Error('not Code 128 B')
  const data = values.slice(1, -2)
  const check = data.reduce((sum, v, idx) => sum + v * (idx + 1), START_B) % 103
  if (check !== values[values.length - 2]) throw new Error('bad checksum')
  return data.map((v) => String.fromCharCode(v + 32)).join('')
}

// ---------- EAN-13 style numbers ----------

/** EAN-13 check digit for the first 12 digits */
export function ean13CheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export const isValidEan13 = (code: string) => /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])

/**
 * a new 13 digit number with a valid check digit, in the "2" in-store range so it never
 * clashes with a manufacturer's barcode, and not in `taken`
 */
export function generateEan13(taken: Set<string> = new Set(), random: () => number = Math.random): string {
  for (let tries = 0; tries < 1000; tries++) {
    let d = '2'
    for (let i = 0; i < 11; i++) d += Math.floor(random() * 10)
    const code = d + ean13CheckDigit(d)
    if (!taken.has(code)) return code
  }
  throw new Error('could not generate a unique barcode')
}
