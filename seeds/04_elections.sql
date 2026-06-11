-- seeds/04_elections.sql
-- 2026 Georgia election calendar (dates per Vote411 / GA SoS, captured 2026-06-11).
-- Idempotent on the (state, election_date, type) unique key.
-- primary_runoff (mid-July 2026) is intentionally omitted until a contest
-- actually needs one; the schema supports it.

insert into public.elections (state, name, election_date, type, is_partisan) values
  ('GA', '2026 Georgia General Primary',          '2026-06-16', 'primary',        true),
  ('GA', '2026 Georgia General Election',         '2026-11-03', 'general',        false),
  ('GA', '2026 Georgia General Election Runoff',  '2026-12-01', 'general_runoff', false)
on conflict (state, election_date, type) do update set
  name        = excluded.name,
  is_partisan = excluded.is_partisan;
