import { deleteFirm, firmDb, meta } from './db'
import { sb } from './supabase'
import { syncBusiness, type Remote, type RemoteRecord, type SyncTable } from './sync'
import type { Firm, Role } from './types'

/** calls to the Supabase backend (see supabase/migrations/001_init.sql) */

export interface CloudBusiness { id: string; name: string; profile: Partial<Firm>; role: Role; updated_at: string }
export interface Member { user_id: string; full_name: string; email: string; role: Role; created_at: string }
export interface Invite { code: string; role: Role; created_at: string; expires_at: string; used_by: string | null }

/** server error text → i18n key */
export function cloudErrorKey(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  for (const k of ['INVALID_INVITE', 'ALREADY_MEMBER', 'LAST_OWNER', 'NOT_ALLOWED', 'NOT_SIGNED_IN', 'CLOUD_NOT_CONFIGURED']) if (m.includes(k)) return 'cl_' + k
  if (/failed to fetch|network/i.test(m)) return 'au_errOffline'
  return 'cl_generic'
}

const unwrap = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** the business profile as stored in the cloud (no device-only fields) */
export function profileOf(f: Firm): Partial<Firm> {
  const { accountId: _a, role: _r, ...rest } = f
  return rest
}

export async function myBusinesses(): Promise<CloudBusiness[]> {
  return unwrap(await sb().rpc('my_businesses'))
}

export async function createCloudBusiness(f: Firm) {
  unwrap(await sb().rpc('create_business', { p_id: f.id, p_name: f.name, p_profile: profileOf(f) }))
}

export async function updateCloudProfile(f: Firm) {
  unwrap(await sb().from('businesses').update({ name: f.name, profile: profileOf(f), updated_at: new Date().toISOString() }).eq('id', f.id))
}

export async function deleteCloudBusiness(id: string) {
  unwrap(await sb().rpc('delete_business', { p_business: id }))
}

export async function checkInvite(code: string): Promise<{ business_name: string; role: Role } | null> {
  const rows = unwrap(await sb().rpc('check_invite', { p_code: code })) as { business_name: string; role: Role }[]
  return rows[0] ?? null
}

export async function acceptInvite(code: string): Promise<string> {
  return unwrap(await sb().rpc('accept_invite', { p_code: code })) as string
}

export async function listMembers(businessId: string): Promise<Member[]> {
  return unwrap(await sb().rpc('list_members', { p_business: businessId }))
}

export async function setMemberRole(businessId: string, userId: string, role: Role) {
  unwrap(await sb().rpc('set_member_role', { p_business: businessId, p_user: userId, p_role: role }))
}

export async function removeMember(businessId: string, userId: string) {
  unwrap(await sb().rpc('remove_member', { p_business: businessId, p_user: userId }))
}

export async function listInvites(businessId: string): Promise<Invite[]> {
  return unwrap(await sb().from('invites').select('code, role, created_at, expires_at, used_by').eq('business_id', businessId).order('created_at', { ascending: false }))
}

export async function createInvite(businessId: string, role: Role): Promise<Invite> {
  return unwrap(await sb().from('invites').insert({ business_id: businessId, role }).select('code, role, created_at, expires_at, used_by').single())
}

export async function deleteInvite(code: string) {
  unwrap(await sb().from('invites').delete().eq('code', code))
}

/** the records table as a sync Remote */
export const supabaseRemote: Remote = {
  async pull(businessId, since, limit) {
    const rows = unwrap(await sb().from('records').select('tbl, id, data, deleted, rev')
      .eq('business_id', businessId).gt('rev', since).order('rev', { ascending: true }).limit(limit)) as RemoteRecord[]
    return rows.map((r) => ({ ...r, rev: Number(r.rev) }))
  },
  async push(businessId, rows) {
    unwrap(await sb().from('records').upsert(
      rows.map((r) => ({ business_id: businessId, tbl: r.tbl as SyncTable, id: r.id, data: r.data, deleted: r.deleted })),
      { onConflict: 'business_id,tbl,id' },
    ))
  },
}

/**
 * Bring the account's businesses onto this device: new ones are added (then filled by sync),
 * names, profiles and roles are refreshed, and ones the account lost access to are hidden.
 */
export async function refreshAccountBusinesses(accountId: string): Promise<Firm[]> {
  const remote = await myBusinesses()
  const local = await meta.firms.toArray()
  for (const b of remote) {
    const existing = local.find((f) => f.id === b.id)
    const firm: Firm = {
      currency: 'PKR', currencySymbol: 'Rs', businessType: 'other', createdAt: Date.now(),
      ...existing, ...b.profile, id: b.id, name: b.name, accountId, role: b.role,
    }
    await meta.firms.put(firm)
  }
  // access was taken away (left, removed by the owner, business deleted): remove the device copy too
  for (const f of local) {
    if (f.accountId === accountId && !remote.some((b) => b.id === f.id)) await deleteFirm(f.id)
  }
  return (await meta.firms.toArray()).filter((f) => f.accountId === accountId)
}

/** first full download of a business onto this device */
export async function downloadBusiness(id: string) {
  await syncBusiness(firmDb(id), id, supabaseRemote)
}
