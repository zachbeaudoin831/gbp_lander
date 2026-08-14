-- Search-query logging for the admin Searches tab.
--
-- Run this once in the Supabase SQL editor, AFTER 004_usage.sql. Idempotent;
-- re-running is safe.
--
-- Adds a free-text `detail` column to the request log (today it carries the
-- /api/search query string, i.e. WHAT business was searched) and an
-- admin-gated reader for it. Same security model as 004: the table stays
-- locked, the SECURITY DEFINER function checks is_admin().

alter table api_usage add column if not exists detail text;

create or replace function public.search_log(days int default 30)
returns table (query text, ip text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
    select detail as query, ip, created_at
    from api_usage
    where public.is_admin()
      and endpoint = 'search'
      and detail is not null
      and created_at >= now() - make_interval(days => days)
    order by created_at desc
    limit 1000;
$$;

revoke all on function public.search_log(int) from public;
grant execute on function public.search_log(int) to authenticated;
