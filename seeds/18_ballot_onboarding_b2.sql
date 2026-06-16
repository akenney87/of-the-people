-- seeds/18_ballot_onboarding_b2.sql
-- Ballot onboarding-10 inference, batch 2 (AG / Lt. Gov / Sec. State): Strickland,
-- Dolezal, McLaurin, Barrett, Fleming. Opus research + Sonnet verify (run wf_a6608bad-b4b),
-- cite-or-unclear, tiered, Option-B weighted. SUPERVISED: dropped all of Tanya Miller's
-- positions — sourced only to a partisan PAC (gawinlist.com) characterizing her in the
-- third person, not her own words/record; she'll be sourced from her legislative record
-- later. Down-ballot records are thinner (Fleming 1, Barrett 3) — honest. Idempotent.
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised, onboarding)', now()
from (values
  (66, 102, 'no', 5::smallint, 0.88, 'A Legal Shield for your Constitutional Rights. Defend Georgia''s gun laws against federal overreach.', 'https://stricklandforgeorgia.com/issues'),
  (66, 103, 'no', 5::smallint, 0.92, 'Voted YES on HB 481 (2019); voted YES on SB 456 (2022); ''100% Pro-Life Backs the Badge Fights for Election Integrity'' (2022 campaign messaging); Pro-Life Certification from GA Life Alliance (2020, 2022).', 'https://choicetracker.org/ga/people/brian-strickland/131530752'),
  (66, 108, 'no', 3::smallint, 0.5, 'A Legal Firewall for Georgia. Stopping Sanctuary Cities. Remove criminal illegals. Taxpayers over illegal aliens.', 'https://stricklandforgeorgia.com/issues'),
  (66, 109, 'no', 2::smallint, 0.45, 'Ending Soft on Crime Policies and backing our men and women in blue.', 'https://stricklandforgeorgia.com/issues'),
  (51, 102, 'no', 5::smallint, 0.85, '"Shall not be infringed" is clear.', 'https://gregdolezal.com/'),
  (51, 103, 'no', 5::smallint, 0.9, 'Life begins at conception and must be protected. Greg proudly supported Georgia''s heartbeat bill.', 'https://gregdolezal.com/'),
  (51, 104, 'no', 5::smallint, 0.8, 'It is the government''s responsibility to ensure everyone has a livable income. [Answer:] Strongly Disagree', 'https://ivoterguide.com/candidate?elecK=796&raceK=11887&primarypartyk=-&canK=46679&path=%2Fall-in-state%2FGeorgia%2F'),
  (51, 105, 'no', 4::smallint, 0.6, 'Lower taxes for everyone—not have politicians play investment banker and pick winners and losers', 'https://gregdolezal.com/'),
  (51, 106, 'no', 4::smallint, 0.85, 'It is the government''s responsibility to ensure everyone has health insurance. [Answer:] Disagree', 'https://ivoterguide.com/candidate?elecK=796&raceK=11887&primarypartyk=-&canK=46679&path=%2Fall-in-state%2FGeorgia%2F'),
  (51, 107, 'no', 2::smallint, 0.45, 'Man-made climate change is a global threat and requires urgent political action. [Answer:] Strongly Disagree', 'https://ivoterguide.com/candidate/46679/race/26946/election/1409'),
  (51, 108, 'no', 5::smallint, 0.85, 'A nation without borders is not a nation.', 'https://gregdolezal.com/'),
  (51, 109, 'no', 4::smallint, 0.6, 'Mandatory minimum sentencing should be required and enforced for violent crimes. [Answer:] Agree', 'https://ivoterguide.com/candidate?elecK=796&raceK=11887&primarypartyk=-&canK=46679&path=%2Fall-in-state%2FGeorgia%2F'),
  (51, 111, 'no', 5::smallint, 0.95, 'This legislation restores fairness and preserves the integrity of women''s athletics.', 'https://senatepress.net/sen-greg-dolezal-applauds-signing-of-riley-gaines-act-of-2025-into-law.html'),
  (38, 102, 'yes', 5::smallint, 0.9, 'As we saw from the horrific events last week, it shouldn''t be easy for a person to obtain and use a firearm immediately during their worst moment.', 'https://www.thegeorgiavirtue.com/georgia-legislature/georgia-lawmakers-pushing-for-waiting-period-for-gun-purchases/'),
  (38, 103, 'yes', 5::smallint, 0.95, 'Georgia''s deadly 6-week abortion ban is one of the most extreme in the country. Josh voted against it in 2019 and will work to overturn the ban. ... Personal health decisions should remain between patients and their doctors.', 'https://www.joshmclaurin.com/priorities'),
  (38, 105, 'yes', 3::smallint, 0.45, 'Republicans have handed billions in tax breaks to corporations while child care, housing, and local services go underfunded.', 'https://www.joshmclaurin.com/priorities'),
  (38, 106, 'yes', 3::smallint, 0.5, 'Georgia''s failure to expand Medicaid has shuttered hospitals and left half a million Georgians uninsured. Josh will fight to expand coverage and make care accessible in every corner of the state.', 'https://www.joshmclaurin.com/priorities'),
  (38, 109, 'yes', 5::smallint, 0.9, 'We know that locking more people up for longer sentences is taking away their ability piece by piece to participate in society.', 'https://gps.press/georgias-2026-candidates-on-prison-and-parole-reform/'),
  (278, 103, 'yes', 5::smallint, 0.9, 'I will be a vocal advocate of reproductive rights and I will work to ensure that Fulton is a safe haven for women seeking reproductive services and the medical professionals who provide them.', 'https://atlantaciviccircle.org/profile/dana-barrett/'),
  (278, 104, 'yes', 3::smallint, 0.6, 'The most basic role of government is to protect its citizens... Government also has a role as a provider of services that cannot easily be provided for individually (e.g. roads, infrastructure), services that benefit the entire community (e.g. education, public health, transportation), and services for citizens who find themselves in vulnerable situations.', 'https://atlantaciviccircle.org/profile/dana-barrett/'),
  (278, 109, 'yes', 4::smallint, 0.75, 'I will support programs that keep first-time, non-violent offenders out of jail, and I will fully fund our DA and work with her and our sheriff on case backlogs and diversion programs to create a more equitable justice system and a safer community.', 'https://atlantaciviccircle.org/profile/dana-barrett/'),
  (194, 111, 'no', 5::smallint, 0.95, 'Tim Fleming (R-114) voted Yea on HB 267 (Riley Gaines Act) on House floor passage Feb. 27, 2025 (passed 102-54), which bars transgender girls/women from competing on female sports teams in Georgia public schools and colleges.', 'https://fastdemocracy.com/bill-search/ga/2025_26/bills/GAB00028990/?report-bill-view=1')
) as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,
  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at
where public.rep_positions.predicted_vote not in ('yes','no')
   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);
