-- Saudagar: accounts, businesses, team members, invites and synced records.
--
-- The app is local-first: every device keeps a full copy of its businesses in IndexedDB and
-- syncs rows through the `records` table. Each row of the app's tables (items, parties,
-- transactions, ...) is one record (business_id, tbl, id) holding the row as JSON.
-- `rev` grows on every insert and update, so devices pull "everything after the rev I have".
--
-- Run this whole file once in the Supabase SQL editor.

-- ---------- profiles ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- businesses and members ----------

create table if not exists public.businesses (
  id uuid primary key,                      -- chosen by the app (same id as the device database)
  name text not null check (length(trim(name)) > 0),
  profile jsonb not null default '{}',      -- business profile: type, address, phone, tax numbers, logo, currency
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'accountant', 'cashier')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists members_user on public.members (user_id);

create table if not exists public.invites (
  code text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null check (role in ('manager', 'accountant', 'cashier')),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

-- role of the signed-in user in a business (null when not a member)
create or replace function public.member_role(b uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where business_id = b and user_id = auth.uid()
$$;

create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where business_id = b and user_id = auth.uid())
$$;

-- ---------- synced rows ----------

create sequence if not exists public.records_rev_seq;

create table if not exists public.records (
  business_id uuid not null references public.businesses (id) on delete cascade,
  tbl text not null check (tbl in (
    'settings', 'items', 'categories', 'parties', 'partyGroups', 'accounts', 'moneyCategories',
    'txns', 'adjustments', 'godowns', 'users', 'bin'
  )),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  rev bigint not null default nextval('public.records_rev_seq'),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (business_id, tbl, id)
);
create index if not exists records_pull on public.records (business_id, rev);

create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.rev := nextval('public.records_rev_seq');
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.records enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists businesses_read on public.businesses;
create policy businesses_read on public.businesses for select to authenticated using (public.is_member(id));
drop policy if exists businesses_owner_update on public.businesses;
create policy businesses_owner_update on public.businesses for update to authenticated
  using (public.member_role(id) = 'owner') with check (public.member_role(id) = 'owner');
-- businesses are created with create_business() and deleted with delete_business()

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member(business_id));
-- members change only through accept_invite(), set_member_role() and remove_member()

drop policy if exists invites_manage on public.invites;
create policy invites_manage on public.invites for all to authenticated
  using (public.member_role(business_id) in ('owner', 'manager'))
  with check (public.member_role(business_id) in ('owner', 'manager') and created_by = auth.uid());

drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (public.is_member(business_id));

-- every member writes the business's rows (the app limits screens by role); settings and
-- device users only by owners and managers
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (
  public.is_member(business_id) and (tbl not in ('settings', 'users') or public.member_role(business_id) in ('owner', 'manager'))
);
drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (public.is_member(business_id))
  with check (public.is_member(business_id) and (tbl not in ('settings', 'users') or public.member_role(business_id) in ('owner', 'manager')));
-- rows are never hard-deleted by the app: deleted = true keeps the change visible to other devices

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select, insert, update on public.records to authenticated;
grant usage on sequence public.records_rev_seq to authenticated;

-- ---------- functions ----------

-- create a business and become its owner; calling it again for the same id is harmless
create or replace function public.create_business(p_id uuid, p_name text, p_profile jsonb)
returns public.businesses language plpgsql security definer set search_path = public as $$
declare b public.businesses;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into b from public.businesses where id = p_id;
  if found then
    if not public.is_member(p_id) then raise exception 'NOT_ALLOWED'; end if;
    return b;
  end if;
  insert into public.businesses (id, name, profile, created_by) values (p_id, trim(p_name), coalesce(p_profile, '{}'), auth.uid())
  returning * into b;
  insert into public.members (business_id, user_id, role) values (p_id, auth.uid(), 'owner');
  return b;
end $$;

-- businesses of the signed-in user with their role
create or replace function public.my_businesses()
returns table (id uuid, name text, profile jsonb, role text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.profile, m.role, b.updated_at
  from public.members m join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.created_at
$$;

-- what an invite code is for (shown before joining)
create or replace function public.check_invite(p_code text)
returns table (business_name text, role text)
language sql stable security definer set search_path = public as $$
  select b.name, i.role from public.invites i join public.businesses b on b.id = i.business_id
  where i.code = upper(trim(p_code)) and i.used_by is null and i.expires_at > now()
$$;

create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.invites;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into i from public.invites where code = upper(trim(p_code)) for update;
  if not found or i.used_by is not null or i.expires_at <= now() then raise exception 'INVALID_INVITE'; end if;
  if public.is_member(i.business_id) then raise exception 'ALREADY_MEMBER'; end if;
  insert into public.members (business_id, user_id, role) values (i.business_id, auth.uid(), i.role);
  update public.invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return i.business_id;
end $$;

create or replace function public.list_members(p_business uuid)
returns table (user_id uuid, full_name text, email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_business) then raise exception 'NOT_ALLOWED'; end if;
  return query
    select m.user_id, p.full_name, p.email, m.role, m.created_at
    from public.members m left join public.profiles p on p.id = m.user_id
    where m.business_id = p_business
    order by m.created_at;
end $$;

create or replace function public.set_member_role(p_business uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.member_role(p_business) is distinct from 'owner' then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'manager', 'accountant', 'cashier') then raise exception 'BAD_ROLE'; end if;
  if p_role <> 'owner' and (select role from public.members where business_id = p_business and user_id = p_user) = 'owner'
     and (select count(*) from public.members where business_id = p_business and role = 'owner') = 1 then
    raise exception 'LAST_OWNER';
  end if;
  update public.members set role = p_role where business_id = p_business and user_id = p_user;
end $$;

-- owners remove anyone; anyone may leave; the last owner cannot go
create or replace function public.remove_member(p_business uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.member_role(p_business) = 'owner' or p_user = auth.uid()) then raise exception 'NOT_ALLOWED'; end if;
  if (select role from public.members where business_id = p_business and user_id = p_user) = 'owner'
     and (select count(*) from public.members where business_id = p_business and role = 'owner') = 1 then
    raise exception 'LAST_OWNER';
  end if;
  delete from public.members where business_id = p_business and user_id = p_user;
end $$;

create or replace function public.delete_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.member_role(p_business) is distinct from 'owner' then raise exception 'NOT_ALLOWED'; end if;
  delete from public.businesses where id = p_business;
end $$;

revoke all on function public.create_business(uuid, text, jsonb) from public, anon;
revoke all on function public.my_businesses() from public, anon;
revoke all on function public.check_invite(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.list_members(uuid) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.delete_business(uuid) from public, anon;
grant execute on function public.create_business(uuid, text, jsonb) to authenticated;
grant execute on function public.my_businesses() to authenticated;
grant execute on function public.check_invite(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.delete_business(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- live updates: other devices are told when a business's records change
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
