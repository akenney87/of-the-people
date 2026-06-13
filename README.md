# Of the People

A civic-tech app that scores how well your elected officials align with your own positions on a set of policy issues. You answer yes/no on a list of issues (with a 1–5 "passion weight"); the app shows you which incumbents — federal, state, county, city — best match your views, and lets the officials themselves claim their profile and verify their own answers.

Current scope: **Gainesville and Hall County, Georgia.**

---

## Architecture

```
Browser (PWA, React 19 + Vite, /client)
   |
   |  - supabase.auth.* for signup / login / reset / verify
   |  - supabase.from(...) for reads/writes (RLS-scoped)
   |  - supabase.rpc('get_my_representatives' | 'get_my_alignment', ...)
   |  - fetch('/api/lookup-districts')  --> Vercel Python serverless
   |
   v
Vercel
   - Static hosting for client/dist
   - Python serverless: /api/lookup-districts.py
        (Nominatim geocode + TIGER shapefile point-in-polygon)
   |
   v
Supabase  (project: aeqncvlmgwdnnzhyeovs, region us-east-2)
   - auth.users  (managed)
   - public.users / votes / representatives / issues /
     representative_votes / alignment_scores       (RLS on every table)
   - RPC: get_my_representatives, get_my_alignment
   - Trigger: on_auth_user_created -> mirrors auth.users into public.users
```

There is **no Express server** anymore — the legacy `server.js` was removed once Supabase Auth and the Vercel route replaced it.

## Repository layout

```
OtP/
├── api/                          # Vercel serverless functions (project root)
│   ├── lookup-districts.py       # POST { street, city, state, zip } -> districts
│   └── requirements.txt
├── client/                       # Vite + React 19 + Tailwind frontend (PWA)
│   ├── .env.example              # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
│   ├── src/lib/supabaseClient.js # @supabase/ssr browser client (one per page load)
│   ├── src/pages/                # Login, Register, Dashboard, ...
│   └── src/components/
├── districts/                    # TIGER shapefiles + scrapers + Python lookup
│   ├── find_district.py          # Imported by api/lookup-districts.py
│   ├── update_representatives.py # CLI: refresh public.representatives
│   ├── GA_Cong/, GA_Leg_upp/, GA_Leg_low/, GA_Counties/
│   ├── NY_*                      # legacy NY shapefiles (kept for portability)
│   ├── hall_county_officials.json
│   └── gainesville_city_officials.json
├── shared/
│   └── issues.json               # Canonical issue list (also seeded to Supabase)
├── vercel.json
├── PHASE2B.md                    # Migration runbook (mostly already executed)
└── README.md
```

## First-time setup

```pwsh
# 1) Install client deps
cd OtP/client
npm install

# 2) Local env for Vite (gitignored; already populated for this project)
#    Confirm client/.env.local has:
#      VITE_SUPABASE_URL=https://aeqncvlmgwdnnzhyeovs.supabase.co
#      VITE_SUPABASE_ANON_KEY=sb_publishable_...

# 3) Vercel CLI (so /api/lookup-districts runs locally)
npm i -g vercel
vercel login                         # one-time, interactive
cd ..                                # back to OtP/
vercel link                          # link this repo to your Vercel project
```

## Day-to-day dev loop

**Frontend-only** (fastest, but `/api/lookup-districts` is dead):

```pwsh
cd OtP/client
npm run dev                          # http://localhost:5173
```

**Full stack** (Python function included):

```pwsh
cd OtP
vercel dev                           # serves the Vite app + the Python fn
```

Either way, signup/login/votes/representatives talk to Supabase directly. Only signup district resolution and the address-change flow need the Python function.

## Refreshing representative data

```pwsh
cd OtP
python districts/update_representatives.py
```

Scrapes house.gov + senate.gov + OpenStates + NAAG, plus the curated `hall_county_officials.json` and `gainesville_city_officials.json`, and upserts everything into `public.representatives`. Needs `OPENSTATES_API_KEY` in a local `.env` and a Postgres connection string for the Supabase database. Phase 4 of the plan moves this onto a Supabase Scheduled Edge Function.

## Where the issues come from

`shared/issues.json` is the single source of truth. Imported by:

- `client/src/pages/Register.jsx` (onboarding subset, where `onboarding: true`)
- `client/src/pages/Dashboard.jsx` (full feed)
- `client/src/pages/MyVotes.jsx` (lookup text by id)
- Supabase `seed_issues` migration (`public.issues` table)

ID space:

| range  | scope    |
|--------|----------|
| 100s   | national |
| 200s   | GA state |
| 300s   | Hall County |
| 400s   | City of Gainesville |

Issues flagged `needs_review: true` were generated as placeholders during the GA pivot and need validation before being shown to real users.

## Known gotchas

- **Hall County / Gainesville officials**: every row in the two officials JSONs is flagged `needs_review:true`. Names there are best-effort; cross-check with the county / city official sites before showing real users.
- **`districts/counties/tl_2024_us_county.shp`**: 132MB, gitignored. The GA-only `GA_Counties/tl_2024_13_county.shp` (~7MB) is committed and used by default. Download the US-wide one from <https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/> only if you need to do non-GA lookups.

## Roadmap

See **`ROADMAP.md`** for the full forward plan — inference strategy through beta
and the funding-tier pivots after.

| Phase | Scope | Status |
|------|-------|--------|
| 0   | Triage + canonical issues | Done |
| 1   | GA data pipeline | Done |
| 2a  | httpOnly cookies + CORS + PII discard (Express era) | Done — then deleted in 2b |
| 2b  | Supabase + Vercel migration | Done — pending first deploy |
| 3.1–3.3 | Blue-check inference pipeline scaffold | Done (dormant; not run at scale) |
| 3.4 | Question bank rewrite + fact-check | Done |
| 3.5 | Ballot lifecycle schema (elections/contests/candidacies) | Done |
| 3.6 | Roster + position seed (Nov 2026 general, Hall County) | In progress |
| 4   | Gainesville invite-only beta | Pending |
| 5   | Iterate + expand (see ROADMAP funding tiers) | Pending |
