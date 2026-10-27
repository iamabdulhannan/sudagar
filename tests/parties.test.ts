import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceDir, findDuplicates, matchParty, normalizePkPhone, parseDate, parsePartyCsv, PARTY_CSV_HEADER, PARTY_CSV_SAMPLE,
  signedOpening, waLink,
} from '../src/components/parties/partyUtils'
import type { Party } from '../src/lib/types'

const party = (over: Partial<Party>): Party => ({
  id: 'p1', name: 'Ali Traders', kind: 'customer', phone: '0300-1234567', city: 'Lahore', openingBalance: 0,
  openingDate: '2026-01-01', priceTier: 'retail', active: true, createdAt: 0, ...over,
})

test('Pakistani phone numbers become 92 international numbers', () => {
  assert.equal(normalizePkPhone('0300 1234567'), '923001234567')
  assert.equal(normalizePkPhone('0300-1234567'), '923001234567')
  assert.equal(normalizePkPhone('+92 300 1234567'), '923001234567')
  assert.equal(normalizePkPhone('0092 300 1234567'), '923001234567')
  assert.equal(normalizePkPhone('3001234567'), '923001234567')
  assert.equal(normalizePkPhone('923001234567'), '923001234567')
  assert.equal(normalizePkPhone('+971 50 123 4567'), '971501234567')
  assert.equal(normalizePkPhone('12345'), undefined)
  assert.equal(normalizePkPhone(''), undefined)
  assert.equal(normalizePkPhone(undefined), undefined)
})

test('WhatsApp link carries the encoded message', () => {
  assert.equal(waLink('0321 7654321', 'Rs 1,500 due'), 'https://wa.me/923217654321?text=Rs%201%2C500%20due')
  assert.equal(waLink('', 'x'), undefined)
})

test('balance direction and signed opening', () => {
  assert.equal(balanceDir(100), 'receive')
  assert.equal(balanceDir(-0.5), 'pay')
  assert.equal(balanceDir(0.001), 'settled')
  assert.equal(signedOpening(500, 'receive'), 500)
  assert.equal(signedOpening(500, 'pay'), -500)
  assert.equal(signedOpening(-500, 'receive'), 500)
})

test('duplicate name and phone are found, ignoring the party itself', () => {
  const list = [party({}), party({ id: 'p2', name: 'Bilal', phone: '+92 321 1111111' })]
  const d = findDuplicates(list, { name: '  ali   traders ', phone: '03211111111' })
  assert.equal(d.byName?.id, 'p1')
  assert.equal(d.byPhone?.id, 'p2')
  const self = findDuplicates(list, { id: 'p1', name: 'Ali Traders', phone: '0300 1234567' })
  assert.equal(self.byName, undefined)
  assert.equal(self.byPhone, undefined)
})

test('search matches name, city and phone digits', () => {
  const p = party({})
  assert.ok(matchParty(p, 'ali'))
  assert.ok(matchParty(p, 'LAHORE'))
  assert.ok(matchParty(p, '1234567'))
  assert.ok(matchParty(p, '0300 123'))
  assert.ok(!matchParty(p, 'karachi'))
})

test('dates in both formats, invalid dates rejected', () => {
  assert.equal(parseDate('', '2026-10-19'), '2026-10-19')
  assert.equal(parseDate('2026-7-1', 'x'), '2026-07-01')
  assert.equal(parseDate('01/07/2026', 'x'), '2026-07-01')
  assert.equal(parseDate('31/02/2026', 'x'), undefined)
  assert.equal(parseDate('July 1', 'x'), undefined)
})

test('CSV import validates every row', () => {
  const rows = [
    ['Name', 'Type', 'Mobile', 'Opening Balance', 'Date', 'Credit limit', 'Group'],
    ['New Shop', 'customer', '0333 0000000', '1,500', '2026-07-01', '', 'Retailers'],
    ['Hamza', 'supplier', '', '-42000', '', '', ''],
    ['', 'customer', '', '', '', '', ''],
    ['Ali Traders', '', '', '', '', '', ''],
    ['Bad Type', 'friend', '', 'abc', '2026-13-01', '-5', ''],
    ['New Shop', 'both', '0300-1234567', '', '', '', ''],
  ]
  const res = parsePartyCsv(rows, { existing: [party({})], today: '2026-10-19' })
  assert.equal(res.error, undefined)
  const [a, b, c, d, e, f] = res.rows
  assert.deepEqual(a.errors, [])
  assert.equal(a.openingBalance, 1500)
  assert.equal(a.group, 'Retailers')
  assert.equal(a.line, 2)
  assert.equal(b.kind, 'supplier')
  assert.equal(b.openingBalance, -42000)
  assert.equal(b.openingDate, '2026-10-19')
  assert.deepEqual(c.errors, ['pt_csvNoName'])
  assert.deepEqual(d.errors, ['pt_csvExists'])
  assert.deepEqual(e.errors.sort(), ['pt_csvBadAmount', 'pt_csvBadDate', 'pt_csvBadLimit', 'pt_csvBadType'])
  assert.deepEqual(f.errors, ['pt_csvRepeated'])
  assert.deepEqual(f.warnings, ['pt_csvPhoneDup'])
})

test('CSV without a name column or rows is refused', () => {
  assert.equal(parsePartyCsv([], { existing: [], today: '2026-10-19' }).error, 'pt_csvEmpty')
  assert.equal(parsePartyCsv([['phone'], ['0300']], { existing: [], today: '2026-10-19' }).error, 'pt_csvNoHeader')
  assert.equal(parsePartyCsv([['name']], { existing: [], today: '2026-10-19' }).error, 'pt_csvEmpty')
})

test('the downloadable template imports cleanly', () => {
  const res = parsePartyCsv([PARTY_CSV_HEADER, ...PARTY_CSV_SAMPLE], { existing: [], today: '2026-10-19' })
  assert.equal(res.rows.length, 2)
  assert.ok(res.rows.every((r) => r.errors.length === 0))
  assert.equal(res.rows[0].creditLimit, 50000)
  assert.equal(res.rows[1].openingBalance, -42000)
})
