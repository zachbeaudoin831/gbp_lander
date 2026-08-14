-- Arbitrary date-range readers for the admin Searches tab.
--
-- Run this once in the Supabase SQL editor, AFTER 005_searches.sql.
-- Idempotent; re-running is safe.
--
-- 004/005's functions take a trailing-days window; these take explicit
-- start/end timestamps so the dashboard can show any period (e.g. last
-- Monday through Friday). Same security model: locked tables, SECURITY
-- DEFINER functions gated on is_admin().

create or replace function public.search_log_range(from_ts timestamptz, to_ts timestamptz)
returns table (query text, ip text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
    select detail as query, ip, created_at
    from api_usage
    where public.is_admin()
      and endpoint = 'search'
      and detail is not null
      and created_at >= from_ts and created_at < to_ts
    order by created_at desc
    limit 1000;
$$;

create or replace function public.usage_counts_range(from_ts timestamptz, to_ts timestamptz)
returns table (endpoint text, calls bigint)
language sql stable security definer set search_path = public
as $$
    select endpoint, count(*) as calls
    from api_usage
    where public.is_admin()
      and created_at >= from_ts and created_at < to_ts
    group by endpoint;
$$;

revoke all on function public.search_log_range(timestamptz, timestamptz) from public;
revoke all on function public.usage_counts_range(timestamptz, timestamptz) from public;
grant execute on function public.search_log_range(timestamptz, timestamptz) to authenticated;
grant execute on function public.usage_counts_range(timestamptz, timestamptz) to authenticated;
