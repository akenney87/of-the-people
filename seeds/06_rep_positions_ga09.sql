-- seeds/06_rep_positions_ga09.sql
-- Supervised position inference for the GA-09 general candidates on the 10
-- onboarding issues, following inference/SOURCING_CHECKLIST.md.
--
-- Clyde (rep 20): grounded in his ACTUAL congressional record (sponsored /
-- cosponsored bills, Congress.gov API — see seeds/07). Votes outrank website
-- copy, and his record resolves the issues that were previously 'unclear'
-- (healthcare, environment, immigration, criminal justice, trans).
-- Gegen (rep 279): challenger, no voting record — grounded in her documented
-- platform (Now Georgia). Issues with only general "human rights" language and
-- no specific stance stay 'unclear' (immigration path, criminal justice, trans,
-- foreign policy) — no party-line guessing.
--
--   predicted_vote  : 'yes' | 'no' | 'unclear'
--   stance_strength : candidate intensity 1-5 (their analog of voter passion);
--                     NULL if unclear. Drives the 1-10 alignment scale.
--   confidence      : how sure WE are (display only, NOT in the score)
--   supporting_quote: verbatim statement OR a factual vote/bill citation; never
--                     a paraphrase presented as a quote
-- AI-ESTIMATED / unverified until an official claims & verifies. Idempotent.

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url, 'claude-opus-4-8 (supervised)', now()
from (values
  -- ───────── Andrew Clyde (R, incumbent) — grounded in his voting record
  (20,102,'no',5,0.97,'Sponsored the SHORT Act (H.R.2395) and cosponsored the Second Amendment Restoration Act (H.R.6035).','https://www.congress.gov/bill/119th-congress/house-bill/2395'),
  (20,103,'no',5,0.98,'Sponsored H.Res.56 memorializing the unborn; cosponsored the Abortion Is Not Health Care Act (H.R.73).','https://www.congress.gov/bill/119th-congress/house-bill/73'),
  (20,104,'no',4,0.90,'Cosponsored a balanced budget constitutional amendment (H.J.Res.11) and a bill to terminate the Department of Education (H.R.899).','https://www.congress.gov/bill/119th-congress/house-joint-resolution/11'),
  (20,105,'no',3,0.60,'Cosponsored a balanced budget constitutional amendment (H.J.Res.11), favoring spending cuts over tax increases.','https://www.congress.gov/bill/119th-congress/house-joint-resolution/11'),
  (20,106,'no',4,0.85,'Cosponsored the Putting Patients First Healthcare Freedom Act (H.R.6512); sponsored the Medicaid Funds Integrity Act (H.R.10299).','https://www.congress.gov/bill/119th-congress/house-bill/6512'),
  (20,107,'no',4,0.90,'Sponsored congressional disapprovals of EPA emissions rules; cosponsored the Fuel Emissions Freedom Act (H.R.4117).','https://www.congress.gov/bill/119th-congress/house-bill/4117'),
  (20,108,'no',5,0.92,'Cosponsored the Criminal Alien Removal Clarification Act (H.R.6057) and the No Federal Tax Dollars for Illegal Aliens Health Insurance Act (H.R.7817).','https://www.congress.gov/bill/119th-congress/house-bill/6057'),
  (20,109,'no',4,0.82,'Sponsored the Common-Sense Law Enforcement and Accountability Now in DC Act (H.R.5107) and disapproved DC criminal-justice reforms (H.J.Res.26).','https://www.congress.gov/bill/119th-congress/house-bill/5107'),
  (20,110,'no',3,0.78,'Sponsored the Standing Against Houthi Aggression Act (H.R.6046) and a bill barring U.S. re-entry to the Iran nuclear deal (H.R.3966).','https://www.congress.gov/bill/118th-congress/house-bill/6046'),
  (20,111,'no',4,0.72,'Cosponsored the Chloe Cole Act (H.R.7651), opposing gender-transition procedures (adjacent to the athletics question).','https://www.congress.gov/bill/119th-congress/house-bill/7651'),

  -- ───────── Caitlyn Gegen (D, challenger) — grounded in her platform
  (279,102,'yes',4,0.90,'If you have to be trained to drive a car, you should have to be trained to own a firearm','https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,103,'yes',5,0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,104,'yes',4,0.80,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,105,'yes',3,0.60,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,106,'yes',5,0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,107,'yes',4,0.85,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,108,'yes',4,0.80,'I will address this by first abolishing ICE, and increasing funding for immigration courts.','https://www.jejunemagazine.com/home/caitlyn-gegen-georgias-9th-congressional-district'),
  (279,109,'yes',3,0.70,'I supported training programs designed to empower citizens to contact their elected officials and demand criminal justice reform.','https://www.jejunemagazine.com/home/caitlyn-gegen-georgias-9th-congressional-district'),
  (279,110,'unclear',null,null,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,111,'unclear',null,null,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/')
) as v(rep_id,issue_id,predicted_vote,stance_strength,confidence,supporting_quote,source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  stance_strength  = excluded.stance_strength,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
