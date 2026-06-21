-- seeds/23_ossoff_crosscutting.sql
-- Cross-cutting coverage for Jon Ossoff (rep 10), the de-partisanize-the-match push.
-- Opus research (Congress.gov votes / cosponsorships / statements), human-gated 2026-06-21.
-- 12 cited yes/no positions seeded; the other 12 cross-cutting issues are honest 'unclear'
-- (no citable Ossoff-specific source) and intentionally NOT stored.
-- SUPERVISED DROPS (framing mismatch, per the wording rubric):
--   144 gain-of-function — cited bill is oversight/review, not a ban; individual vote unconfirmed.
--   133 social-media regulation — evidence is child-safety bills (KOSA/REPORT), not content moderation.
-- AI-estimated until the official claims & verifies. Idempotent (overwrites only weaker/unverified).
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research (supervised, cross-cutting)', now()
from (values
  (10, 139, 'no',  3::smallint, 0.85, null, 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1182/vote_118_2_00150.htm'),
  (10, 140, 'yes', 5::smallint, 0.97, 'one of the most astonishing displays of political cowardice in modern American history', 'https://www.congress.gov/bill/118th-congress/house-bill/815'),
  (10, 143, 'no',  3::smallint, 0.65, 'which will gut health care and destroy industry in Ga while adding trillions to the national debt — all to give tax cuts to the rich', 'https://x.com/ossoff/status/1939986910195089585'),
  (10, 146, 'yes', 3::smallint, 0.55, 'developed, deployed, used and regulated, consistent with our core values', 'https://www.ossoff.senate.gov/press-releases/watch-sen-ossoff-convenes-hearing-on-implications-of-artificial-intelligence-for-human-rights/'),
  (10, 101, 'yes', 4::smallint, 0.90, 'cosponsoring legislation to ban secret money from political campaigns', 'https://www.ossoff.senate.gov/one-year-report/'),
  (10, 117, 'yes', 5::smallint, 0.95, null, 'https://www.congress.gov/bill/118th-congress/senate-bill/2299/text'),
  (10, 119, 'yes', 3::smallint, 0.60, 'I''ll fight for outright cannabis legalization, an end to incarceration for nonviolent drug offenses and expungement of records for nonviolent cannabis offenses.', 'https://vote.norml.org/politicians/176134'),
  (10, 129, 'yes', 4::smallint, 0.85, 'I continue to believe that nuclear will likely play an important and growing role in our nation''s energy mix', 'https://x.com/NEI/status/1807515201131983295'),
  (10, 131, 'yes', 3::smallint, 0.80, 'we must guard against the risk of such abuses in the United States and be vigilant against risks associated with the creep of ubiquitous facial recognition into Americans'' daily lives', 'https://www.ossoff.senate.gov/wp-content/uploads/2022/12/FRT-Letter-to-the-FBI-Final-12.19.22.pdf'),
  (10, 134, 'yes', 4::smallint, 0.80, null, 'https://prospect.org/2022/02/03/jon-ossoffs-moment-of-trust/'),
  (10, 135, 'no',  3::smallint, 0.70, 'I am calling on the Trump administration to reverse their catastrophic trade and economic policies that are leading Georgia families into more and more difficult economic straits.', 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00600.htm'),
  (10, 137, 'yes', 4::smallint, 0.90, null, 'https://www.govtrack.us/congress/bills/117/s1/cosponsors')
) as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,
  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at
where public.rep_positions.predicted_vote not in ('yes','no')
   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);
