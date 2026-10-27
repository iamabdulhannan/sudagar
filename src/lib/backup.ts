import { firmDb, forgetFirmDb, firmDbName, mainGodown, MAIN_GODOWN, meta, setPref, uid, today, withSettingsDefaults } from './db'
import Dexie from 'dexie'
import type { Firm } from './types'

/** tables copied into a backup, in restore order */
const TABLES = ['settings', 'categories', 'partyGroups', 'moneyCategories', 'accounts', 'items', 'parties', 'txns', 'adjustments', 'audit', 'godowns', 'users', 'bin', 'shifts'] as const

export interface BackupFile {
  format: 'saudagar-backup'
  version: 1
  exportedAt: number
  firm: Firm
  tables: Record<(typeof TABLES)[number], unknown[]>
}

export async function exportFirm(firm: Firm): Promise<Blob> {
  const db = firmDb(firm.id)
  const tables = {} as BackupFile['tables']
  for (const name of TABLES) tables[name] = await db.table(name).toArray()
  const file: BackupFile = { format: 'saudagar-backup', version: 1, exportedAt: Date.now(), firm, tables }
  await setPref(`lastBackup.${firm.id}`, Date.now())
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

export const backupFileName = (firm: Firm) =>
  `saudagar-${firm.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'business'}-${today()}.json`

export function readBackup(text: string): BackupFile | null {
  try {
    const f = JSON.parse(text) as BackupFile
    if (f?.format !== 'saudagar-backup' || !f.firm?.id || !f.tables?.settings) return null
    return f
  } catch {
    return null
  }
}

/**
 * Restore a backup. `replace` overwrites the business with the same id on this device;
 * otherwise the backup is added as a new business (a copy with a new id).
 */
export async function restoreFirm(file: BackupFile, replace: boolean): Promise<Firm> {
  const exists = await meta.firms.get(file.firm.id)
  // a restored business belongs to no account until it is added to one (Your businesses → Add to my account)
  const { accountId: _a, role: _r, ...plain } = file.firm
  const firm: Firm = replace || !exists ? { ...plain, ...(exists ? { accountId: exists.accountId, role: exists.role } : {}) } : { ...plain, id: uid(), name: `${file.firm.name} (restored)`, createdAt: Date.now() }
  if (replace && exists) {
    forgetFirmDb(firm.id)
    await Dexie.delete(firmDbName(firm.id))
  }
  const db = firmDb(firm.id)
  await db.open()
  await db.transaction('rw', TABLES.map((n) => db.table(n)), async () => {
    for (const name of TABLES) {
      const rows = file.tables[name] ?? []
      if (rows.length) await db.table(name).bulkPut(rows)
    }
    // backups from older versions: fill in new settings and the main godown
    const s = await db.settings.get('settings')
    // a copy gets a new id, and PINs are salted with the id: turn the lock off so the owner can set new PINs
    if (s) await db.settings.put({ ...withSettingsDefaults(s), ...(firm.id !== file.firm.id ? { appLock: false } : {}) })
    if (!(await db.godowns.get(MAIN_GODOWN))) await db.godowns.add(mainGodown())
  })
  await meta.firms.put(firm)
  return firm
}
