# Phase 2b — Supabase + Vercel migration runbook

This document is the step-by-step plan for moving the app off the Express + local Postgres stack and onto Supabase (Postgres + Auth + Edge Functions + Storage) and Vercel (frontend + Node/Python serverless routes). It is **not yet executed.** Run through it in a focused session — most of the work can't start until you have the Supabase project URL and anon key in hand.

The goal at the end of Phase 2b: live at `https://otp.vercel.app` (or a custom domain), Supabase Auth handling signup/login, no `server.js`, the existing React app + the migrated routes both running on Vercel.

---

## Status at the start of Phase 2b

Already done (Phase 2a):
- httpOnly cookie auth ✅
- CORS allowlist ✅
- Street addresses are no longer stored ✅
- Wide-open admin endpoints removed ✅
- Backend `package.json` exists ✅
- Migration file 0001 ready for application ✅

Still on the old stack:
- bcrypt + JWT hand-rolled auth in `server.js` (will be replaced by Supabase Auth)
- Express server (will be replaced by Vercel API routes)
- Local Postgres (will be replaced by Supabase Postgres)
- Gmail SMTP (will be replaced by Supabase Auth SMTP override or Resend)
- Python district lookup runs as a spawned child process (will become a Vercel Python serverless function)

---

## Step 1 — Provision the cloud projects (you, not Claude)

1. **Supabase**
   - Sign up at https://supabase.com (free tier is fine for v1).
   - Create a new project. Pick a region near Gainesville GA — `us-east-1` (N. Virginia) is the closest with full feature support.
   - In Project Settings → API, copy: **Project URL**, **anon public key**, **service_role key**.
   - In Project Settings → Database, copy the **direct connection string** (for one-time migrations) and the **pooled connection string** (for runtime).
   - In SQL Editor, run `schema.sql` (the post-migration shape — you don't need to apply `migrations/0001_*.sql` separately on a fresh project).

2. **Vercel**
   - Sign up at https://vercel.com using your GitHub account so it can read `akenney87/of-the-people`.
   - Don't deploy yet. We'll set up the project config first in Step 3.

3. **Resend** (for transactional email)
   - Sign up at https://resend.com (free tier: 3,000 emails/month).
   - Create an API key.
   - Verify your domain or use the resend.dev sandbox sender for now.

You'll end this step with five new secrets to drop into `.env` (and later into Vercel + Supabase project env). Add them to a local `.env`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # server-only
SUPABASE_DB_URL=postgresql://...          # for one-shot migrations only
RESEND_API_KEY=re_...
```

---

## Step 2 — Replace JWT auth with Supabase Auth

Files that change:
- `server.js` → most of `/api/login`, `/api/refresh-token`, `/api/logout`, `/api/register`, `/api/forgot-password`, `/api/reset-password`, `/api/verify/:token`, `/api/send-verification-email`, `authenticateToken` middleware all disappear. Replaced by Supabase Auth.
- `client/src/api.js` → continues to talk to the same API base URL, but the auth flow runs through `@supabase/ssr` (cookie-based session) rather than our custom `/api/login`.
- `client/src/pages/Login.jsx` / `Register.jsx` / `ForgotPassword.jsx` / `ResetPassword.jsx` / `VerifyEmail.jsx` → use Supabase client methods (`supabase.auth.signInWithPassword`, `signUp`, `resetPasswordForEmail`, `exchangeCodeForSession`).

Packages to add (under `client/`):

```bash
cd OtP/client
npm install @supabase/supabase-js @supabase/ssr
```

Create `client/src/lib/supabaseClient.js`:

```js
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

Add to `client/.env.local`:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

In `Register.jsx`, the new signup flow:

```js
const { data, error } = await supabase.auth.signUp({
  email: userData.email,
  password: userData.password,
  options: { data: { city: userData.city, state: userData.state, zip_code: userData.zip_code } },
});
```

The custom `users` table stays (it has city, state, zip_code, county, the three district columns, etc.) but its primary key changes to `id UUID REFERENCES auth.users(id)`. Supabase Auth manages email verification, password reset, refresh tokens — all that custom code in server.js goes away.

A new migration `migrations/0002_auth_handover.sql` rewires `users.id` from `SERIAL` to `UUID REFERENCES auth.users(id)`:

```sql
-- This is a destructive migration; run it before any user signs up via
-- Supabase Auth. Drops the legacy id column and replaces it with the
-- UUID that auth.users issues. Keeps email + districts + everything else.
BEGIN;
  ALTER TABLE users DROP CONSTRAINT users_pkey;
  ALTER TABLE users DROP COLUMN id;
  ALTER TABLE users ADD COLUMN id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE;
  -- password, verification_token, reset_token, refresh_token, is_verified
  -- all become Supabase-managed and can drop:
  ALTER TABLE users DROP COLUMN password;
  ALTER TABLE users DROP COLUMN verification_token;
  ALTER TABLE users DROP COLUMN verification_token_expires;
  ALTER TABLE users DROP COLUMN reset_token;
  ALTER TABLE users DROP COLUMN reset_token_expires;
  ALTER TABLE users DROP COLUMN refresh_token;
  ALTER TABLE users DROP COLUMN is_verified;
COMMIT;
```

Set up a Supabase trigger so a new auth.users row auto-inserts into the public.users row:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, city, state, zip_code)
  VALUES (
    NEW.id, NEW.email,
    (NEW.raw_user_meta_data ->> 'city'),
    (NEW.raw_user_meta_data ->> 'state'),
    (NEW.raw_user_meta_data ->> 'zip_code')
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

District resolution stays on the server — after signup, the frontend POSTs the (street + city + state + zip) to a Vercel Python function that returns the districts; the client then writes them back via the Supabase REST client (RLS policy: only the authenticated user can update their own row).

---

## Step 3 — Move routes to Vercel API directory

Vercel auto-deploys files under `client/api/` (filename = URL path). The remaining non-auth routes become:

```
client/
├── api/
│   ├── lookup-districts.py        # Vercel Python serverless: geocode + districts
│   ├── representatives.js          # GET /api/representatives
│   ├── user/
│   │   ├── address.js              # PUT /api/user/address (after district lookup)
│   │   └── votes.js                # GET/POST/PUT /api/user/votes
│   └── representatives/[id]/
│       ├── alignment.js            # GET /api/representatives/:id/alignment
│       └── index.js                # GET /api/representatives/:id
└── ...
```

For `lookup-districts.py`, add a `client/api/requirements.txt`:

```
geopandas==1.0.1
shapely==2.0.6
requests==2.32.3
```

Vercel detects this and installs into a Lambda layer. The function reads shapefiles from the deployed bundle (you may need to add `vercel.json` with `includeFiles: "districts/**"` to pull them in).

Each Vercel JS route is a small handler. Example for representatives:

```js
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export default async function handler(req, res) {
  const accessToken = req.cookies["sb-access-token"];   // Supabase sets these
  if (!accessToken) return res.status(401).json({ message: "Not authed." });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) return res.status(401).json({ message: "Invalid session." });

  const { data: userRow } = await supabaseAdmin
    .from("users").select("*").eq("id", user.id).single();

  // ...same query as today's server.js, just using supabaseAdmin.from("representatives")
  res.json(rows);
}
```

The `server.js` file becomes dormant after this — keep it around for one session as a reference, then delete in Step 5.

`vercel.json`:

```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "framework": "vite",
  "functions": {
    "client/api/**/*.py": { "runtime": "python3.11" }
  },
  "includeFiles": "districts/**"
}
```

---

## Step 4 — Email + cron + storage

- **Email**: in Supabase Auth → Email Templates, customize verification + reset emails. In SMTP settings, drop in the Resend SMTP creds (host `smtp.resend.com`, port 465). Delete the nodemailer / Gmail dependency from `server.js` / `package.json` when you delete server.js.
- **Weekly cron** (data freshness): create a Supabase Edge Function `refresh-representatives` (Deno) that calls the same APIs `update_representatives.py` calls — but written in TypeScript so it runs in Supabase. Schedule via Supabase Scheduled Jobs (`select cron.schedule('weekly-rep-refresh', '0 6 * * 1', $$ select net.http_post(...) $$)`). The Python script becomes a manual / one-shot tool used only locally.
- **Storage**: rep photos and any future PDF source attachments live in a Supabase Storage bucket called `representatives`. Public read, authenticated write (admin only).

---

## Step 5 — Deploy & decommission Express

1. `vercel link` from inside `OtP/` (links the repo).
2. Set Vercel env vars (Project Settings → Environment Variables): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Mark `SERVICE_ROLE_KEY` as not exposed to the client.
3. `vercel --prod`. First deploy will create the URL `otp-XXXX.vercel.app`.
4. Test the full flow against the live URL: signup → verification email → login → /dashboard → /representatives.
5. Once green: delete `OtP/server.js`, `OtP/package.json` (the backend one), and the `cookie-parser`/`bcrypt`/`jsonwebtoken`/`nodemailer`/`express-rate-limit` deps. Keep them in git history; don't ship them.

---

## Exit criteria

- `https://otp.vercel.app/login` works against Supabase Auth (signup, login, password reset all flow without ever calling Express).
- A Gainesville address resolves to GA-09 + Hall County + Gainesville Council + the expected reps, via the Vercel Python function.
- `server.js` is deleted; only the React app + `api/` directory ship.
- `node_modules/` for the backend is gone.
- `OtP/.env` has Supabase + Resend keys only — no `JWT_SECRET`, no `EMAIL_USER`, no `DB_*` (those move into Supabase project settings or Vercel env).

Estimated focused effort: ~1.5 sessions (≈ a long afternoon) once accounts are provisioned. Most of the work is mechanical — replacing `req.user.userId` with the Supabase user id and rewriting each route handler to fetch via the Supabase client instead of `pool.query()`.

## Open questions to settle before starting

1. **Custom domain** — do you want `oftthepeople.app` / `otp.app` / something else, or stick with the free Vercel subdomain for the first beta?
2. **Supabase region** — east-coast US is the obvious pick; confirm before you create the project (region is not cheaply changeable later).
3. **Row-Level Security policies** — RLS should be ON for every public table. The polices are simple ("users can only read/update their own row," "votes belong to the user_id that wrote them") but they need to be authored and tested. Plan to spend half an hour on this specifically.
4. **OpenStates API key in Vercel** — the Python district-lookup function doesn't need it (only shapefile + geo lookup), but if you fold the weekly refresh cron into an Edge Function, that needs the key too.
