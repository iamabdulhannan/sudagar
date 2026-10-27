import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// Runs supabase/migrations/001_init.sql in an in-memory Postgres with Supabase auth stubs and
// checks sign-up profiles, business isolation, roles, invites and synced records.

const MIG = ['001_init.sql', '002_shifts.sql'].map((f) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')).join('\n')

async function setup() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  await db.exec(MIG)
  // run sql as a signed-in user (or anon)
  const as = async <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`)
    try { return (await db.query<T>(sql, params)).rows } finally { await db.exec('reset role') }
  }
  const err = async (uid: string | null, sql: string, params: unknown[] = []) => {
    try { await as(uid, sql, params); return '' } catch (e) { return (e as Error).message }
  }
  const signup = async (email: string, name: string) =>
    (await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { full_name: name }])).rows[0].id
  return { db, as, err, signup }
}

const B1 = '11111111-1111-4111-8111-111111111111'
const B2 = '22222222-2222-4222-8222-222222222222'

test('accounts, businesses, members, invites and records', async (t) => {
  const { db, as, err, signup } = await setup()
  t.after(() => db.close())

  // sign-up makes a profile
  const ali = await signup('ali@shop.pk', 'Ali Khan')
  const [prof] = await as<{ full_name: string }>(ali, `select full_name from profiles`)
  assert.equal(prof.full_name, 'Ali Khan')

  // create a business: creator is owner; calling again is harmless
  await as(ali, `select * from create_business($1, 'Madina Traders', '{"businessType":"grocery"}')`, [B1])
  await as(ali, `select * from create_business($1, 'Madina Traders', '{}')`, [B1])
  const mine = await as<{ name: string; role: string }>(ali, `select * from my_businesses()`)
  assert.deepEqual(mine.map((b) => [b.name, b.role]), [['Madina Traders', 'owner']])

  // another account sees nothing of it and cannot take its id
  const sara = await signup('sara@other.pk', 'Sara')
  assert.equal((await as(sara, `select * from businesses`)).length, 0)
  assert.equal((await as(sara, `select * from my_businesses()`)).length, 0)
  assert.match(await err(sara, `select * from create_business($1, 'Hijack', '{}')`, [B1]), /NOT_ALLOWED/)
  assert.ok(await err(sara, `insert into businesses (id, name) values ($1, 'x')`, [B2]), 'no direct insert')
  assert.ok(await err(null, `select * from my_businesses()`), 'anon cannot list')

  // records: owner writes, other account cannot read or write
  await as(ali, `insert into records (business_id, tbl, id, data) values ($1, 'items', 'i1', '{"name":"Soap"}')`, [B1])
  await as(ali, `insert into records (business_id, tbl, id, data) values ($1, 'settings', 'settings', '{}')`, [B1])
  await as(ali, `insert into records (business_id, tbl, id, data) values ($1, 'shifts', 's1', '{}')`, [B1])
  const [r1] = await as<{ rev: string }>(ali, `select rev from records where id = 'i1'`)
  assert.equal((await as(sara, `select * from records`)).length, 0)
  assert.ok(await err(sara, `insert into records (business_id, tbl, id, data) values ($1, 'items', 'x', '{}')`, [B1]), 'other account cannot write')
  assert.ok(await err(ali, `insert into records (business_id, tbl, id, data) values ($1, 'secrets', 'x', '{}')`, [B1]), 'unknown table refused')

  // an update gets a new, higher rev (devices pull everything after their rev)
  await as(ali, `update records set data = '{"name":"Soap 2"}' where business_id = $1 and tbl = 'items' and id = 'i1'`, [B1])
  const [r2] = await as<{ rev: string }>(ali, `select rev from records where id = 'i1'`)
  assert.ok(Number(r2.rev) > Number(r1.rev), `rev grows ${r1.rev} -> ${r2.rev}`)
  await err(ali, `delete from records where id = 'i1'`)
  assert.equal((await as(ali, `select * from records where id = 'i1'`)).length, 1, 'no hard delete')

  // invites: owner makes a code for a cashier; anyone signed in can check it; it works once
  const [inv] = await as<{ code: string }>(ali, `insert into invites (business_id, role) values ($1, 'cashier') returning code`, [B1])
  assert.match(inv.code, /^[0-9A-F]{8}$/)
  assert.equal((await as(sara, `select * from invites`)).length, 0, 'other accounts cannot list invites')
  const [chk] = await as<{ business_name: string; role: string }>(sara, `select * from check_invite($1)`, [inv.code.toLowerCase()])
  assert.deepEqual([chk.business_name, chk.role], ['Madina Traders', 'cashier'])
  await as(sara, `select accept_invite($1)`, [inv.code])
  const bilal = await signup('bilal@x.pk', 'Bilal')
  assert.match(await err(bilal, `select accept_invite($1)`, [inv.code]), /INVALID_INVITE/, 'a used code cannot be reused')

  // the cashier now reads and writes items but not settings
  assert.equal((await as(sara, `select * from records where tbl = 'items'`)).length, 1)
  await as(sara, `insert into records (business_id, tbl, id, data) values ($1, 'txns', 't1', '{"type":"sale"}')`, [B1])
  assert.match(await err(sara, `update records set data = '{"x":1}' where business_id = $1 and tbl = 'settings'`, [B1]), /row-level security/, 'cashier cannot change settings')
  const [settingsRow] = await as<{ data: Record<string, unknown> }>(ali, `select data from records where tbl = 'settings'`)
  assert.deepEqual(settingsRow.data, {})
  assert.ok(await err(sara, `insert into invites (business_id, role) values ($1, 'manager')`, [B1]), 'cashier cannot invite')
  await as(sara, `update businesses set name = 'Mine' where id = $1`, [B1])
  assert.equal((await as<{ name: string }>(ali, `select name from businesses`))[0].name, 'Madina Traders', 'cashier cannot rename the business')

  // members list and roles
  const members = await as<{ email: string; role: string }>(sara, `select * from list_members($1)`, [B1])
  assert.deepEqual(members.map((m) => [m.email, m.role]), [['ali@shop.pk', 'owner'], ['sara@other.pk', 'cashier']])
  assert.match(await err(sara, `select set_member_role($1, $2, 'owner')`, [B1, sara]), /NOT_ALLOWED/)
  await as(ali, `select set_member_role($1, $2, 'manager')`, [B1, sara])
  assert.equal((await as<{ role: string }>(sara, `select role from my_businesses()`))[0].role, 'manager')
  assert.match(await err(ali, `select set_member_role($1, $2, 'cashier')`, [B1, ali]), /LAST_OWNER/)
  assert.match(await err(ali, `select remove_member($1, $2)`, [B1, ali]), /LAST_OWNER/)

  // a member may leave; only an owner deletes the business
  assert.match(await err(sara, `select delete_business($1)`, [B1]), /NOT_ALLOWED/)
  await as(sara, `select remove_member($1, $2)`, [B1, sara])
  assert.equal((await as(sara, `select * from records`)).length, 0, 'after leaving, nothing is visible')
  await as(ali, `select delete_business($1)`, [B1])
  assert.equal((await as(ali, `select * from records`)).length, 0, 'deleting a business removes its records')
})
