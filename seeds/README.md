# seeds/

SQL files for bootstrapping a fresh Supabase project with non-schema data.

The numbered prefix is application order. All files are idempotent (ON CONFLICT
upserts) so re-running them is safe.

## Apply

Run via Supabase MCP / SQL Editor / `psql`:

```sql
\i seeds/01_local_officials.sql
\i seeds/02_ga_federal.sql
```

## What's in each file

| File | Contents |
|---|---|
| `01_local_officials.sql` | 6 Hall County + 3 Gainesville elected officials. Names are best-effort and should be cross-checked against hallcounty.org / gainesville.org. |
| `02_ga_federal.sql` | GA's 2 US Senators + 14 US Reps, scraped from senate.gov and house.gov on 2026-06-09. |

## Still TODO (seed data not yet in this folder)

- **GA statewide executives** (Governor, Lt. Gov, AG, Sec of State, State Auditor) — needs verification before pasting names.
- **GA state legislature** (56 state senators + 180 state house) — needs OpenStates API key + `districts/update_representatives.py` against the Supabase Postgres.
- **Hall County board of education / county legislature districts** — research required.
