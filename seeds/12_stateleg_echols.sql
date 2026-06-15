-- seeds/12_stateleg_echols.sql
-- Drew Echols — GA State Senator, District 49 (the Gainesville test-address
-- incumbent). First state-legislature (OpenStates) pilot positions.
--
-- PROVENANCE: recovered from the parallel research->adversarial-verify workflow
-- run wld6o0h37 (workflow wf_aeadf546-778) that completed but hit the session
-- limit before its results could be applied. Full recovered research (all 96
-- positions for Echols + Dubnik, 23 yes/no + 73 unclear) is preserved in
-- inference/stateleg_recovered.json. This file ships ONLY Echols positions that
-- the adversarial verifier independently re-fetched and confirmed.
--
-- VERIFIER NOTES:
--   * 102/111/113/115/116 — verifier PASSED (citation_holds=true); quotes and
--     confidence below are the verifier's refined values.
--   * 104/105 — verifier flagged the analyst's ORIGINAL quote as non-verbatim
--     (it confirmed Echols' real YES vote on HB 111 and the direction, then
--     supplied the correct verbatim source text). Shipped here with the
--     verifier's corrected quote — supervised call, the underlying vote + cite
--     are confirmed.
--   * Echols 130/202/208/209 and ALL of Dubnik (rep 109) were NOT reached by the
--     verifier before the limit; they remain in stateleg_recovered.json and are
--     intentionally NOT shipped until the cheap re-verify pass runs.
--
-- Rep is resolved by district (NOT a hardcoded serial id) for robustness.
-- AI-ESTIMATED / unverified-by-official until the official claims & verifies.
-- Idempotent. Issue IDs match public.issues (national 101-138, state 201-210).

with echols as (
  select id from public.representatives
  where position = 'State Senator' and state = 'GA' and state_senate_district = '49'
)

-- ── Evidence (rep_sources): the records cited below ────────────────────────
, ins_sources as (
  insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash, fetched_at)
  select e.id, v.source_type, v.url, v.title, v.content, md5(v.content), now()
  from echols e
  cross join (values
    ('vote_record','https://freedomindex.us/ga/report/77/','GA Senate Freedom Index — District 49 (Echols)','Drew Echols (SD-49) voted YES on SB 163 (2025) firearm preemption (Senate 33-23, 3/6/2025) and YES on HB 111 (2025) state income-tax-rate reduction (Senate passage 30-23, 3/20/2025).'),
    ('bill_cosponsorship','https://www.billtrack50.com/billdetail/1779769','GA SB 1 (2025) — Fair and Safe Athletic Opportunities Act (Riley Gaines Act)','Drew Echols (R) is listed as a sponsor of GA SB 1, the Fair and Safe Athletic Opportunities Act; Senate passed it 35-17 on Feb 6, 2025.'),
    ('bill_cosponsorship','https://www.billtrack50.com/billdetail/1806285','GA SB 30 (2025) — gender-affirming care for minors','Drew Echols (R, Senate Dist. 49) is among the Republican sponsors of GA SB 30 (2025), the as-introduced version prohibiting prescribing or administering certain hormone therapies and puberty-blocking medications to minors.'),
    ('bill_cosponsorship','https://www.billtrack50.com/billdetail/1815780','GA SB 74 (2025) — harmful materials to minors; library exemption repeal','Drew Echols (R) is listed as a sponsor of GA SB 74 (2025) modifying the harmful-materials law re library/librarian exemptions for materials deemed harmful to minors.'),
    ('bill_cosponsorship','https://www.billtrack50.com/billdetail/1806193','GA SB 36 (2025) — Georgia Religious Freedom Restoration Act','Drew Echols (R) is a cosponsor of GA SB 36 (2025), the Georgia Religious Freedom Restoration Act, signed 4/4/2025.')
  ) as v(source_type, url, title, content)
  where not exists (select 1 from public.rep_sources rs where rs.rep_id = e.id and rs.url = v.url)
  returning 1
)

-- ── Positions (rep_positions) ──────────────────────────────────────────────
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select e.id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url,
       'claude-opus-4-8 (supervised; adversarially verified)', now()
from echols e
cross join (values
  (102,'no' ,4::smallint,0.85,'SB163 would increase the civil penalty from $100 to $50,000 for unauthorized acts related to the local regulation of weapons.','https://freedomindex.us/ga/report/77/'),
  (104,'no' ,4::smallint,0.70,'HB111 reduces the state income tax rate to 5.19% in 2025 and to 4.99% by 2027.','https://freedomindex.us/ga/report/77/'),
  (105,'no' ,3::smallint,0.70,'HB111 reduces the state income tax rate to 5.19% in 2025 and to 4.99% by 2027.','https://freedomindex.us/ga/report/77/'),
  (111,'no' ,5::smallint,0.95,'Cosponsored SB 1 (2025), the ''Fair and Safe Athletic Opportunities Act'' (Riley Gaines Act), and voted Yea on Senate passage (35-17, Feb 6, 2025).','https://www.billtrack50.com/billdetail/1779769'),
  (113,'no' ,4::smallint,0.90,'Cosponsored SB 30 (2025), which would ''prohibit prescribing or administering certain hormone therapies and puberty-blocking medications'' to minors.','https://www.billtrack50.com/billdetail/1806285'),
  (115,'yes',3::smallint,0.78,'Cosponsored SB 74 (2025) modifying Georgia''s harmful-materials law re library/librarian exemptions for materials ''deemed harmful to minors.''','https://www.billtrack50.com/billdetail/1815780'),
  (116,'yes',3::smallint,0.70,'Cosponsored SB 36 (2025), the ''Georgia Religious Freedom Restoration Act.''','https://www.billtrack50.com/billdetail/1806193')
) as v(issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  stance_strength  = excluded.stance_strength,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
