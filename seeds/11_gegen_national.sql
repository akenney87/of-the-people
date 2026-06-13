-- seeds/11_gegen_national.sql
-- Caitlyn Gegen (rep 279, GA-09 challenger) - remaining in-scope NATIONAL issues
-- beyond the onboarding 10 (see seeds/06). Challenger with no voting record, so
-- grounded in her platform / candidate questionnaire / interviews, then
-- ADVERSARIALLY VERIFIED (quotes confirmed verbatim at the cited source; any
-- that failed were downgraded to 'unclear'), per inference/SOURCING_CHECKLIST.md.
-- Her public record is thin, so most issues are honestly 'unclear' (stored, no
-- party-line guessing) rather than answered. AI-ESTIMATED / unverified until the
-- candidate claims & verifies. Idempotent.

insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash)
select 279, v.source_type, v.url, v.title, v.content, md5(v.content)
from (values
  ('https://www.mainstreetnews.com/braselton/news/candidate-questionnaire-caitlyn-gegen-ninth-congressional-district-candidate-democratic-primary/article_b3e5b3d6-5edb-4b1a-b4af-edf6ba749f51.html','other','Main Street News candidate questionnaire','Caitlyn Gegen''s candidate questionnaire for the GA-9 Democratic primary (Main Street News), listing priorities including getting money out of politics / overturning Citizens United and fighting for free public-college tuition.')
) as v(url, source_type, title, content)
where not exists (select 1 from public.rep_sources rs where rs.rep_id = 279 and rs.url = v.url);

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence,
       v.supporting_quote, v.source_url, 'claude-opus-4-8 (supervised)', now()
from (values
  (279,101,'yes',5,0.9,'getting money out of politics and overturning Citizens United','https://www.mainstreetnews.com/braselton/news/candidate-questionnaire-caitlyn-gegen-ninth-congressional-district-candidate-democratic-primary/article_b3e5b3d6-5edb-4b1a-b4af-edf6ba749f51.html'),
  (279,122,'yes',5,0.9,'I am going to fight for free tuition for our public colleges and universities.','https://www.mainstreetnews.com/braselton/news/candidate-questionnaire-caitlyn-gegen-ninth-congressional-district-candidate-democratic-primary/article_b3e5b3d6-5edb-4b1a-b4af-edf6ba749f51.html'),
  (279,130,'no',5,0.9,'I will address this by first abolishing ICE, and increasing funding for immigration courts. I think our country needs to reevaluate its entire perspective on immigration though, and stop perceiving it as a security issue, when it is actually a human rights and economics concern.','https://www.jejunemagazine.com/home/caitlyn-gegen-georgias-9th-congressional-district'),
  (279,134,'yes',4,0.9,'We need to break up monopolies. That concentration is driving prices higher.','https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/'),
  (279,112,'unclear',null,null,null,null),
  (279,113,'unclear',null,null,null,null),
  (279,114,'unclear',null,null,null,null),
  (279,115,'unclear',null,null,null,null),
  (279,116,'unclear',null,null,null,null),
  (279,117,'unclear',null,null,null,null),
  (279,118,'unclear',null,null,null,null),
  (279,119,'unclear',null,null,null,null),
  (279,120,'unclear',null,null,null,null),
  (279,121,'unclear',null,null,null,null),
  (279,123,'unclear',null,null,null,null),
  (279,124,'unclear',null,null,null,null),
  (279,125,'unclear',null,null,null,null),
  (279,126,'unclear',null,null,null,null),
  (279,127,'unclear',null,null,null,null),
  (279,128,'unclear',null,null,null,null),
  (279,129,'unclear',null,null,null,null),
  (279,131,'unclear',null,null,null,null),
  (279,132,'unclear',null,null,null,null),
  (279,133,'unclear',null,null,null,null),
  (279,135,'unclear',null,null,null,null),
  (279,136,'unclear',null,null,null,null),
  (279,137,'unclear',null,null,null,null),
  (279,138,'unclear',null,null,null,null)
) as v(rep_id,issue_id,predicted_vote,stance_strength,confidence,supporting_quote,source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote   = excluded.predicted_vote,
  stance_strength  = excluded.stance_strength,
  confidence       = excluded.confidence,
  supporting_quote = excluded.supporting_quote,
  source_url       = excluded.source_url,
  model            = excluded.model,
  inferred_at      = excluded.inferred_at;
