import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CODE128_PATTERNS, code128Bars, code128Svg, code128Values, decodeCode128, ean13CheckDigit, encodeCode128, generateEan13, isValidEan13,
} from '../src/components/items/barcode'

test('every Code 128 pattern has 11 modules (stop has 13) and they are unique', () => {
  assert.equal(CODE128_PATTERNS.length, 107)
  CODE128_PATTERNS.forEach((p, i) => {
    const sum = [...p].reduce((a, c) => a + Number(c), 0)
    assert.equal(sum, i === 106 ? 13 : 11, `pattern ${i}`)
  })
  assert.equal(new Set(CODE128_PATTERNS).size, 107)
})

test('checksum and symbol values', () => {
  // A = 33: (104 + 33 * 1) % 103 = 34
  assert.deepEqual(code128Values('A'), [104, 33, 34, 106])
  // "Wikipedia": 104 + 55 + 2*73 + 3*75 + 4*73 + 5*80 + 6*69 + 7*68 + 8*73 + 9*65 = 3281, % 103 = 88
  const v = code128Values('Wikipedia')
  assert.equal(v[v.length - 2], 88)
  assert.throws(() => code128Values('café'))
  assert.throws(() => code128Values(''))
})

test('modules start with Start B, end with Stop and have the right length', () => {
  const m = encodeCode128('ABC-123')
  assert.ok(m.startsWith('11010010000'))
  assert.ok(m.endsWith('1100011101011'))
  assert.equal(m.length, 11 * (7 + 3) + 2)
  assert.ok(m.startsWith('1') && m.endsWith('1'))
})

test('encode and decode round trip', () => {
  for (const s of ['2001234567893', 'SKU-0042', 'hello world', '~!@#$%^&*()_+{}|:<>?', 'a']) {
    assert.equal(decodeCode128(encodeCode128(s)), s)
  }
})

test('bars and svg', () => {
  const { bars, width } = code128Bars('A')
  assert.equal(width, 11 * 4 + 2 + 20)
  assert.equal(bars[0].x, 10)
  assert.equal(bars[0].w, 2)
  const total = bars.reduce((a, b) => a + b.w, 0)
  assert.equal(total, [...encodeCode128('A')].filter((c) => c === '1').length)
  assert.match(code128Svg('A'), /^<svg[^>]+viewBox="0 0 66 40"/)
})

test('EAN-13 check digit and generator', () => {
  assert.equal(ean13CheckDigit('400638133393'), 1) // 4006381333931
  assert.ok(isValidEan13('4006381333931'))
  assert.ok(!isValidEan13('4006381333932'))
  const taken = new Set<string>()
  for (let i = 0; i < 50; i++) {
    const c = generateEan13(taken)
    assert.ok(isValidEan13(c))
    assert.ok(c.startsWith('2'))
    assert.ok(!taken.has(c))
    taken.add(c)
  }
})
