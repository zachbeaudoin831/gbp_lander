-- Selected-business log for the admin Searches tab.
--
-- Run this once in the Supabase SQL editor, AFTER 006_date_ranges.sql.
-- Idempotent; re-running is safe.
--
-- One row every time a visitor picks a business from the search results
-- (= every /api/profile call), carrying the listing's name, phone, address,
-- and website straight from Google. This is what makes an owner who ran the
-- funnel but never signed up reachable. Same security model as 004-006:
-- backend writes over DATABASE_URL, table locked under RLS, admin reads
-- through a SECURITY DEFINER function gated on is_admin().

create table if not exists selections (
    id         bigint generated always as identity primary key,
    place_id   text not null,
    name       text,
    phone      text,
    address    text,
    website    text,
    ip         text,
    created_at timestamptz not null default now()
);

create index if not exists selections_created_at_idx on selections (created_at desc);

alter table selections enable row level security;

create or replace function public.selections_range(from_ts timestamptz, to_ts timestamptz)
returns table (place_id text, name text, phone text, address text, website text,
               ip text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
    select place_id, name, phone, address, website, ip, created_at
    from selections
    where public.is_admin()
      and created_at >= from_ts and created_at < to_ts
    order by created_at desc
    limit 1000;
$$;

revoke all on function public.selections_range(timestamptz, timestamptz) from public;
grant execute on function public.selections_range(timestamptz, timestamptz) to authenticated;
