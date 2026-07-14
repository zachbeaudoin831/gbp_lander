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

---

# Account setup (Step 2: Create Account)

Unlike the lead store above, this one talks to Supabase **directly from the
browser** via `@supabase/supabase-js` — no backend endpoint in between. Row-
Level Security is what keeps that safe (see [`002_init_accounts.sql`](002_init_accounts.sql)):
every policy is scoped to `auth.uid()`, so a logged-in user can only ever
touch their own rows.

## 1. Create the tables

Open **SQL Editor** in the same Supabase project used above, paste the
contents of [`002_init_accounts.sql`](002_init_accounts.sql), and run it. It
creates `profiles` and `landers`, both RLS-locked to the owning user.

## 2. Confirm email OTP is enabled

**Authentication → Providers → Email** — the Email provider should already be
on for a new project. Nothing else to toggle: `signInWithOtp` sends a 6-digit
code by default, and entering that code back in the modal (`verifyOtp`) *is*
the confirmation step, so this works whether or not "Confirm email" is
checked.

**Known gotcha:** Supabase's built-in email sender is rate-limited to a
handful of emails/hour on new projects — fine for testing the flow a few
times, but you'll want to plug in a real SMTP provider (Resend has a free
tier) under **Authentication → Settings → SMTP Settings** before real users
hit this.

## 3. Get the project URL + anon key

**Project Settings → API** (this is a *different* pair of values from the
`DATABASE_URL` connection string above — don't confuse them):

- **Project URL** — looks like `https://<ref>.supabase.co`
- **anon / public key** — a long JWT starting `eyJ...`

The anon key is meant to be public (it's what ships in the browser bundle);
Row-Level Security is what actually protects the data, not secrecy of this
key.

## 4. Set them in Vercel

In the **frontend** Vercel project (not `gbp-lander`, the backend) →
**Settings → Environment Variables**, add:

- `VITE_SUPABASE_URL` — the Project URL from step 3
- `VITE_SUPABASE_ANON_KEY` — the anon key from step 3
- **Environments:** Production

These are build-time (Vite bakes them into the bundle), so a **redeploy** is
required after adding them, not just a page refresh.

## 5. Verify

Build a lander, click **Step 2: Create Account**, fill in the form. If the
modal instead shows "Account creation isn't configured yet," the env vars
above haven't taken effect on the live deploy yet. Once configured: submit
the form, check the email inbox for the 6-digit code, enter it, and confirm
a row appears in **Table Editor → landers** (and `profiles`) in Supabase.
