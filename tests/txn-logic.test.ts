import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../src/lib/db'
import { computeDues } from '../src/lib/ledger'
import { blankTxn, calcTotals, lineFor } from '../src/lib/txn'
import type { Item, Party, Txn } from '../src/lib/types'
import {
  addOrIncrement, balanceDue, changeUnit, convertTargets, docStatus, docTitleKey, duplicateDraft, matchesSearch,
  normalizePkPhone, repriceLines, stockShortages,
} from '../src/components/txn/logic'
import { normalize } from '../src/components/txn/form/useDraft'

const s = defaultSettings('wholesale')
s.features.tax = false
s.features.roundOff = false
s.features.wholesale = true

const soap: Item = {
  id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', altUnit: 'box', altFactor: 12, salePrice: 120, wholesalePrice: 100,
  purchasePrice: 80, taxRate: 0, priceIncludesTax: false, openingStock: 10, openingDate: '2026-01-01', active: true, createdAt: 0,
}
const ali: Party = { id: 'ali', name: 'Ali Traders', kind: 'customer', openingBalance: 0, openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0 }
const whole: Party = { ...ali, id: 'w', priceTier: 'wholesale' }
const items = new Map([[soap.id, soap]])

function sale(over: Partial<Txn>, qty = 1): Txn {
  return calcTotals({ ...blankTxn('sale', s), partyId: 'ali', lines: [lineFor(soap, 'sale', ali, s, qty)], ...over }, s)
}

test('Pakistani phone numbers become wa.me numbers', () => {
  assert.equal(normalizePkPhone('0300-1234567'), '923001234567')
  assert.equal(normalizePkPhone('+92 300 1234567'), '923001234567')
  assert.equal(normalizePkPhone('00923001234567'), '923001234567')
  assert.equal(normalizePkPhone('3001234567'), '923001234567')
  assert.equal(normalizePkPhone(''), '')
  assert.equal(normalizePkPhone(undefined), '')
})

test('status: paid, partial, unpaid, overdue, open, cancelled', () => {
  const a = sale({ id: 'a', date: '2026-03-01', dueDate: '2026-03-10', received: 0, createdAt: 1 })
  const b = sale({ id: 'b', date: '2026-03-02', received: 50, createdAt: 2 })
  const c = sale({ id: 'c', date: '2026-03-03', received: 120, createdAt: 3 })
  const dues = computeDues({ items: [soap], parties: [ali], accounts: [], txns: [a, b, c], adjustments: [] })
  assert.equal(docStatus(a, dues, '2026-03-05'), 'unpaid')
  assert.equal(docStatus(a, dues, '2026-03-11'), 'overdue')
  assert.equal(docStatus(b, dues, '2026-03-05'), 'partial')
  assert.equal(docStatus(c, dues, '2026-03-05'), 'paid')
  assert.equal(balanceDue(b, dues), 70)
  assert.equal(docStatus({ ...c, cancelled: true }, dues, '2026-03-05'), 'cancelled')
  assert.equal(docStatus(blankTxn('estimate', s), dues, '2026-03-05'), 'open')
  assert.equal(docStatus(blankTxn('payment_in', s), dues, '2026-03-05'), undefined)
})

test('adding the same item again adds to its quantity', () => {
  let lines = addOrIncrement([], lineFor(soap, 'sale', ali, s, 1))
  lines = addOrIncrement(lines, lineFor(soap, 'sale', ali, s, 2))
  assert.equal(lines.length, 1)
  assert.equal(lines[0].qty, 3)
  // a box line is a different line
  lines = addOrIncrement(lines, changeUnit(lineFor(soap, 'sale', ali, s, 1), soap, 'box'))
  assert.equal(lines.length, 2)
  assert.equal(lines[1].factor, 12)
  assert.equal(lines[1].rate, 1440)
})

test('wholesale customers get the wholesale price; typed rates are kept', () => {
  const auto = lineFor(soap, 'sale', ali, s, 1)
  const typed = { ...auto, rate: 111 }
  const next = repriceLines([auto, typed], { lines: [auto, typed], party: ali }, { lines: [auto, typed], party: whole }, items, 'sale', s)
  assert.equal(next[0].rate, 100)
  assert.equal(next[1].rate, 111)
})

test('stock shortages count the original document back when editing', () => {
  const qty = new Map([[soap.id, 5]])
  const t = sale({}, 8)
  assert.deepEqual(stockShortages(t, qty, items).map((x) => [x.need, x.inStock]), [[8, 5]])
  const original = sale({}, 4)
  assert.equal(stockShortages(t, qty, items, original).length, 0)
  assert.equal(stockShortages({ ...t, type: 'purchase' }, qty, items).length, 0)
})

test('walk-in sales are forced paid in full; credit sales keep what was typed', () => {
  const walk = normalize(sale({ partyId: undefined, received: 0 }), s, false)
  assert.equal(walk.received, walk.total)
  const credit = normalize(sale({ received: 50 }), s, false)
  assert.equal(credit.received, 50)
  const full = normalize(sale({ received: 50 }), s, true)
  assert.equal(full.received, full.total)
  const pay = normalize({ ...blankTxn('payment_in', s), partyId: 'ali', total: 500 }, s, false)
  assert.equal(pay.received, 500)
  const est = normalize({ ...sale({}), type: 'estimate', received: 40 }, s, false)
  assert.equal(est.received, 0)
})

test('search, titles, conversions and duplicates', () => {
  const t = sale({ number: 'INV-0007', refNo: 'PO-55' })
  assert.ok(matchesSearch(t, 'inv-0007'))
  assert.ok(matchesSearch(t, 'soap'))
  assert.ok(matchesSearch(t, 'po-55'))
  assert.ok(matchesSearch(t, 'ali', 'Ali Traders'))
  assert.ok(!matchesSearch(t, 'xyz'))
  assert.equal(docTitleKey('sale', { tax: true }), 'dt_taxInvoice')
  assert.equal(docTitleKey('sale', { tax: false }), 'dt_sale')
  assert.equal(docTitleKey('purchase_return', { tax: false }), 'dt_purchase_return')
  assert.deepEqual(convertTargets(t, { ...s.features, challans: false }), ['sale_return'])
  assert.deepEqual(convertTargets({ ...blankTxn('estimate', s), status: 'converted' }, s.features), [])
  const d = duplicateDraft({ ...t, received: 120, sourceId: 'x' }, s)
  assert.notEqual(d.id, t.id)
  assert.equal(d.number, '')
  assert.equal(d.received, 0)
  assert.equal(d.sourceId, undefined)
  assert.equal(d.lines.length, 1)
})
