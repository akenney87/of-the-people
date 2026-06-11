-- seeds/06_rep_positions_ga09.sql
-- Supervised position inference for the GA-09 general candidates on the 10
-- onboarding issues. Inferred ISSUE-BY-ISSUE from actual evidence — NOT party
-- line. Where there is no citable statement/record, predicted_vote = 'unclear'
-- and the issue is excluded from the match score (no guessing).
--
--   predicted_vote  : 'yes' | 'no' | 'unclear'
--   stance_strength : the candidate's intensity 1-5 (their analog of a voter's
--                     passion), used in the 1-10 alignment scale; NULL if unclear
--   confidence      : how sure WE are of the prediction (display/transparency
--                     only — NOT used in the score)
--   supporting_quote: verbatim or NULL, never paraphrased
-- AI-ESTIMATED / unverified until an official claims & verifies. Idempotent.

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url, 'claude-opus-4-8 (supervised)', now()
from (values
  -- ───────── Andrew Clyde (R, incumbent). Evidenced from clyde.house.gov; the
  --           rest 'unclear' (no scraped source for them).
  (20,102,'no',5,0.95,'Sadly, our Second Amendment rights have been slowly chipped away over the years through unconstitutional laws and undemocratic regulations.','https://clyde.house.gov/issues/issue/?IssueID=14894'),
  (20,103,'no',5,0.95,'it is more important than ever that we take a stand for our nation''s innocent unborn','https://clyde.house.gov/issues/issue/?IssueID=14892'),
  (20,104,'no',4,0.85,'the government tends to make doing business harder than it should be','https://clyde.house.gov/issues/issue/?IssueID=14896'),
  (20,105,'no',3,0.65,'The American people deserve an equitable system of taxation','https://clyde.house.gov/issues/issue/?IssueID=14895'),
  (20,106,'unclear',null,null,null,'https://clyde.house.gov/issues'),
  (20,107,'unclear',null,null,null,'https://clyde.house.gov/issues'),
  (20,108,'unclear',null,null,null,'https://clyde.house.gov/issues'),
  (20,109,'unclear',null,null,null,'https://clyde.house.gov/issues'),
  (20,110,'no',3,0.60,'China, Russia, Iran, and North Korea remain the greatest foreign threats to our national security','https://clyde.house.gov/issues/issue/?IssueID=14890'),
  (20,111,'unclear',null,null,null,'https://clyde.house.gov/issues'),

  -- ───────── Caitlyn Gegen (D). Evidenced from her platform (Now Georgia); the
  --           rest 'unclear' (only general "human rights" language, no specific
  --           stance on immigration path / criminal justice / trans athletes /
  --           foreign policy).
  (279,102,'yes',4,0.90,'If you have to be trained to drive a car, you should have to be trained to own a firearm','https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,103,'yes',5,0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,104,'yes',4,0.80,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,105,'yes',3,0.60,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,106,'yes',5,0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,107,'yes',4,0.85,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,108,'unclear',null,null,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,109,'unclear',null,null,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
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
