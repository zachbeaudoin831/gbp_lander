# Lead store setup (Supabase)

The `/api/lead` endpoint writes to a Postgres `leads` table. This is a
one-time setup. Nothing here exposes secrets in the repo — the only secret
(the connection string) lives in Vercel's env vars, never in git.

## 1. Create the Supabase project

1. Sign in at <https://supabase.com> and create a new project.
2. Pick a strong database password when prompted and save it (you'll need it
   for the connection string).

## 2. Create the table

Open **SQL Editor** in the Supabase dashboard, paste the contents of
[`001_init_leads.sql`](001_init_leads.sql), and run it. It creates the
`leads` table with Row-Level Security enabled (no public access).

## 3. Get the connection string

In **Project Settings → Database → Connection string**, choose:

- **Mode: Transaction** (this is the pgBouncer pooler on port **6543**).
  Serverless functions must use the pooler, not the direct 5432 connection,
  or they'll exhaust the database's connection limit.

It looks like:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Substitute the password you set in step 1.

## 4. Set it in Vercel

In the **gbp-lander** (backend) Vercel project → **Settings → Environment
Variables**, add:

- **Name:** `DATABASE_URL`
- **Value:** the transaction-pooler connection string from step 3
- **Environments:** Production (and Preview if you want)

Redeploy the backend (or it redeploys on the next push).

## 5. Verify

```
curl -s https://gbp-lander.vercel.app/api/health
# expect: "lead_store_configured": true
```

Then submit a test lead through a lander's "Ask a question" modal and confirm
a row appears in **Table Editor → leads** in Supabase.

## Notes

- The endpoint is **unauthenticated** (it's a public lead form). Field lengths
  are capped server-side to prevent oversized payloads, but there is **no rate
  limiting yet** — that's a known follow-up (protects against form spam / bill
  amplification).
- The table holds **PII** (name, phone). Keep the connection string only in
  Vercel env vars, and don't add public RLS policies unless you deliberately
  want browser-key access.
