-- seeds/04_elections.sql
-- 2026 Georgia election calendar (per GA SoS 2026 Election Calendar, confirmed
-- 2026-06-11). Idempotent on the (state, election_date, type) unique key.
--   Primary:          May 19, 2026  (already held; results in)
--   Primary runoff:   June 16, 2026 (only races where no one cleared 50%)
--   General:          Nov 3, 2026
--   General runoff:   Dec 1, 2026

insert into public.elections (state, name, election_date, type, is_partisan) values
  ('GA', '2026 Georgia General Primary',          '2026-05-19', 'primary',        true),
  ('GA', '2026 Georgia General Primary Runoff',   '2026-06-16', 'primary_runoff', true),
  ('GA', '2026 Georgia General Election',         '2026-11-03', 'general',        false),
  ('GA', '2026 Georgia General Election Runoff',  '2026-12-01', 'general_runoff', false)
on conflict (state, election_date, type) do update set
  name        = excluded.name,
  is_partisan = excluded.is_partisan;
