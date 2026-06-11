-- seeds/06_rep_positions_ga09.sql
-- Supervised position inference for the GA-09 general candidates on the 10
-- onboarding issues. Clyde (rep 20) grounded in his own clyde.house.gov issue
-- pages (already in rep_sources; quotes are verbatim). Gegen (rep 279) grounded
-- in her documented platform (Now Georgia, 2026). predicted_vote is 'yes'/'no'
-- only where evidence is clear, else 'unclear'. supporting_quote is verbatim or
-- NULL (never paraphrased). Every row carries source_url + confidence.
-- These are AI-ESTIMATED / unverified until an official claims & verifies them.
-- Idempotent on (rep_id, issue_id).

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 (supervised)', now()
from (values
  -- ───────── Andrew Clyde (R, incumbent) — conservative; 'no' on these framings
  (20,102,'no',0.95,'Sadly, our Second Amendment rights have been slowly chipped away over the years through unconstitutional laws and undemocratic regulations.','https://clyde.house.gov/issues/issue/?IssueID=14894'),
  (20,103,'no',0.95,'it is more important than ever that we take a stand for our nation''s innocent unborn','https://clyde.house.gov/issues/issue/?IssueID=14892'),
  (20,104,'no',0.85,'the government tends to make doing business harder than it should be','https://clyde.house.gov/issues/issue/?IssueID=14896'),
  (20,105,'no',0.70,'The American people deserve an equitable system of taxation','https://clyde.house.gov/issues/issue/?IssueID=14895'),
  (20,106,'no',0.80,null,'https://clyde.house.gov/issues'),
  (20,107,'no',0.75,null,'https://clyde.house.gov/issues'),
  (20,108,'no',0.80,null,'https://clyde.house.gov/issues'),
  (20,109,'no',0.60,null,'https://clyde.house.gov/issues'),
  (20,110,'no',0.65,'China, Russia, Iran, and North Korea remain the greatest foreign threats to our national security','https://clyde.house.gov/issues/issue/?IssueID=14890'),
  (20,111,'no',0.80,null,'https://clyde.house.gov/issues'),

  -- ───────── Caitlyn Gegen (D) — progressive platform; 'yes' on these framings
  (279,102,'yes',0.90,'If you have to be trained to drive a car, you should have to be trained to own a firearm','https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,103,'yes',0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,104,'yes',0.80,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,105,'yes',0.70,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,106,'yes',0.95,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,107,'yes',0.85,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,108,'yes',0.60,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,109,'yes',0.60,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,110,'unclear',0.40,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,111,'yes',0.60,null,'https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/')
) as v(rep_id,issue_id,predicted_vote,confidence,supporting_quote,source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
