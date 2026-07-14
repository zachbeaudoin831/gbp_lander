-- Account + saved-lander schema (Supabase / Postgres).
--
-- Unlike 001_init_leads.sql, these tables ARE reachable through the public
-- anon key -- that's the point, the frontend talks to them directly via
-- Supabase Auth + the JS client, with no backend endpoint in between. Row-
-- Level Security policies below are what keep that safe: every policy is
-- scoped to auth.uid(), so a logged-in user can only ever read or write
-- their own rows, never anyone else's.
--
-- Requires Supabase Auth's Email provider with OTP enabled (on by default
-- for new projects: Authentication -> Providers -> Email -> "Enable email
-- OTP" / disable "Confirm email" isn't needed since OTP entry IS the
-- confirmation).
--
-- Run this once in the Supabase SQL editor. It's idempotent, so re-running
-- is safe.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- One row per authenticated user, keyed to Supabase's own auth.users table.
create table if not exists profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    name       text not null,
    phone      text not null,
    email      text not null,
    created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "select own profile" on profiles
    for select using (auth.uid() = id);
create policy "insert own profile" on profiles
    for insert with check (auth.uid() = id);
create policy "update own profile" on profiles
    for update using (auth.uid() = id);

-- Saved landers. `profile` holds the same flat JSON shape buildLanderHTML()
-- in App.jsx consumes -- we save the data, not rendered HTML, so future
-- template changes apply retroactively and the Ads step can pull structured
-- fields (photos, services, offer copy) straight out of it.
create table if not exists landers (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    name       text not null,
    profile    jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists landers_user_id_idx on landers (user_id);
create index if not exists landers_created_at_idx on landers (created_at desc);

alter table landers enable row level security;

create policy "select own landers" on landers
    for select using (auth.uid() = user_id);
create policy "insert own landers" on landers
    for insert with check (auth.uid() = user_id);
