-- Of the People — Postgres schema
--
-- Reverse-engineered from the SQL in server.js so a fresh database can be
-- bootstrapped in one command. Run against an empty database before starting
-- the server:
--
--   psql -U $DB_USER -d $DB_NAME -f schema.sql
--
-- Phase 2 of the plan replaces this with Supabase + Supabase migrations.
-- Until then, this file is the authoritative source for table shape.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id                          SERIAL PRIMARY KEY,
    email                       TEXT UNIQUE NOT NULL,
    password                    TEXT NOT NULL,
    street_address              TEXT,
    city                        TEXT,
    state                       TEXT,
    zip_code                    TEXT,
    county                      TEXT,
    is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token          TEXT,
    verification_token_expires  TIMESTAMPTZ,
    reset_token                 TEXT,
    reset_token_expires         TIMESTAMPTZ,
    refresh_token               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
    id          INTEGER PRIMARY KEY,
    text        TEXT NOT NULL,
    -- Older code referred to `name` and `description`; keep them nullable
    -- so legacy Python scripts (generate_rep_votes.py) don't blow up.
    name        TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS representatives (
    id                       SERIAL PRIMARY KEY,
    name                     TEXT NOT NULL,
    position                 TEXT NOT NULL,
    state                    TEXT,
    county                   TEXT,
    city                     TEXT,
    party                    TEXT,
    email                    TEXT,
    phone                    TEXT,
    website                  TEXT,
    photo_url                TEXT,
    bio                      TEXT,
    policies                 TEXT,
    office_name              TEXT,
    election_date            DATE,
    cong_district            TEXT,
    state_senate_district    TEXT,
    state_assembly_district  TEXT,
    last_verified            DATE,
    UNIQUE (name, position)
);

CREATE TABLE IF NOT EXISTS votes (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id        INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    vote            BOOLEAN NOT NULL,
    passion_weight  INTEGER NOT NULL CHECK (passion_weight BETWEEN 1 AND 5),
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, issue_id)
);

CREATE TABLE IF NOT EXISTS representative_votes (
    id              SERIAL PRIMARY KEY,
    rep_id          INTEGER NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
    issue_id        INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    vote            BOOLEAN NOT NULL,
    passion_weight  INTEGER NOT NULL CHECK (passion_weight BETWEEN 1 AND 5),
    UNIQUE (rep_id, issue_id)
);

CREATE TABLE IF NOT EXISTS alignment_scores (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rep_id       INTEGER NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
    score        NUMERIC(5,2),
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, rep_id)
);

-- Seed the issues table from shared/issues.json on first boot.
-- The server's POST /api/user/votes will also lazy-insert any missing issue
-- ids it encounters, so this seed is convenience, not a hard requirement.
-- (Run a one-off node script after creating the DB:
--    node -e "require('./shared/issues.json').forEach(...)" )

COMMIT;
