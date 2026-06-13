-- seeds/09_clyde_national.sql
-- Andrew Clyde (rep 20) — extending coverage beyond the 10 onboarding issues to
-- the rest of his in-scope NATIONAL issues (federal office → national scope, IDs
-- 101 + 112-138). Grounded in his ACTUAL legislative record pulled from the
-- Congress.gov API (member C001116) on 2026-06-13 — sponsored / cosponsored
-- bills, per inference/SOURCING_CHECKLIST.md tier 1 (actions over words).
--
-- This file covers ONLY the issues his bill record resolves with citable
-- evidence. Issues that need a roll-call vote or an explicit statement we have
-- not yet retrieved (e.g. same-sex marriage, term limits, popular vote, minimum
-- wage) are intentionally LEFT for the next pass and remain unanswered rather
-- than guessed from party — per the cardinal rule.
--
-- AI-ESTIMATED / unverified until the official claims & verifies. Idempotent.

-- ── Evidence (rep_sources): the bills cited below ──────────────────────────
insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash)
select 20, 'bill_cosponsorship', v.url, v.title, v.content, md5(v.content)
from (values
  ('https://www.congress.gov/bill/119th-congress/house-bill/3492','Protect Children''s Innocence Act','Rep. Andrew Clyde cosponsored H.R.3492, the Protect Children''s Innocence Act, to bar gender-transition medical procedures for minors.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/1447','No Deductions for Marijuana Businesses Act','Rep. Andrew Clyde cosponsored H.R.1447, the No Deductions for Marijuana Businesses Act, opposing favorable tax treatment for the marijuana industry.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/3044','No Vaccine Mandates in Higher Education Act','Rep. Andrew Clyde cosponsored H.R.3044, the No Vaccine Mandates in Higher Education Act, opposing government vaccination mandates as a condition of enrollment.'),
  ('https://www.congress.gov/bill/119th-congress/house-joint-resolution/41','Disapproval — Postsecondary Student Success Grant','Rep. Andrew Clyde sponsored H.J.Res.41, a Congressional Review Act disapproval of the Department of Education''s Postsecondary Student Success Grant rule.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/899','To terminate the Department of Education','Rep. Andrew Clyde cosponsored H.R.899, to terminate the Department of Education.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/3231','American Energy Act','Rep. Andrew Clyde cosponsored H.R.3231, the American Energy Act, a domestic all-of-the-above energy-expansion bill.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/9200','To secure the borders of the United States','Rep. Andrew Clyde cosponsored H.R.9200, to secure the borders of the United States.'),
  ('https://www.congress.gov/bill/119th-congress/house-concurrent-resolution/10','Emergency Border Control Resolution','Rep. Andrew Clyde cosponsored H.Con.Res.10, the Emergency Border Control Resolution.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/8587','Safeguarding Honest Speech Act of 2026','Rep. Andrew Clyde cosponsored H.R.8587, the Safeguarding Honest Speech Act of 2026.'),
  ('https://www.congress.gov/bill/118th-congress/house-bill/8838','Free Speech Defense Act','Rep. Andrew Clyde sponsored H.R.8838, the Free Speech Defense Act.')
) as v(url, title, content)
where not exists (select 1 from public.rep_sources rs where rs.rep_id = 20 and rs.url = v.url);

-- ── Positions (rep_positions) ──────────────────────────────────────────────
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url, 'claude-opus-4-8 (supervised)', now()
from (values
  (20,113,'no',5,0.95,'Cosponsored the Protect Children''s Innocence Act (H.R.3492) and the Chloe Cole Act (H.R.7651), barring gender-transition medical procedures for minors.','https://www.congress.gov/bill/119th-congress/house-bill/3492'),
  (20,119,'no',3,0.65,'Cosponsored the No Deductions for Marijuana Businesses Act (H.R.1447), opposing favorable tax treatment for the marijuana industry.','https://www.congress.gov/bill/119th-congress/house-bill/1447'),
  (20,121,'no',3,0.60,'Cosponsored the No Vaccine Mandates in Higher Education Act (H.R.3044), opposing government vaccination mandates as a condition of enrollment (adjacent to school-entry mandates).','https://www.congress.gov/bill/119th-congress/house-bill/3044'),
  (20,122,'no',3,0.62,'Sponsored a CRA disapproval of the Dept. of Education''s Postsecondary Student Success Grant (H.J.Res.41) and cosponsored a bill to terminate the Department of Education (H.R.899).','https://www.congress.gov/bill/119th-congress/house-joint-resolution/41'),
  (20,129,'yes',2,0.55,'Cosponsored the American Energy Act (H.R.3231), a domestic all-of-the-above energy-expansion bill (nuclear not named explicitly).','https://www.congress.gov/bill/119th-congress/house-bill/3231'),
  (20,130,'yes',5,0.95,'Cosponsored H.R.9200 (to secure the borders) and the Emergency Border Control Resolution (H.Con.Res.10).','https://www.congress.gov/bill/119th-congress/house-bill/9200'),
  (20,132,'yes',4,0.75,'Cosponsored the Safeguarding Honest Speech Act (H.R.8587) and sponsored the Free Speech Defense Act (H.R.8838), favoring broad free-speech protection.','https://www.congress.gov/bill/119th-congress/house-bill/8587')
) as v(rep_id,issue_id,predicted_vote,stance_strength,confidence,supporting_quote,source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  stance_strength  = excluded.stance_strength,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
