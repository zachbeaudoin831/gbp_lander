-- Manual (non-Google) signups from the funnel's download gate.
--
-- Run this once in the Supabase SQL editor. Idempotent; re-running is safe.
--
-- The download page now offers "continue with Google" OR a plain
-- name/email/phone form. Manual signups land in the existing leads table
-- (source='signup') and sync to GoHighLevel server-side; this just adds
-- the email column the form captures.

alter table leads add column if not exists email text;
