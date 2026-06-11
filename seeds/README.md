# seeds/

SQL files for bootstrapping a fresh Supabase project with non-schema data.

The numbered prefix is application order. All files are idempotent (ON CONFLICT
upserts) so re-running them is safe.

## Apply

Run via Supabase MCP / SQL Editor / `psql`:

```sql
\i seeds/00_issues.sql
\i seeds/01_local_officials.sql
\i seeds/02_ga_federal.sql
\i seeds/03_ga_legislature.sql
```

## What's in each file

| File | Contents |
|---|---|
| `00_issues.sql` | All 58 canonical issues. Generated from `shared/issues.json` (phase 3.4 rewrite). Upserts on `id` — re-run after any edit to `issues.json` to keep `public.issues` in sync. |
| `01_local_officials.sql` | 6 Hall County + 3 Gainesville elected officials. Names are best-effort and should be cross-checked against hallcounty.org / gainesville.org. |
| `02_ga_federal.sql` | GA's 2 US Senators + 14 US Reps, scraped from senate.gov and house.gov on 2026-06-09. |
| `03_ga_legislature.sql` | 55 GA state senators + 179 GA state house, scraped from Wikipedia. |

## Still TODO (seed data not yet in this folder)

- **GA statewide executives** — applied via MCP 2026-06-10 but not captured as a file. Names: Brian Kemp (Gov), Burt Jones (Lt. Gov), Chris Carr (AG), Brad Raffensperger (SoS), Greg S. Griffin (State Auditor). All flagged `last_verified=NULL` for human cross-check.
- **GA state legislature** — see `03_ga_legislature.sql`. 55 senators + 179 reps scraped from Wikipedia.
- **Hall County board of education / county legislature districts** — research required.
- **Gainesville city council ward shapefile** — not publicly downloadable; deferred. See `users.city_council_dist` (NULL until shapefile is acquired).
