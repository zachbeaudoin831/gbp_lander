-- Admin portal: read-everything policies for Zach + asset storage.
--
-- Run this once in the Supabase SQL editor. It's idempotent, so re-running
-- is safe.
--
-- Model: the /admin route in the frontend uses the SAME Google OAuth login
-- as everyone else -- no separate admin auth system. What makes an admin is
-- the is_admin() check below, keyed to the signed-in JWT's email. RLS
-- policies OR together, so these sit alongside the existing "own rows only"
-- policies from 002 without loosening them for anyone else.

-- ── who counts as admin ─────────────────────────────────────────────────
-- To add/change admins, edit this list and re-run the file.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'email', '') in (
        'zkbmarketing@gmail.com'
    );
$$;

-- ── read access to the funnel tables ────────────────────────────────────
drop policy if exists "admin selects all profiles" on profiles;
create policy "admin selects all profiles" on profiles
    for select using (public.is_admin());

drop policy if exists "admin selects all landers" on landers;
create policy "admin selects all landers" on landers
    for select using (public.is_admin());

-- leads (001) has RLS on with no policies -- backend-only until now. This
-- opens read-only access to the admin login and nobody else.
drop policy if exists "admin selects all leads" on leads;
create policy "admin selects all leads" on leads
    for select using (public.is_admin());

-- ── asset storage ───────────────────────────────────────────────────────
-- Private bucket holding the exact files each signup downloaded, uploaded
-- by the frontend at download time. Paths are {user_id}/{lander_id}/file,
-- which is what the folder-scoped policies below key on.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Signups write (and re-write, for upsert) only inside their own folder.
drop policy if exists "users insert own assets" on storage.objects;
create policy "users insert own assets" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'assets'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "users update own assets" on storage.objects;
create policy "users update own assets" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'assets'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Owners can list/fetch their own files; admin can list/fetch everyone's.
drop policy if exists "users select own assets" on storage.objects;
create policy "users select own assets" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'assets'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "admin selects all assets" on storage.objects;
create policy "admin selects all assets" on storage.objects
    for select to authenticated
    using (bucket_id = 'assets' and public.is_admin());
