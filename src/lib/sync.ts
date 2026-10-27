import type { FirmDB } from './db'

/**
 * Two-way sync between a device's business database (IndexedDB) and the cloud `records` table.
 *
 * - Pull: fetch every record with a higher `rev` than the device has seen and write it locally
 *   (the cloud copy wins if the same row was also changed here).
 * - Push: compare every local row with the hash it had when last synced; send rows that are new or
 *   changed, and mark rows that disappeared as deleted.
 *
 * The app keeps working offline; changes wait on the device and go up on the next sync.
 * The remote side is an interface so the logic is tested without a server (tests/sync.test.ts).
 */

export const SYNC_TABLES = [
  'settings', 'categories', 'partyGroups', 'moneyCategories', 'accounts', 'godowns',
  'items', 'parties', 'txns', 'adjustments', 'users', 'bin', 'shifts',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export interface RemoteRecord {
  tbl: SyncTable
  id: string
  data: unknown
  deleted: boolean
  rev: number
}

export interface Remote {
  /** records changed after `since`, oldest first, at most `limit` */
  pull(businessId: string, since: number, limit: number): Promise<RemoteRecord[]>
  /** insert or update records */
  push(businessId: string, rows: Omit<RemoteRecord, 'rev'>[]): Promise<void>
}

export interface SyncResult { pulled: number; pushed: number; /** tables the server refused (database not updated yet) */ skipped: string[] }

/** short, stable hash of a row (cyrb53) */
export function hashRow(v: unknown): string {
  const str = JSON.stringify(v)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const PAGE = 1000
const PUSH_BATCH = 400
/** revisions re-read before the cursor on every pull */
const LAG = 200

/** true while sync itself writes to the database (so the app does not schedule another sync) */
export let applyingRemote = false

export async function syncBusiness(db: FirmDB, businessId: string, remote: Remote): Promise<SyncResult> {
  let pulled = 0, pushed = 0
  const skipped: string[] = []

  // ---- pull
  // re-read a short window before the cursor: rows committed slightly out of order are not missed
  let cursor = Number((await db.syncMeta.get('cursor'))?.value ?? 0)
  let since = Math.max(0, cursor - LAG)
  for (;;) {
    const rows = await remote.pull(businessId, since, PAGE)
    if (!rows.length) break
    applyingRemote = true
    try {
      await db.transaction('rw', [...SYNC_TABLES.map((n) => db.table(n)), db.syncHashes, db.syncMeta], async () => {
        for (const r of rows) {
          since = Math.max(since, Number(r.rev))
          if (!(SYNC_TABLES as readonly string[]).includes(r.tbl)) continue
          const table = db.table(r.tbl)
          const key = `${r.tbl}/${r.id}`
          const known = (await db.syncHashes.get(key))?.hash
          if (r.deleted || r.data == null) {
            if (known === undefined && !(await table.get(r.id))) continue
            await table.delete(r.id)
            await db.syncHashes.delete(key)
            pulled++
            continue
          }
          const hash = hashRow(r.data)
          // unchanged in the cloud since this device last synced it: keep any local edit waiting to go up
          if (hash === known) continue
          await table.put(r.data)
          await db.syncHashes.put({ key, hash })
          pulled++
        }
        cursor = Math.max(cursor, since)
        await db.syncMeta.put({ key: 'cursor', value: cursor })
      })
    } finally {
      applyingRemote = false
    }
    if (rows.length < PAGE) break
  }

  // ---- push
  const known = new Map((await db.syncHashes.toArray()).map((h) => [h.key, h.hash]))
  const out: Omit<RemoteRecord, 'rev'>[] = []
  const seen = new Set<string>()
  for (const tbl of SYNC_TABLES) {
    const table = db.table(tbl)
    const pk = table.schema.primKey.keyPath as string
    for (const row of await table.toArray()) {
      const id = String((row as Record<string, unknown>)[pk])
      const key = `${tbl}/${id}`
      seen.add(key)
      const hash = hashRow(row)
      if (known.get(key) !== hash) out.push({ tbl, id, data: row, deleted: false })
    }
  }
  for (const key of known.keys()) {
    if (seen.has(key)) continue
    const i = key.indexOf('/')
    out.push({ tbl: key.slice(0, i) as SyncTable, id: key.slice(i + 1), data: null, deleted: true })
  }
  // sent table by table: a table the server does not know yet (migration not run) is skipped, not fatal
  for (const tbl of SYNC_TABLES) {
    const rows = out.filter((r) => r.tbl === tbl)
    try {
      for (let i = 0; i < rows.length; i += PUSH_BATCH) {
        const batch = rows.slice(i, i + PUSH_BATCH)
        await remote.push(businessId, batch)
        await db.transaction('rw', db.syncHashes, async () => {
          for (const r of batch) {
            const key = `${r.tbl}/${r.id}`
            if (r.deleted) await db.syncHashes.delete(key)
            else await db.syncHashes.put({ key, hash: hashRow(r.data) })
          }
        })
        pushed += batch.length
      }
    } catch (e) {
      if (/records_tbl_check/.test((e as Error).message)) { skipped.push(tbl); continue }
      throw e
    }
  }
  await db.syncMeta.put({ key: 'lastSync', value: Date.now() })
  return { pulled, pushed, skipped }
}

/** number of local changes not yet sent */
export async function pendingChanges(db: FirmDB): Promise<number> {
  const known = new Map((await db.syncHashes.toArray()).map((h) => [h.key, h.hash]))
  let n = 0
  const seen = new Set<string>()
  for (const tbl of SYNC_TABLES) {
    const table = db.table(tbl)
    const pk = table.schema.primKey.keyPath as string
    for (const row of await table.toArray()) {
      const key = `${tbl}/${String((row as Record<string, unknown>)[pk])}`
      seen.add(key)
      if (known.get(key) !== hashRow(row)) n++
    }
  }
  for (const key of known.keys()) if (!seen.has(key)) n++
  return n
}
