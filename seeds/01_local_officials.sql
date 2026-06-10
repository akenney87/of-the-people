-- Seed: Hall County + Gainesville officials known as of 2026-06-09.
-- Best-effort names; last_verified intentionally NULL so the UI can flag them.
-- Run via Supabase SQL editor against a fresh project after the schema migration.

INSERT INTO public.representatives
  (name, position, state, county, city, party, last_verified)
VALUES
  ('Richard Higgins', 'County Commission Chair',             'GA', 'Hall', NULL,          'Republican',  NULL),
  ('Billy Powell',    'County Commissioner, District 2',     'GA', 'Hall', NULL,          'Republican',  NULL),
  ('Jeff Stowe',      'County Commissioner, District 3',     'GA', 'Hall', NULL,          'Republican',  NULL),
  ('Gerald Couch',    'County Sheriff',                      'GA', 'Hall', NULL,          'Republican',  NULL),
  ('Lee Darragh',     'District Attorney',                   'GA', 'Hall', NULL,          'Republican',  NULL),
  ('Darla Eden',      'County Tax Commissioner',             'GA', 'Hall', NULL,          'Republican',  NULL),

  ('Sam Couvillon',    'Mayor',                              'GA', 'Hall', 'Gainesville', 'Nonpartisan', NULL),
  ('George Wangemann', 'City Council, Ward 1',               'GA', 'Hall', 'Gainesville', 'Nonpartisan', NULL),
  ('Ruth Bruner',      'City Council, Ward 3',               'GA', 'Hall', 'Gainesville', 'Nonpartisan', NULL)
ON CONFLICT (name, position) DO UPDATE SET
  state  = EXCLUDED.state,
  county = EXCLUDED.county,
  city   = EXCLUDED.city,
  party  = EXCLUDED.party;
