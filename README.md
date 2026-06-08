# Of the People

A civic-tech app that scores how well your elected officials align with your own positions on a set of policy issues. You answer yes / no / skip on a list of issues (with a 1–5 "passion weight"); the app shows you which incumbents — federal, state, county, city — best match your views, and lets the officials themselves claim their profile and verify their own answers.

Current scope (June 2026): **Gainesville and Hall County, Georgia.** The codebase was originally NY-only; the data pipeline is mid-pivot to GA. See the project plan at `~/.claude/plans/wobbly-yawning-emerson.md` and the project-state memory at `~/.claude/projects/.../memory/project_otp_scope_and_status.md` for the strategic direction.

---

## Repository layout

```
OtP/
├── server.js                   # Express + Postgres backend (will be replaced by
│                                 Supabase Auth + Vercel API routes in Phase 2)
├── schema.sql                  # Postgres tables, reverse-engineered from server.js
├── shared/
│   └── issues.json             # Canonical issue list — single source of truth
│                                 imported by client, server, and Python pipeline
├── client/                     # Vite + React 19 + Tailwind frontend (PWA)
│   ├── src/pages/              # Login, Register, Dashboard, Representatives, ...
│   ├── src/components/         # Navbar, Layout, MobileNav, ProtectedRoute, ...
│   └── src/api.js              # axios instance + JWT refresh interceptor
├── districts/                  # NY data pipeline + geo-routing service
│   ├── find_district.py        # Point-in-polygon district lookup (called from
│   │                             server.js via child process)
│   ├── update_representatives.py  # The end-to-end NY data refresh script
│   ├── generate_rep_votes.py   # DEPRECATED — mock rep votes; replaced by the
│   │                             blue-check LLM pipeline in plan Phase 3
│   ├── NY_Cong/, NY_Leg_upp/, NY_Leg_low/   # NY TIGER 2024 shapefiles
│   ├── counties/               # US county shapefile (132MB, gitignored)
│   └── *.json                  # Scraper output cached as JSON
└── scripts/                    # (Empty)
```

## Prerequisites

- Node 22+ (`node-v22.13.1-x64.msi` is in the parent project folder for convenience)
- Python 3.11+ with `geopandas`, `shapely`, `psycopg2-binary`, `requests`, `beautifulsoup4`, `python-dotenv` (used by `districts/*.py`)
- Postgres 15+ running locally (or use a Supabase project's connection string)
- A Gmail App Password (for the email-verification flow) — Phase 2 of the plan migrates this to Resend

The Python district-lookup service is invoked from `server.js` via `spawn("C:\\Python313\\python.exe", ...)`. **That hardcoded Windows path needs to change** if you're not on Windows or have Python at a different path; track it as a Phase-2 issue.

## First-time setup

```pwsh
# from inside OtP/
git clone https://github.com/akenney87/of-the-people.git    # if not already cloned
cd OtP

# 1. Postgres
createdb otp                                                 # or psql equivalent
psql -d otp -f schema.sql

# 2. Server-side env
cp .env.example .env
# fill in DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, EMAIL_USER, EMAIL_PASS,
# OPENSTATES_API_KEY
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# ...use that twice for JWT_SECRET and JWT_REFRESH_SECRET

# 3. Backend deps
npm install                                                  # at OtP/ root

# 4. Frontend deps
cd client && npm install

# 5. Python deps for the district service
cd ../districts
python -m pip install geopandas shapely psycopg2-binary requests beautifulsoup4 python-dotenv
```

## Day-to-day dev loop

Two processes:

```pwsh
# Terminal 1 — backend (port 5000)
cd OtP
node server.js

# Terminal 2 — frontend (port 5173, Vite dev server)
cd OtP/client
npm run dev
```

Open <http://localhost:5173>. Register a new user (the only allowed state is `GA`); the verification email is sent through Gmail SMTP, so check the inbox for the magic link.

To populate the `representatives` table for the current NY data layer:

```pwsh
cd OtP
python districts/update_representatives.py
```

This is a stopgap until Phase 1 of the plan replaces NY scrapers with GA ones.

## Where the issues come from

`shared/issues.json` is the single source of truth. It's imported by:

- `server.js` → `findIssueText()`
- `client/src/pages/Register.jsx` → onboarding subset (`onboarding: true` flag)
- `client/src/pages/Dashboard.jsx` → full feed
- Future: the Python pipeline and the LLM inference Edge Function

The ID space is namespaced by scope:

| range  | scope    |
|--------|----------|
| 100s   | national |
| 200s   | GA state |
| 300s   | Hall County |
| 400s   | City of Gainesville |

Issues flagged `needs_review: true` were generated as placeholders during the GA pivot and need to be validated against real Georgia / Hall County / Gainesville policy debate before being shown to real users.

## Known gotchas

- **Hardcoded paths in server.js:** `"C:\\Python313\\python.exe"` and `http://localhost:5173/verify/...` need to be env-var-driven before deploying.
- **Wide-open admin endpoints:** `/api/load-ny-*`, `/api/get-districts`, `/api/get-representatives`, `/api/issues`, and `/api/civic-info` currently require no authentication. Locked down in plan Phase 2.
- **Tokens in `localStorage`:** XSS-readable. Migrated to httpOnly cookies (Supabase Auth) in Phase 2.
- **`generate_rep_votes.py`:** uses party-probability mocks, not real positions. Deprecated; do not run in production. Replaced by the blue-check inference pipeline in Phase 3.
- **Google Civic Information API:** sunset by Google in April 2025. The `/api/civic-info` route is dead code.
- **132MB county shapefile:** `districts/counties/tl_2024_us_county.shp` is gitignored. If you need it on a fresh clone, download from <https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/>.

## Roadmap

See `~/.claude/plans/wobbly-yawning-emerson.md`. Short version:

| Phase | Scope | Status |
|------|-------|--------|
| 0 | Triage + canonical issues | Done |
| 1 | GA data pipeline (find_district + rosters + scrapers) | Done |
| 2a | httpOnly cookies + CORS + PII discard | Done |
| 2b | Supabase + Vercel migration | See `PHASE2B.md` — pending your accounts |
| 3 | Blue-check LLM inference | Pending |
| 4 | Gainesville invite-only beta | Pending |
| 5 | Iterate + expand | Pending |
