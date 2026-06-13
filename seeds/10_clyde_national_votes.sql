-- seeds/10_clyde_national_votes.sql
-- Andrew Clyde (rep 20) - remaining in-scope NATIONAL issues resolved by his
-- ROLL-CALL VOTING RECORD and survey/statement evidence (the issues his own
-- sponsored bills did not cover; see seeds/09 for those). Researched + then
-- ADVERSARIALLY VERIFIED (every citation independently re-checked; anything that
-- could not be confirmed was downgraded to 'unclear'), per
-- inference/SOURCING_CHECKLIST.md. Vote citations link the official House Clerk
-- roll call. 'unclear' rows are stored (we looked; no citable stance) and are
-- excluded from scoring. AI-ESTIMATED / unverified until the official claims &
-- verifies. Idempotent.

insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash)
select 20, v.source_type, v.url, v.title, v.content, md5(v.content)
from (values
  ('https://clerk.house.gov/Votes/2022513','vote_record','Vote - Respect for Marriage Act (H.R.8404)','Rep. Andrew Clyde voted Nay on H.R.8404, the Respect for Marriage Act, House Roll Call 513 (Dec. 8, 2022).'),
  ('https://clerk.house.gov/Votes/2021385','vote_record','Vote - Build Back Better Act (H.R.5376)','Rep. Andrew Clyde voted Nay on H.R.5376, the Build Back Better Act, House Roll Call 385 (Nov. 19, 2021); the bill included federal paid family/medical leave and universal pre-K / child-care subsidies.'),
  ('https://clerk.house.gov/Votes/2025190','vote_record','Vote - One Big Beautiful Bill Act (H.R.1)','Rep. Andrew Clyde voted Yea on H.R.1, the One Big Beautiful Bill Act, House Roll Call 190 (July 3, 2025; Public Law 119-21), which created a federal tax-credit scholarship program for K-12 private-school tuition.'),
  ('https://ontheissues.org/GA/Andrew_Clyde_Jobs.htm','other','AFA Action survey rating','OnTheIssues records Rep. Andrew Clyde rated ''Strongly Anti-livable income'' on the 2020 American Family Association Action voter survey.'),
  ('https://www.congress.gov/bill/117th-congress/house-bill/9448','bill_cosponsorship','Free Speech Defense Act (H.R.9448, 117th)','Rep. Andrew Clyde sponsored H.R.9448, the Free Speech Defense Act, barring the federal government from directing or encouraging social media companies to remove users or label content as misinformation.')
) as v(url, source_type, title, content)
where not exists (select 1 from public.rep_sources rs where rs.rep_id = 20 and rs.url = v.url);

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url, 'claude-opus-4-8 (supervised)', now()
from (values
  (20,112,'no',3,0.97,'Voted Nay on H.R.8404, the Respect for Marriage Act (House Roll Call 513, Dec. 8, 2022), which provides federal protection for same-sex marriage.','https://clerk.house.gov/Votes/2022513'),
  (20,123,'no',3,0.6,'Voted Nay on H.R.5376, the Build Back Better Act (House Roll Call 385, Nov. 19, 2021), which included a federal paid family and medical leave program; House Republicans voted unanimously against it.','https://clerk.house.gov/Votes/2021385'),
  (20,124,'no',2,0.55,'Voted Nay on H.R.5376, the Build Back Better Act (House Roll Call 385, Nov. 19, 2021), which included universal pre-K and federal child-care subsidies; House Republicans voted unanimously against it.','https://clerk.house.gov/Votes/2021385'),
  (20,125,'no',2,0.6,'Rated ''Strongly Anti-livable income'' on the 2020 American Family Association Action survey, opposing the statement that ''It is the government''s responsibility to ensure everyone has a livable income.''','https://ontheissues.org/GA/Andrew_Clyde_Jobs.htm'),
  (20,128,'yes',3,0.65,'Voted Yea on H.R.1, the One Big Beautiful Bill Act (House Roll Call 190, July 3, 2025; now Public Law 119-21), which created a federal tax-credit scholarship program for K-12 private-school tuition.','https://clerk.house.gov/Votes/2025190'),
  (20,133,'no',4,0.65,'Sponsored the Free Speech Defense Act (H.R.9448, 117th Congress), barring the federal government from directing or encouraging social media companies to remove users or label content as misinformation.','https://www.congress.gov/bill/117th-congress/house-bill/9448'),
  (20,101,'unclear',null,null,null,null),
  (20,114,'unclear',null,null,null,null),
  (20,115,'unclear',null,null,null,null),
  (20,116,'unclear',null,null,null,null),
  (20,117,'unclear',null,null,null,null),
  (20,118,'unclear',null,null,null,null),
  (20,120,'unclear',null,null,null,null),
  (20,126,'unclear',null,null,null,null),
  (20,127,'unclear',null,null,null,null),
  (20,131,'unclear',null,null,null,null),
  (20,134,'unclear',null,null,null,null),
  (20,135,'unclear',null,null,null,null),
  (20,136,'unclear',null,null,null,null),
  (20,137,'unclear',null,null,null,null),
  (20,138,'unclear',null,null,null,null)
) as v(rep_id,issue_id,predicted_vote,stance_strength,confidence,supporting_quote,source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  stance_strength  = excluded.stance_strength,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
