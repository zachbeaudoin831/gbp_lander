-- Usage tracking + IP blocklist for the admin dashboard.
--
-- Run this once in the Supabase SQL editor, AFTER 003_admin_portal.sql
-- (it uses the is_admin() function defined there). Idempotent; re-running
-- is safe.
--
-- Write path: the backend inserts into api_usage / ai_usage over the direct
-- DATABASE_URL connection (bypasses RLS). Read path: the /admin dashboard
-- calls the RPC functions below, which are SECURITY DEFINER and gate on
-- is_admin() -- so the tables themselves stay locked (RLS on, no select
-- policies) and nothing is readable through the anon key.

-- ── raw request log (one row per /api/* call) ───────────────────────────
create table if not exists api_usage (
    id         bigint generated always as identity primary key,
    endpoint   text not null,
    ip         text,
    user_agent text,
    created_at timestamptz not null default now()
);

create index if not exists api_usage_created_at_idx on api_usage (created_at desc);
create index if not exists api_usage_ip_idx        on api_usage (ip, created_at desc);

alter table api_usage enable row level security;

-- ── Claude token log (one row per messages.create call) ─────────────────
create table if not exists ai_usage (
    id                    bigint generated always as identity primary key,
    endpoint              text not null,
    model                 text,
    input_tokens          integer not null default 0,
    output_tokens         integer not null default 0,
    cache_creation_tokens integer not null default 0,
    cache_read_tokens     integer not null default 0,
    created_at            timestamptz not null default now()
);

create index if not exists ai_usage_created_at_idx on ai_usage (created_at desc);

alter table ai_usage enable row level security;

-- ── blocklist (managed from the dashboard, enforced by the backend) ─────
create table if not exists blocked_ips (
    ip         text primary key,
    note       text,
    created_at timestamptz not null default now()
);

alter table blocked_ips enable row level security;

drop policy if exists "admin manages blocked ips" on blocked_ips;
create policy "admin manages blocked ips" on blocked_ips
    for all using (public.is_admin()) with check (public.is_admin());

-- ── dashboard aggregates ────────────────────────────────────────────────
-- SECURITY DEFINER lets these read the locked tables; the is_admin() guard
-- in each WHERE clause means non-admins just get zero rows. Aggregating
-- server-side also sidesteps PostgREST's 1000-row response cap.

create or replace function public.usage_daily(days int default 30)
returns table (day date, endpoint text, calls bigint)
language sql stable security definer set search_path = public
as $$
    select (created_at at time zone 'utc')::date as day, endpoint, count(*)
    from api_usage
    where public.is_admin()
      and created_at >= now() - make_interval(days => days)
    group by 1, 2
    order by 1;
$$;

create or replace function public.usage_top_ips(days int default 7)
returns table (ip text, calls bigint, last_seen timestamptz, user_agent text, blocked boolean)
language sql stable security definer set search_path = public
as $$
    select u.ip, count(*) as calls, max(u.created_at) as last_seen,
           max(u.user_agent) as user_agent, (b.ip is not null) as blocked
    from api_usage u
    left join blocked_ips b on b.ip = u.ip
    where public.is_admin()
      and u.created_at >= now() - make_interval(days => days)
      and u.ip is not null and u.ip <> ''
    group by u.ip, b.ip
    order by calls desc
    limit 50;
$$;

create or replace function public.ai_usage_daily(days int default 30)
returns table (day date, model text, calls bigint, input_tokens bigint,
               output_tokens bigint, cache_creation_tokens bigint, cache_read_tokens bigint)
language sql stable security definer set search_path = public
as $$
    select (created_at at time zone 'utc')::date as day, model, count(*),
           sum(input_tokens), sum(output_tokens),
           sum(cache_creation_tokens), sum(cache_read_tokens)
    from ai_usage
    where public.is_admin()
      and created_at >= now() - make_interval(days => days)
    group by 1, 2
    order by 1;
$$;

revoke all on function public.usage_daily(int)    from public;
revoke all on function public.usage_top_ips(int)  from public;
revoke all on function public.ai_usage_daily(int) from public;
grant execute on function public.usage_daily(int)    to authenticated;
grant execute on function public.usage_top_ips(int)  to authenticated;
grant execute on function public.ai_usage_daily(int) to authenticated;
