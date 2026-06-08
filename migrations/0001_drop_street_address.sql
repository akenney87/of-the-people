-- Migration: drop users.street_address; add pre-computed district columns.
--
-- Background: Phase 2a.2 of the plan stops persisting street addresses entirely.
-- The signup flow geocodes the user's street once, resolves their districts via
-- find_district.py, and stores ONLY the district IDs plus city/state/zip. This
-- shrinks the breach-blast-radius of the (politically-sensitive) votes data
-- substantially and removes per-request geocoding from /api/representatives.
--
-- Apply once against an existing database. For greenfield databases, schema.sql
-- already reflects the post-migration shape; this file is purely for upgrade.
--
--   psql -U $DB_USER -d $DB_NAME -f migrations/0001_drop_street_address.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS cong_district     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_senate_dist TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_house_dist  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS districts_resolved_at TIMESTAMPTZ;

-- Drop the column we no longer want on disk. Any existing rows lose the value
-- forever; that's deliberate. After this migration, /api/representatives will
-- return an empty list for legacy users until they update their address in
-- Profile and the new flow recomputes districts.
ALTER TABLE users DROP COLUMN IF EXISTS street_address;

COMMIT;
