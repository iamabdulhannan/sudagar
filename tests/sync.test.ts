import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { FirmDB, seedFirm } from '../src/lib/db'
import { blankTxn, saveTxn } from '../src/lib/txn'
import { syncBusiness, pendingChanges, type Remote, type RemoteRecord } from '../src/lib/sync'

/** an in-memory copy of the cloud `records` table (rev grows on every write, like the trigger) */
function memoryCloud() {
  const rows = new Map<string, RemoteRecord & { business: string }>()
  let rev = 0
  const remote: Remote = {
    async pull(b, since, limit) {
      return [...rows.values()].filter((r) => r.business === b && r.rev > since).sort((x, y) => x.rev - y.rev).slice(0, limit)
        .map(({ business: _b, ...r }) => structuredClone(r))
    },
    async push(b, list) {
      for (const r of list) rows.set(`${b}/${r.tbl}/${r.id}`, { ...structuredClone(r), business: b, rev: ++rev })
    },
  }
  return { remote, rows }
}

let n = 0
const device = () => new FirmDB(`sync-test-${++n}-${Date.now()}`)

test('two devices of one business end up with the same data', async () => {
  const { remote, rows } = memoryCloud()
  const B = 'biz-1'
  const a = device()
  await seedFirm(a, 'retail')
  await a.items.add({ id: 'soap', kind: 'product', name: 'Soap', unit: 'pcs', salePrice: 100, purchasePrice: 70, taxRate: 0, priceIncludesTax: false, openingStock: 10, openingDate: '2026-01-01', active: true, createdAt: 1 })
  assert.ok((await pendingChanges(a)) > 0)
  const first = await syncBusiness(a, B, remote)
  assert.ok(first.pushed >= 5)
  assert.equal(await pendingChanges(a), 0)

  // a second phone signs in and gets everything
  const b = device()
  await syncBusiness(b, B, remote)
  assert.equal((await b.items.get('soap'))?.name, 'Soap')
  assert.ok(await b.settings.get('settings'))
  assert.equal(await pendingChanges(b), 0, 'pulled rows are not sent back')

  // phone B sells offline, then syncs; A sees the invoice
  const s = (await b.settings.get('settings'))!
  const sale = await saveTxn(b, { ...blankTxn('other_income', s), total: 500, accountId: s.defaultAccountId })
  await syncBusiness(b, B, remote)
  await syncBusiness(a, B, remote)
  assert.equal((await a.txns.get(sale.id))?.total, 500)
  // the numbering counter in settings follows too
  assert.equal((await a.settings.get('settings'))!.nextNo.other_income, 2)

  // A renames the item while B has an unsent edit of another field: unchanged rows never clobber local edits
  await b.items.update('soap', { salePrice: 120 })
  await syncBusiness(a, B, remote) // nothing new for A
  await syncBusiness(b, B, remote) // B's edit goes up even though B re-reads the window
  await syncBusiness(a, B, remote)
  assert.equal((await a.items.get('soap'))?.salePrice, 120)

  // deletes travel as tombstones
  await a.items.delete('soap')
  await syncBusiness(a, B, remote)
  assert.equal([...rows.values()].find((r) => r.id === 'soap')?.deleted, true)
  await syncBusiness(b, B, remote)
  assert.equal(await b.items.get('soap'), undefined)

  // other businesses' records are never pulled
  await remote.push('biz-2', [{ tbl: 'items', id: 'x', data: { id: 'x', name: 'Not mine' }, deleted: false }])
  await syncBusiness(b, B, remote)
  assert.equal(await b.items.get('x'), undefined)
})
