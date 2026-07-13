-- Lead store schema (Supabase / Postgres).
--
-- Run this once in the Supabase SQL editor (or via `psql "$DATABASE_URL" -f
-- db/001_init_leads.sql`). It's idempotent, so re-running is safe.
--
-- This holds PII (name + phone). Supabase encrypts at rest and requires TLS
-- in transit. Row-Level Security is enabled below and left with NO policies,
-- so the table is reachable only via the service role / direct connection
-- string the backend uses -- never via the public anon/browser key.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

create table if not exists leads (
    id            uuid primary key default gen_random_uuid(),
    business      text,
    name          text not null,
    phone         text not null,
    contact_pref  text check (contact_pref in ('call', 'text')),
    source        text not null default 'form',
    page_url      text,
    fbclid        text,
    gclid         text,
    status        text not null default 'new'
                       check (status in ('new', 'contacted', 'won', 'lost')),
    created_at    timestamptz not null default now()
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_status_idx     on leads (status);

-- Lock the table down: RLS on, no policies == no access through the public
-- anon key. The backend connects with the pooler/service connection string,
-- which bypasses RLS, so inserts from the API still work.
alter table leads enable row level security;
