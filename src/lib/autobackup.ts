import Dexie, { type EntityTable } from 'dexie'
import { useCallback, useEffect, useState } from 'react'
import { backupFileName, exportFirm } from './backup'
import { useData } from './data'
import { today } from './db'
import type { Firm } from './types'

/**
 * Automatic daily backup into a folder the user picks once (File System Access API:
 * Chrome and Edge on computers). Folder handles cannot go through the normal prefs on
 * every browser, so they live in a small database of their own.
 *
 * Browsers forget the write permission between visits unless the user allowed it for
 * good, so the daily run may need one click ("Allow") to continue.
 */

interface FolderRec {
  firmId: string
  handle: FileSystemDirectoryHandle
  name: string
  /** last automatic or manual write into the folder */
  lastAt?: number
  lastError?: string
}

class AutoBackupDB extends Dexie {
  folders!: EntityTable<FolderRec, 'firmId'>
  constructor() {
    super('saudagar-autobackup')
    this.version(1).stores({ folders: 'firmId' })
  }
}

let store: AutoBackupDB | null = null
const db = () => (store ??= new AutoBackupDB())

/** backups kept in the folder for each business (older ones are removed) */
export const KEEP_FILES = 30

type PermState = 'granted' | 'denied' | 'prompt'
interface PermHandle {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermState>
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermState>
}
type PickerWindow = Window & { showDirectoryPicker?: (o?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle> }

/** the browser can write into a folder by itself */
export const autoBackupSupported = () =>
  typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function' && window.self === window.top

export async function getFolder(firmId: string): Promise<FolderRec | undefined> {
  try { return await db().folders.get(firmId) } catch { return undefined }
}

/** ask the user for a folder (needs a click) and back up into it straight away */
export async function chooseFolder(firm: Firm): Promise<FolderRec> {
  const handle = await (window as PickerWindow).showDirectoryPicker!({ id: 'saudagar-backup', mode: 'readwrite', startIn: 'documents' })
  const rec: FolderRec = { firmId: firm.id, handle, name: handle.name }
  await db().folders.put(rec)
  return writeBackup(firm, rec)
}

export async function stopAutoBackup(firmId: string) {
  await db().folders.delete(firmId)
}

async function permission(handle: FileSystemDirectoryHandle, ask: boolean): Promise<PermState> {
  const h = handle as unknown as PermHandle
  if (!h.queryPermission) return 'granted'
  const now = await h.queryPermission({ mode: 'readwrite' })
  if (now === 'granted' || !ask || !h.requestPermission) return now
  return h.requestPermission({ mode: 'readwrite' })
}

/** remove the oldest backups of this business beyond KEEP_FILES */
async function prune(firm: Firm, handle: FileSystemDirectoryHandle) {
  const prefix = backupFileName(firm).replace(/\d{4}-\d{2}-\d{2}\.json$/, '')
  const names: string[] = []
  const it = (handle as unknown as { keys?: () => AsyncIterable<string> }).keys?.()
  if (!it) return
  for await (const name of it) if (name.startsWith(prefix) && /\d{4}-\d{2}-\d{2}\.json$/.test(name)) names.push(name)
  names.sort()
  for (const name of names.slice(0, Math.max(0, names.length - KEEP_FILES))) {
    try { await handle.removeEntry(name) } catch { /* in use or gone */ }
  }
}

/** write today's backup file into the folder (replaces today's file if there is one) */
export async function writeBackup(firm: Firm, rec: FolderRec): Promise<FolderRec> {
  try {
    const blob = await exportFirm(firm)
    const file = await rec.handle.getFileHandle(backupFileName(firm), { create: true })
    const w = await file.createWritable()
    await w.write(blob)
    await w.close()
    const next = { ...rec, lastAt: Date.now(), lastError: undefined }
    await db().folders.put(next)
    try { await prune(firm, rec.handle) } catch { /* keeping extra files is harmless */ }
    return next
  } catch (e) {
    const next = { ...rec, lastError: e instanceof Error ? e.message : String(e) }
    await db().folders.put(next)
    throw e
  }
}

export type AutoBackupStatus =
  | 'unsupported' // browser cannot write to folders
  | 'off' // no folder chosen
  | 'done' // already backed up today
  | 'saved' // written now
  | 'needs-permission' // the browser wants a click to allow writing again
  | 'error'

const running = new Map<string, Promise<AutoBackupStatus>>()

/** once a day: write a backup into the chosen folder if one was not written today */
export function runAutoBackupIfDue(firm: Firm, opts: { ask?: boolean; force?: boolean } = {}): Promise<AutoBackupStatus> {
  const busy = running.get(firm.id)
  if (busy) return busy
  const job = (async (): Promise<AutoBackupStatus> => {
    if (!autoBackupSupported()) return 'unsupported'
    const rec = await getFolder(firm.id)
    if (!rec) return 'off'
    if (!opts.force && rec.lastAt && today(new Date(rec.lastAt)) === today()) return 'done'
    try {
      if ((await permission(rec.handle, !!opts.ask)) !== 'granted') return 'needs-permission'
      await writeBackup(firm, rec)
      return 'saved'
    } catch {
      return 'error'
    }
  })()
  running.set(firm.id, job)
  job.finally(() => running.delete(firm.id))
  return job
}

/**
 * Runs the daily backup when the app opens. `allow()` must be called from a click
 * when the status is 'needs-permission'.
 */
export function useAutoBackup() {
  const { firm } = useData()
  const [status, setStatus] = useState<AutoBackupStatus | null>(null)
  const [folder, setFolder] = useState<FolderRec | undefined>()

  const refresh = useCallback(async () => setFolder(await getFolder(firm.id)), [firm.id])

  useEffect(() => {
    let live = true
    runAutoBackupIfDue(firm).then(async (s) => {
      if (!live) return
      setStatus(s)
      setFolder(await getFolder(firm.id))
    })
    return () => { live = false }
  }, [firm])

  const allow = useCallback(async () => {
    const s = await runAutoBackupIfDue(firm, { ask: true })
    setStatus(s)
    await refresh()
    return s
  }, [firm, refresh])

  return { status, folder, allow, refresh }
}
