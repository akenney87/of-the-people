-- seeds/16_clyde_crosswalk.sql
-- Andrew Clyde (rep 20) — positions applied from the issue->vote crosswalk via the
-- Phase B applier (inference/apply_crosswalk.py): resolved Clyde's actual House
-- roll-call vote for each crosswalk bill from the Congress.gov API + House Clerk XML
-- (roll-call numbers are the REAL ones the applier resolved, not agent guesses).
-- Sponsorship entries that Clyde did not (co)sponsor were correctly skipped (no
-- inferring 'no' from a non-sponsorship). All 16 directions human-reviewed.
--
-- DROPPED 123 (paid leave) + 124 (childcare): both keyed to H.R.5376, which passed as
-- Build Back Better (2021) then morphed into the Inflation Reduction Act (2022); the
-- applier resolved the IRA concurrence vote, which did NOT contain those provisions.
-- An omnibus that changed identity is not a clean proxy — left unclear pending a
-- standalone bill, and removed from the crosswalk.
--
-- Reconciliation: fill gaps + overwrite existing ONLY when the crosswalk is stronger
-- (or the existing row isn't a clear yes/no) — never downgrades a solid prior position.
-- Idempotent.

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'crosswalk: congress.gov vote/cosponsorship (supervised)', now()
from (values
  (20, 102, 'no', 3::smallint, 0.85, 'Voted Yea on H.J.Res.44 (ATF pistol-brace rule disapproval), House roll call 252 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll252.xml'),
  (20, 103, 'no', 4::smallint, 0.85, 'Voted Yea on H.R.26 (Born-Alive Abortion Survivors Protection Act), House roll call 29 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll029.xml'),
  (20, 104, 'no', 5::smallint, 0.88, 'Voted Aye on H.R.1 (One Big Beautiful Bill Act), House roll call 190 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll190.xml'),
  (20, 105, 'no', 5::smallint, 0.88, 'Voted Aye on H.R.1 (One Big Beautiful Bill Act), House roll call 190 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll190.xml'),
  (20, 106, 'no', 4::smallint, 0.85, 'Voted Aye on H.R.1 (One Big Beautiful Bill Act), House roll call 190 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll190.xml'),
  (20, 107, 'no', 4::smallint, 0.85, 'Voted Yea on H.R.1 (Lower Energy Costs Act), House roll call 182 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll182.xml'),
  (20, 108, 'no', 3::smallint, 0.6, 'Voted Yea on H.R.29 (Laken Riley Act), House roll call 6 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll006.xml'),
  (20, 109, 'no', 4::smallint, 0.85, 'Voted Yea on H.R.27 (119th Congress), House roll call 33 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll033.xml'),
  (20, 110, 'no', 4::smallint, 0.82, 'Voted Nay on H.Con.Res.21 (118th Congress, Syria withdrawal), House roll call 136 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll136.xml'),
  (20, 111, 'no', 5::smallint, 0.9, 'Voted Yea on H.R.734 (Protection of Women and Girls in Sports Act), House roll call 192 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll192.xml'),
  (20, 112, 'no', 5::smallint, 0.95, 'Voted Nay on H.R.8404 (Respect for Marriage Act), House roll call 513 (117th Congress).', 'https://clerk.house.gov/evs/2022/roll513.xml'),
  (20, 113, 'no', 5::smallint, 0.88, 'Voted Yea on H.R.3492 (Protect Children''s Innocence Act), House roll call 351 (119th Congress).', 'https://clerk.house.gov/evs/2025/roll351.xml'),
  (20, 119, 'no', 4::smallint, 0.9, 'Voted Nay on H.R.3617 (MORE Act), House roll call 107 (117th Congress).', 'https://clerk.house.gov/evs/2022/roll107.xml'),
  (20, 129, 'yes', 2::smallint, 0.55, 'Voted Yea on H.R.6544 (Atomic Energy Advancement Act), House roll call 55 (118th Congress).', 'https://clerk.house.gov/evs/2024/roll055.xml'),
  (20, 130, 'yes', 5::smallint, 0.92, 'Voted Yea on H.R.2 (Secure the Border Act of 2023), House roll call 209 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll209.xml'),
  (20, 133, 'no', 3::smallint, 0.78, 'Voted Yea on H.R.140 (Protecting Speech from Government Interference Act), House roll call 141 (118th Congress).', 'https://clerk.house.gov/evs/2023/roll141.xml')
) as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,
  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at
where public.rep_positions.predicted_vote not in ('yes','no')
   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);
