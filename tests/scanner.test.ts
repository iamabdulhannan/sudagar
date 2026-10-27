import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feedKey, parseScaleBarcode, scanLookup, validEan13, type ScanBuffer } from '../src/lib/scanner'
import type { Item } from '../src/lib/types'

const empty = (): ScanBuffer => ({ chars: '', first: 0, last: 0, fast: true })
const type = (text: string, gap: number, end = 'Enter') => {
  let buf = empty(), t = 1000
  for (const ch of text) { buf = feedKey(buf, ch, (t += gap)).buf }
  return feedKey(buf, end, t + gap).code
}

test('a scanner burst is a scan, a person typing is not', () => {
  assert.equal(type('8961234500011', 8), '8961234500011')
  assert.equal(type('SOAP', 12, 'Tab'), 'SOAP')
  assert.equal(type('8961234500011', 120), null, 'human speed')
  assert.equal(type('12', 5), null, 'too short')
})

test('scale labels and lookup', () => {
  // 21 00042 01250 + check digit
  const body = '210004201250'
  const sum = body.split('').map(Number).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0)
  const label = body + ((10 - (sum % 10)) % 10)
  assert.equal(validEan13(label), true)
  assert.equal(validEan13(label.slice(0, 12) + ((Number(label[12]) + 1) % 10)), false)
  assert.deepEqual(parseScaleBarcode(label), { plu: '00042', grams: 1250 })
  const item = (id: string, code: string, unit = 'kg', barcode?: string): Item => ({ id, kind: 'product', name: id, code, barcode, unit, salePrice: 1, purchasePrice: 1, taxRate: 0, priceIncludesTax: false, openingStock: 0, openingDate: '2026-01-01', active: true, createdAt: 0 })
  const items = [item('sugar', '42'), item('soap', 'SOAP', 'pcs', '8961234500011')]
  assert.equal(scanLookup(items, '8961234500011')?.item.id, 'soap')
  assert.equal(scanLookup(items, 'soap')?.item.id, 'soap', 'item code, any case')
  assert.deepEqual(scanLookup(items, label), { item: items[0], qty: 1.25 })
  assert.equal(scanLookup(items, '0000000'), null)
})
