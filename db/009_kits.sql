-- Campaign kits for the no-account funnel.
--
-- Run this once in the Supabase SQL editor. Idempotent; re-running is safe.
--
-- The funnel no longer asks for a Google account. A visitor builds their
-- lander + ads, then hands over name/email/phone to get them. That signup
-- is a row in `leads` (source='kit'); its files land in the private `kits`
-- bucket at {lead_id}/file, uploaded by the backend with the service key.
-- `kit_token` is the unguessable secret in the emailed /kit link -- the
-- backend checks it before signing storage URLs.

alter table leads add column if not exists email      text;
alter table leads add column if not exists kit_token  text;
alter table leads add column if not exists kit_files  jsonb;   -- [{name, size}] once uploads land
alter table leads add column if not exists emailed_at timestamptz;

create index if not exists leads_kit_token_idx on leads (kit_token) where kit_token is not null;

insert into storage.buckets (id, name, public)
values ('kits', 'kits', false)
on conflict (id) do nothing;

-- Only the backend (service role, bypasses RLS) writes here. The admin
-- portal can list/fetch everything for the Leads tab.
drop policy if exists "admin selects all kits" on storage.objects;
create policy "admin selects all kits" on storage.objects
    for select to authenticated
    using (bucket_id = 'kits' and public.is_admin());
