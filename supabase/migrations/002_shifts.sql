-- Saudagar 002: cash shifts (cash drawer sessions) are synced like other rows.
-- Run this in the Supabase SQL editor after 001_init.sql.

alter table public.records drop constraint if exists records_tbl_check;
alter table public.records add constraint records_tbl_check check (tbl in (
  'settings', 'items', 'categories', 'parties', 'partyGroups', 'accounts', 'moneyCategories',
  'txns', 'adjustments', 'godowns', 'users', 'bin', 'shifts'
));
