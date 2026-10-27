import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { defaultSettings, firmDb, MAIN_GODOWN, seedFirm } from '../src/lib/db'
import { godownStock } from '../src/lib/ledger'
import { blankTxn, calcLine, calcTotals, lineFor, saveTxn, TxnError } from '../src/lib/txn'
import type { Godown, Item, Txn, TxnLine } from '../src/lib/types'
import {
  bomMaterials, canMake, cataloguePrice, catalogueText, costPreview, godownQty, godownSummary, makesLoop,
  productionRegister, shortages, unitCost, waShareUrl,
} from '../src/components/stock/stockLogic'
import { newPrice, previewPrices } from '../src/components/items/bulkPrice'
import { draftToTxn, maxRedeemable, newDraft, cartLine, splitTotals } from '../src/components/pos/cart'

const s = defaultSettings('manufacturer')
s.features.tax = false
s.features.roundOff = false

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, kind: 'product', name: id, unit: 'pcs', salePrice: 100, purchasePrice: 50, taxRate: 0, priceIncludesTax: false,
  openingStock: 0, openingDate: '2026-01-01', active: true, createdAt: 0, ...over,
})
const flour = item('flour', { unit: 'kg', purchasePrice: 100, openingStock: 50 })
const sugar = item('sugar', { unit: 'kg', purchasePrice: 150, openingStock: 10 })
const cake = item('cake', { salePrice: 900, bom: [{ itemId: 'flour', qty: 0.5 }, { itemId: 'sugar', qty: 0.25 }] })
const box = item('box', { bom: [{ itemId: 'cake', qty: 2 }] })
const byId = new Map([flour, sugar, cake, box].map((i) => [i.id, i]))

const line = (i: Item, qty: number, rate: number): TxnLine =>
  calcLine({ itemId: i.id, name: i.name, qty, unit: i.unit, factor: 1, rate, priceIncludesTax: false, discountPct: 0, discount: 0, taxRate: 0, taxAmount: 0, amount: 0 }, false)

let clock = 1
const txn = (type: Txn['type'], over: Partial<Txn>): Txn => calcTotals({ ...blankTxn(type, s), createdAt: clock++, ...over }, s)

test('bill of materials scales with the quantity made and detects loops', () => {
  assert.deepEqual(bomMaterials(cake.bom, 4), [{ itemId: 'flour', qty: 2 }, { itemId: 'sugar', qty: 1 }])
  assert.deepEqual(bomMaterials(cake.bom, 0), [])
  assert.deepEqual(bomMaterials(undefined, 3), [])
  // cake cannot use itself, nor box (box is made from cake)
  assert.equal(makesLoop('cake', 'cake', byId), true)
  assert.equal(makesLoop('cake', 'box', byId), true)
  assert.equal(makesLoop('cake', 'flour', byId), false)
  // how many cakes can be made from 50 kg flour and 10 kg sugar: sugar limits to 40
  assert.equal(canMake(cake.bom, (id) => (id === 'flour' ? 50 : 10)), 40)
  assert.equal(canMake(cake.bom, () => 0), 0)
  assert.equal(canMake([], () => 5), Infinity)
})

test('shortages add up lines of the same item (alt units included) and skip services', () => {
  const lines = [{ itemId: 'flour', qty: 30, factor: 1 }, { itemId: 'flour', qty: 1, factor: 25 }, { itemId: 'svc', qty: 99, factor: 1 }]
  const out = shortages(lines, (id) => (id === 'flour' ? 50 : 0), (id) => id !== 'svc')
  assert.deepEqual(out, [{ itemId: 'flour', need: 55, have: 50 }])
  assert.deepEqual(shortages([{ itemId: 'flour', qty: 50, factor: 1 }], () => 50, () => true), [])
})

test('cost preview: materials at their rates plus charges, cost of one unit', () => {
  const p = costPreview([{ qty: 2, rate: 100 }, { qty: 1, rate: 150 }], 50, 4)
  assert.deepEqual(p, { materials: 350, charges: 50, total: 400, unitCost: 100 })
  assert.equal(costPreview([], 0, 0).unitCost, 0)
  assert.equal(unitCost(flour, 0), 100)
  assert.equal(unitCost(flour, 120), 120)
})

test('transfers and manufacturing move stock between godowns; summary values positive stock', () => {
  const txns = [
    txn('stock_transfer', { date: '2026-02-01', toGodownId: 'shop2', lines: [line(flour, 20, 100)] }),
    txn('manufacture', { date: '2026-02-02', godownId: 'shop2', outputItemId: 'cake', outputQty: 10, lines: [line(flour, 5, 100), line(sugar, 2.5, 150)] }),
    txn('sale', { date: '2026-02-03', godownId: 'shop2', lines: [lineFor(sugar, 'sale', undefined, s, 1)], received: 100, accountId: 'cash' }),
  ]
  const stock = godownStock([flour, sugar, cake], txns, [])
  const main = godownQty(stock, MAIN_GODOWN)
  const shop2 = godownQty(stock, 'shop2')
  assert.equal(main.get('flour'), 30)
  assert.equal(shop2.get('flour'), 15)
  assert.equal(shop2.get('cake'), 10)
  assert.equal(shop2.get('sugar'), -3.5)

  const godowns: Godown[] = [
    { id: MAIN_GODOWN, name: 'Main', active: true, createdAt: 0 },
    { id: 'shop2', name: 'Shop 2', active: true, createdAt: 1 },
    { id: 'old', name: 'Old', active: false, createdAt: 2 },
  ]
  const { rows, total } = godownSummary([flour, sugar, cake], stock, godowns, (i) => (i.id === 'cake' ? 90 : i.purchasePrice))
  assert.deepEqual(rows.map((r) => r.godown.id), ['main', 'shop2'])
  const m = rows.find((r) => r.godown.id === 'main')!
  const s2 = rows.find((r) => r.godown.id === 'shop2')!
  assert.deepEqual([m.items, m.value], [2, 30 * 100 + 10 * 150])
  assert.deepEqual([s2.items, s2.negative, s2.value], [2, 1, 15 * 100 + 10 * 90])
  assert.equal(total.value, m.value + s2.value)
})

test('production register totals by entry and by item, inside the date range', () => {
  const a = txn('manufacture', { date: '2026-03-01', outputItemId: 'cake', outputQty: 10, charges: 100, accountId: 'cash', lines: [line(flour, 5, 100)] })
  const b = txn('manufacture', { date: '2026-03-05', outputItemId: 'cake', outputQty: 5, lines: [line(flour, 2, 100)] })
  const c = txn('manufacture', { date: '2026-04-01', outputItemId: 'cake', outputQty: 5, lines: [line(flour, 2, 100)] })
  const x = { ...txn('manufacture', { date: '2026-03-02', outputItemId: 'cake', outputQty: 99, lines: [line(flour, 1, 100)] }), cancelled: true }
  const reg = productionRegister([c, b, x, a], '2026-03-01', '2026-03-31')
  assert.deepEqual(reg.rows.map((r) => r.txn.id), [a.id, b.id])
  assert.equal(reg.rows[0].unitCost, 60)
  assert.deepEqual(reg.totals, { materials: 700, charges: 100, total: 800 })
  assert.deepEqual(reg.byItem.map((r) => [r.itemId, r.qty, r.entries, r.unitCost]), [['cake', 15, 2, 53.33]])
})

test('bulk price change: set, raise or lower by amount or percent, with rounding', () => {
  assert.equal(newPrice(100, { op: 'increase', by: 'pct', value: 10, round: 'none' }), 110)
  assert.equal(newPrice(100, { op: 'decrease', by: 'amount', value: 30, round: 'none' }), 70)
  assert.equal(newPrice(100, { op: 'decrease', by: 'amount', value: 300, round: 'none' }), 0)
  assert.equal(newPrice(97, { op: 'increase', by: 'pct', value: 7.5, round: '5' }), 105)
  assert.equal(newPrice(123.456, { op: 'set', by: 'pct', value: 99.999, round: 'none' }), 100)
  assert.equal(newPrice(10, { op: 'increase', by: 'pct', value: 12.5, round: '1' }), 11)
  const rows = previewPrices([flour, sugar], { field: 'purchasePrice', op: 'set', by: 'amount', value: 150, round: 'none' })
  assert.deepEqual(rows.map((r) => [r.item.id, r.old, r.next]), [['flour', 100, 150]])
  const ws = previewPrices([flour], { field: 'wholesalePrice', op: 'increase', by: 'amount', value: 5, round: 'none' })
  assert.deepEqual(ws.map((r) => [r.old, r.next]), [[0, 5]])
})

test('catalogue text lists items by group with price and unit, and a share link with no phone', () => {
  const ws = { ...cake, wholesalePrice: 800, code: 'C1' }
  assert.equal(cataloguePrice(ws, 'wholesale'), 800)
  assert.equal(cataloguePrice(flour, 'wholesale'), 100)
  assert.equal(cataloguePrice(flour, 'none'), undefined)
  const text = catalogueText({
    firmName: 'Madina Bakers', phone: '0300 1234567', title: 'Price list', date: '20 Oct 2026',
    groups: [{ name: 'Cakes', items: [ws] }, { name: 'Empty', items: [] }], price: 'retail', symbol: 'Rs', showCode: true,
    stockNote: () => 'In stock', labels: { phone: 'Phone', per: 'per' },
  })
  assert.equal(text, '*Madina Bakers*\nPrice list\n20 Oct 2026\n\n*Cakes*\n- cake (C1): Rs 900 per pcs [In stock]\n\nPhone: 0300 1234567')
  assert.ok(waShareUrl('a b&c').startsWith('https://wa.me/?text=a%20b%26c'))
})

test('POS: points redeemed are capped by balance and bill, and go into the discount', () => {
  const ls = defaultSettings('retail')
  ls.features.loyalty = true
  ls.features.roundOff = false
  ls.loyalty = { earnPer: 100, pointValue: 2 }
  assert.equal(maxRedeemable(500, 300, 2), 150)
  assert.equal(maxRedeemable(40, 300, 2), 40)
  assert.equal(maxRedeemable(40, 300, 0), 0)

  const d = { ...newDraft(), partyId: 'ali', lines: [cartLine(item('tea', { salePrice: 100 }), undefined, ls)], discountMode: 'pct' as const, discountPct: 10 }
  d.lines[0] = { ...d.lines[0], qty: 3, amount: 300 }
  const plain = draftToTxn({ ...d, pointsRedeemed: 0 }, ls, 1000)
  assert.equal(plain.total, 270)
  const t = draftToTxn({ ...d, pointsRedeemed: 20 }, ls, 1000)
  assert.equal(t.pointsRedeemed, 20)
  assert.equal(t.discount, 30 + 40)
  assert.equal(t.total, 230)
  // never more than available, nor more than the bill
  assert.equal(draftToTxn({ ...d, pointsRedeemed: 20 }, ls, 5).pointsRedeemed, 5)
  const all = draftToTxn({ ...d, pointsRedeemed: 999 }, ls, 1000)
  assert.equal(all.pointsRedeemed, 135)
  assert.equal(all.total, 0)
  // walk-in or loyalty off: nothing redeemed
  assert.equal(draftToTxn({ ...d, partyId: undefined, pointsRedeemed: 20 }, ls, 1000).pointsRedeemed, undefined)
})

test('split payment rows add up and show what is left', () => {
  assert.deepEqual(splitTotals([{ amount: 500 }, { amount: 250.5 }], 1000), { paid: 750.5, remaining: 249.5 })
  assert.deepEqual(splitTotals([{ amount: 600 }, { amount: 500 }], 1000), { paid: 1100, remaining: -100 })
})

test('transfer and manufacture drafts shaped like the forms save and number', async () => {
  const db = firmDb('stock-forms-test')
  await seedFirm(db, 'manufacturer')
  const st = (await db.settings.get('settings'))!
  const tr = calcTotals({
    ...blankTxn('stock_transfer', st), toGodownId: 'b2', lines: [line(flour, 5, 100)],
    accountId: undefined, paymentMode: undefined, received: 0,
  }, st)
  const saved = await saveTxn(db, tr)
  assert.equal(saved.number, 'ST-0001')
  assert.equal(saved.total, 500)
  // same godown on both sides is refused
  await assert.rejects(saveTxn(db, { ...tr, id: 'x', number: '', toGodownId: undefined }), (e) => e instanceof TxnError && e.problem.key === 'errGodowns')
  const mf = calcTotals({
    ...blankTxn('manufacture', st), outputItemId: 'cake', outputQty: 4, lines: [line(flour, 2, 100)], charges: 0,
    accountId: undefined, paymentMode: undefined, received: 0,
  }, st)
  const m = await saveTxn(db, mf)
  assert.equal(m.number, 'MFG-0001')
  await assert.rejects(saveTxn(db, { ...mf, id: 'y', number: '', charges: 50 }), (e) => e instanceof TxnError && e.problem.key === 'errAccount')
})
