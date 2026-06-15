-- seeds/13_stateleg_verified.sql
-- State-leg pilot completion: the remaining recovered positions for
-- Drew Echols (SD49) and Matt Dubnik (HD029), after the cheap verify-only
-- continuation (inference/ga-stateleg-verify.workflow.js, run wf_9c3d15d6-bdb).
--
-- That run re-checked the 16 findings the original limit-killed run never
-- verified: ONE Sonnet (claude-sonnet-4-6) adversarial agent per candidate,
-- batched (not one-per-cell), ~6 min, ~80k tokens total. 14 of 16 held.
--
-- DOWNGRADED to 'unclear' (NOT shipped — couldn't be positively confirmed):
--   * Echols issue 209 (statewide SOGI nondiscrimination law)
--   * Dubnik issue 130 (border-security questionnaire quote)
--
-- Combined with seeds/12 (Echols's 7 earlier-verified), the test-address state
-- incumbents now have: Echols 10 scored, Dubnik 11 scored. Rep resolved by
-- district (never a hardcoded serial id). Idempotent. AI-estimated /
-- unverified-by-official until the official claims & verifies.

-- Drew Echols (SD49) -- 3 verified positions
with rep as (select id from public.representatives where position = 'State Senator' and state = 'GA' and state_senate_district = '49')
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select rep.id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised)', now()
from rep cross join (values
  (130, 'yes', 3::smallint, 0.85, null, 'https://open.pluralpolicy.com/vote/1207178c-d393-45b6-8a01-1ebf1e91acf0/'),
  (202, 'yes', 2::smallint, 0.65, null, 'https://gov.georgia.gov/press-releases/2025-04-15/gov-kemp-signs-legislation-delivering-more-1-billion-tax-cuts-and-relief'),
  (208, 'yes', 2::smallint, 0.6, 'It was a simple recommendation much like the rest of the list. The recommendations are just that. Hard to say how many if any of the recommendations will come to fruition.', 'https://www.thecentersquare.com/georgia/article_d10e2e46-c06e-44c2-bb4d-730ff794ed86.html')
) as v(issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength,
  confidence=excluded.confidence, supporting_quote=excluded.supporting_quote,
  source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at;

-- Matt Dubnik (HD029) -- 11 verified positions
with rep as (select id from public.representatives where position = 'State Representative' and state = 'GA' and state_assembly_district = '029')
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select rep.id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised)', now()
from rep cross join (values
  (102, 'no', 4::smallint, 0.85, 'Passed multiple pieces of legislation to protect Second Amendment rights, including Constitutional Carry.', 'https://www.dubnikforhouse.com/scorecard/'),
  (104, 'no', 4::smallint, 0.8, 'passage of the two largest State income tax cuts in Georgia history ... sponsoring a bill to eliminate the homestead property tax statewide', 'https://www.dubnikforhouse.com/about/'),
  (105, 'no', 3::smallint, 0.6, 'passage of the two largest State income tax cuts in Georgia history', 'https://www.dubnikforhouse.com/about/'),
  (128, 'yes', 4::smallint, 0.8, null, 'https://www.ajc.com/education/georgia-house-votes-for-wider-access-to-school-vouchers-amid-criticism/6UFBVHE6XBDV7NRAFDIZYDWEHI/'),
  (202, 'yes', 2::smallint, 0.55, 'passage of the two largest State income tax cuts in Georgia history', 'https://www.dubnikforhouse.com/about/'),
  (111, 'no', 5::smallint, 0.95, 'Voted Yea on HB 267 (Riley Gaines Act, House passage, Feb 27, 2025); also named co-sponsor of HB 1084 (2022) which authorized banning transgender girls from girls'' teams.', 'https://fastdemocracy.com/bill-search/ga/2025_26/bills/GAB00028990/?report-bill-view=1'),
  (113, 'no', 4::smallint, 0.9, 'Voted Yea on SB 140 (House passage, March 16, 2023), banning hormone therapy and surgery for transgender minors.', 'https://fastdemocracy.com/bill-search/ga/2023_24/bills/GAB00024355/'),
  (203, 'no', 2::smallint, 0.5, 'SB 202 (Election Integrity Act of 2021) passed the Georgia House 100-75 on a party-line vote; the law tightened verification (e.g., absentee-ballot ID, drop-box limits).', 'https://www.ajc.com/politics/bill-changing-georgia-voting-rules-passes-state-house/EY2MATS6SRA77HTOBVEMTJLIT4/'),
  (205, 'yes', 3::smallint, 0.8, 'HB 479 (2021), which repealed/limited Georgia''s Civil War-era citizen''s-arrest statute after the Ahmaud Arbery killing, passed the Georgia House 173-0 (unanimous).', 'https://www.cbsnews.com/news/georgia-house-repeal-citizen-arrest-law-ahmaud-arbery-death'),
  (206, 'no', 4::smallint, 0.85, 'Passed multiple pieces of legislation to protect Second Amendment rights, including Constitutional Carry.', 'https://www.dubnikforhouse.com/scorecard/'),
  -- 210 was later reframed from "keep the 6-week ban" to "abortion legal past ~6 weeks?"
  -- so Dubnik's stance flips yes->no; the HB 481 citation still supports it.
  (210, 'no', 4::smallint, 0.75, 'HB 481 (2019, the six-week ''heartbeat''/LIFE Act) passed the Georgia House 92-78; the five Republicans who crossed party lines to vote NO were named (Silcox, Parrish, Martin, Cooper, Powell) and Dubnik was not among them.', 'https://www.wsbtv.com/news/politics/6-lawmakers-crossed-party-lines-on-final-ga-heartbeat-bill-vote/935466467/')
) as v(issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength,
  confidence=excluded.confidence, supporting_quote=excluded.supporting_quote,
  source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at;
