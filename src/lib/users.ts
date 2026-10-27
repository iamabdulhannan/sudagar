import type { FirmDB } from './db'
import { uid } from './db'
import type { AppUser, Role } from './types'

/**
 * People who use the app on this device and their PINs.
 *
 * A PIN is never stored: only SHA-256 of `saudagar|<firm id>|<user id>|<pin>` in hex.
 * The firm id is the per-business salt, the user id keeps two people with the same PIN
 * from having the same hash. This is a shop-counter lock (staff cannot open the books),
 * not encryption: the data itself stays readable on the device.
 */

export const ROLES: Role[] = ['owner', 'manager', 'accountant', 'cashier']

export const PIN_MIN = 4
export const PIN_MAX = 6

/** 4 to 6 digits */
export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)

// ---------- hashing ----------

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** SHA-256 in hex; uses Web Crypto, or a small fallback when it is missing (plain http on a LAN) */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined
  if (subtle) {
    try { return hex(new Uint8Array(await subtle.digest('SHA-256', data))) } catch { /* fall through */ }
  }
  return hex(sha256Js(data))
}

export const hashPin = (firmId: string, userId: string, pin: string) => sha256Hex(`saudagar|${firmId}|${userId}|${pin}`)

export async function checkPin(firmId: string, user: AppUser, pin: string): Promise<boolean> {
  if (!validPin(pin) || !user.pinHash) return false
  return (await hashPin(firmId, user.id, pin)) === user.pinHash
}

/** plain SHA-256 (FIPS 180-4), only used when crypto.subtle is unavailable */
export function sha256Js(msg: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const len = msg.length
  const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64)
  padded.set(msg)
  padded[len] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000))
  view.setUint32(padded.length - 4, (len * 8) >>> 0)
  const W = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h
  }
  const out = new Uint8Array(32)
  const ov = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i])
  return out
}

// ---------- roles and permissions ----------

/** things a role may or may not do */
export type Perm =
  | 'sell' | 'purchase' | 'money' | 'reports' | 'profit' | 'editPast' | 'delete'
  | 'items' | 'parties' | 'settings' | 'users' | 'backup'

export const PERMS: Perm[] = ['sell', 'purchase', 'money', 'reports', 'profit', 'editPast', 'delete', 'items', 'parties', 'settings', 'users', 'backup']

/**
 * What each role may do. Owner: everything. Manager: everything except users, settings,
 * deleting and changing past entries. Accountant: money, reports, profit, parties,
 * purchases, selling and backups. Cashier: selling and parties only.
 */
export const ROLE_PERMS: Record<Role, ReadonlySet<Perm>> = {
  owner: new Set(PERMS),
  manager: new Set(PERMS.filter((p) => p !== 'users' && p !== 'settings' && p !== 'delete' && p !== 'editPast')),
  accountant: new Set<Perm>(['sell', 'money', 'reports', 'profit', 'parties', 'purchase', 'backup']),
  cashier: new Set<Perm>(['sell', 'parties']),
}

/** may this user do it? No user (single-owner mode) may do everything. */
export const userCan = (user: AppUser | null, p: Perm) => !user || ROLE_PERMS[user.role].has(p)

/** app lock is in force: turned on and someone can sign in */
export const lockEnabled = (appLock: boolean, users: AppUser[]) => appLock && users.some(canSignIn)

// ---------- rules ----------

export const activeOwners = (users: AppUser[]) => users.filter((u) => u.active && u.role === 'owner')

/** a user that can unlock the app (active, has a PIN) */
export const canSignIn = (u: AppUser) => u.active && !!u.pinHash

/**
 * i18n key of the problem with changing `next` into the user list, or null.
 * There must always be at least one active owner once users exist.
 */
export function checkUserChange(users: AppUser[], next: AppUser): string | null {
  if (!next.name.trim()) return 'us_errName'
  const dup = users.find((u) => u.id !== next.id && u.name.trim().toLowerCase() === next.name.trim().toLowerCase())
  if (dup) return 'us_errDupName'
  const after = [...users.filter((u) => u.id !== next.id), next]
  if (activeOwners(after).length === 0) return 'us_errOwner'
  return null
}

// ---------- writes ----------

async function audit(db: FirmDB, action: 'create' | 'update', u: AppUser, summary: string) {
  await db.audit.add({ at: Date.now(), action, entity: 'user', entityId: u.id, summary })
}

export class UserError extends Error {
  constructor(public key: string) { super(key) }
}

/** add or update a user; `pin` (when given) replaces the PIN */
export async function saveUser(db: FirmDB, firmId: string, input: { id?: string; name: string; role: Role; active: boolean; pin?: string }): Promise<AppUser> {
  const users = await db.users.toArray()
  const old = input.id ? users.find((u) => u.id === input.id) : undefined
  const id = old?.id ?? uid()
  if (!old && !input.pin) throw new UserError('us_errPin')
  if (input.pin !== undefined && !validPin(input.pin)) throw new UserError('us_errPin')
  const user: AppUser = {
    id,
    name: input.name.trim(),
    role: input.role,
    active: input.active,
    pinHash: input.pin ? await hashPin(firmId, id, input.pin) : old?.pinHash ?? '',
    createdAt: old?.createdAt ?? Date.now(),
  }
  const problem = checkUserChange(users, user)
  if (problem) throw new UserError(problem)
  await db.users.put(user)
  const what = [
    !old && `added ${user.name} (${user.role})`,
    old && old.name !== user.name && `renamed to ${user.name}`,
    old && old.role !== user.role && `role ${old.role} to ${user.role}`,
    old && old.active !== user.active && (user.active ? 'activated' : 'deactivated'),
    old && input.pin && 'PIN changed',
  ].filter(Boolean).join(', ')
  await audit(db, old ? 'update' : 'create', user, `User ${old ? old.name + ': ' : ''}${what || 'saved'}`)
  return user
}
