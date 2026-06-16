-- seeds/17_ballot_onboarding_b1.sql
-- Ballot onboarding-10 inference, batch 1 (Governor + U.S. Senate): Jones, Bottoms,
-- Jackson, Ossoff, Collins, Dooley. Opus research + Sonnet adversarial verify
-- (workflow wf_1d41c9da-fd0), cite-or-unclear, tiered confidence, Option-B weighted.
-- SUPERVISED: dropped Jackson #103 (abortion) — its only citation was the opposing
-- party's site (georgiademocrat.org); honest blank over a partisan source. All other
-- directions human-reviewed. AI-estimated until the candidate claims & verifies. Idempotent.
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised, onboarding)', now()
from (values
  (261, 102, 'no', 5::smallint, 0.8, null, 'https://freedomindex.us/legislator/3706/'),
  (261, 104, 'no', 4::smallint, 0.75, null, 'https://burtjonesforga.com/issues/'),
  (261, 105, 'no', 4::smallint, 0.6, 'Jones voted to establish a flat income tax rate', 'https://en.wikipedia.org/wiki/Burt_Jones'),
  (261, 106, 'no', 4::smallint, 0.75, null, 'https://www.ajc.com/politics/2026/04/burt-jones-a-look-at-the-ajcs-coverage/'),
  (261, 108, 'no', 4::smallint, 0.5, null, 'https://www.ajc.com/politics/2026/04/burt-jones-a-look-at-the-ajcs-coverage/'),
  (261, 109, 'no', 4::smallint, 0.8, null, 'https://burtjonesforga.com/issues/'),
  (261, 111, 'no', 5::smallint, 0.9, 'Biological men do not belong in women''s sports, period.', 'https://www.times-herald.com/news/lt-gov-burt-jones-prioritizes-ban-on-transgender-athletes-in-women-s-sports/article_ae71532e-d1dc-11ef-aa44-0f4be49fa71a.html'),
  (282, 102, 'yes', 4::smallint, 0.82, 'Gun violence is a public epidemic in this state and in this country', 'https://www.keishaforgovernor.com/issues'),
  (282, 103, 'yes', 5::smallint, 0.9, 'fighting to restore a woman''s right to choose', 'https://www.keishaforgovernor.com/issues'),
  (282, 104, 'yes', 3::smallint, 0.55, 'Expand Medicaid so that 300,000 Georgians can get coverage.', 'https://www.ontheissues.org/Keisha_Lance_Bottoms.htm'),
  (282, 106, 'yes', 3::smallint, 0.5, 'Expand Medicaid so that 300,000 Georgians can get coverage.', 'https://www.ajc.com/politics/2026/04/keisha-lance-bottoms-a-look-at-the-ajcs-coverage/'),
  (282, 111, 'yes', 4::smallint, 0.85, 'I don''t respect the government making decisions about who should compete in athletics.', 'https://www.dailysignal.com/2026/05/27/georgia-candidate-men-in-womens-sports/'),
  (281, 104, 'no', 4::smallint, 0.8, 'Cut the state income tax in half within 4 years and work to eliminate it within 8... Freeze property taxes immediately to stop runaway assessments that price families out of their homes... Use technology and AI to eliminate wasteful spending and improve services', 'https://rickjackson.com/action-plan/'),
  (281, 106, 'no', 4::smallint, 0.8, 'Jackson opposes the full-scale expansion of Medicaid through the Affordable Care Act... Jackson says he would work with the federal government to obtain Medicaid block grants for Georgia that are contingent on work requirements.', 'https://www.ajc.com/politics/2026/04/rick-jackson-a-look-at-the-ajcs-coverage/'),
  (281, 108, 'no', 3::smallint, 0.5, 'Make Georgia number one in the nation for deporting criminal illegal immigrants... Enforce the law without apology', 'https://rickjackson.com/action-plan/'),
  (281, 109, 'no', 4::smallint, 0.8, 'Ban revolving-door justice... Reject soft-on-crime policies... Fully support law enforcement with resources, training, and respect', 'https://rickjackson.com/action-plan/'),
  (281, 111, 'no', 5::smallint, 0.85, 'Ensure boys do not compete in girls'' sports or use girls'' bathrooms or locker rooms', 'https://rickjackson.com/action-plan/'),
  (10, 102, 'yes', 5::smallint, 0.9, 'I support universal criminal history checks for gun purchases, red flag laws to protect family members and domestic partners concerned about the mental health of their loved ones, and closing the gun show loophole. I support a ban on the sale of semi-automatic rifles (''assault weapons'') and high-capacity magazines to the general public.', 'https://www.ontheissues.org/Domestic/Jon_Ossoff_Gun_Control.htm'),
  (10, 103, 'yes', 5::smallint, 0.95, 'I am pro-choice. I believe that women, not the government, should control the private, personal, and complex decision whether to terminate a pregnancy.', 'https://www.ontheissues.org/Social/Jon_Ossoff_Abortion.htm'),
  (10, 104, 'yes', 4::smallint, 0.75, 'Budget cuts aren''t about efficiency but cruelty and chaos.', 'https://www.ontheissues.org/senate/Jon_Ossoff.htm'),
  (10, 105, 'yes', 4::smallint, 0.85, 'Lower taxes for all but the wealthiest Americans. (Jul 2020); We borrow trillions to cut taxes for the wealthy. (Nov 2020)', 'https://www.ontheissues.org/senate/Jon_Ossoff.htm'),
  (10, 107, 'yes', 3::smallint, 0.55, 'The scientific consensus is unambiguous: if pollution from fossil fuel combustion is not controlled, the consequences will be dire.', 'https://www.ontheissues.org/Domestic/Jon_Ossoff_Environment.htm'),
  (10, 108, 'yes', 4::smallint, 0.85, 'DREAMers are Americans and here to stay. Supports a path to legal status for undocumented immigrants who are already here and otherwise follow the law, especially those brought here as children.', 'https://www.ontheissues.org/international/Jon_Ossoff_Immigration.htm'),
  (10, 109, 'yes', 4::smallint, 0.8, 'A nonviolent juvenile offender shouldn''t be marked for life by a mistake they made or a bad situation they found themselves in as a child.', 'https://www.ossoff.senate.gov/press-releases/sen-ossoff-pushes-for-bipartisan-criminal-justice-reform-legislation-to-expunge-records-for-nonviolent-juvenile-offenses/'),
  (10, 110, 'no', 3::smallint, 0.55, null, 'https://www.fp4america.org/scorecard/jon-ossoff/117/'),
  (10, 111, 'yes', 3::smallint, 0.8, 'This bill was overreach. School districts and athletic associations can ensure fair, safe competition without subjecting the bodies of adolescent student athletes — children — to intrusive investigation by the federal government.', 'https://www.foxnews.com/politics/gops-two-top-dem-senate-targets-justify-blocking-bill-bar-men-from-womens-sports'),
  (21, 102, 'no', 5::smallint, 0.9, 'Gun Restrictions: "No restrictions on lawful use." Firearm Liability: "Strongly Disagree" [that gun violence victims should be able to sue dealers/manufacturers].', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 103, 'no', 5::smallint, 0.9, 'Circumstances for Abortion: "None. All creations of God are precious."', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 104, 'no', 4::smallint, 0.75, '"Washington''s reckless spending and fraud are out of control."', 'https://mikecollinsga.com/issues/'),
  (21, 105, 'no', 5::smallint, 0.85, 'Tax Code Changes: "Simplify. Less of it. Less carve outs and special exemptions."', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 106, 'no', 4::smallint, 0.8, 'System Preference: [favors option between] maintaining current Medicare/Medicaid [versus abolishing taxpayer-funded healthcare entirely].', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 107, 'no', 5::smallint, 0.9, 'Hydraulic Fracking: "Agree" [with using fracking for oil/gas extraction]. Environmental Regulations: [Believes stricter environmental laws] "cost too many jobs and hurt the economy."', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 108, 'no', 5::smallint, 0.9, 'Immigration Reform: "We need to stop all illegal immigration and consider a moratorium on immigration until we can reform the immigration laws." / "We need to look a reducing the legal immigration as well."', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 109, 'no', 4::smallint, 0.75, 'Qualified Immunity: "Agree" [police should have personal immunity under departmental policy]. Defunding Police: "Strongly Disagree" [with redirecting funds to mental health programs].', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 110, 'yes', 3::smallint, 0.6, 'U.S. Intervention: [Selects option—] "U.S. has become too involved" and should focus on its own sovereignty [unless facing imminent danger].', 'https://ivoterguide.com/candidate/19604/race/18182/election/939'),
  (21, 111, 'no', 5::smallint, 0.95, '"[The House should] ban men who pretend to be women from participating in women''s sports."', 'https://www.govtrack.us/congress/votes/119-2025/h12'),
  (280, 103, 'no', 2::smallint, 0.55, 'It''s not the way I would have written it … but listen, that''s the law of the land. It''s been that way for six years, and I just don''t think the U.S. Senate and federal government should weigh in.', 'https://www.ajc.com/politics/2026/04/derek-dooley-a-look-at-the-ajcs-coverage/'),
  (280, 104, 'no', 3::smallint, 0.75, 'keeping your taxes low, or getting the government out of your regulations', 'https://www.redandblack.com/athensnews/athens-on-the-ballot-q-a-with-derek-dooley-candidate-for-u-s-senate/article_0323c71f-107f-44ae-b996-ef6801d81076.html'),
  (280, 105, 'no', 2::smallint, 0.4, 'the tax cuts in the ''One Big Beautiful Bill'' last year had a positive impact on Georgia''s economy', 'https://www.ajc.com/politics/2026/04/derek-dooley-a-look-at-the-ajcs-coverage/'),
  (280, 106, 'no', 3::smallint, 0.6, 'Healthcare decisions should be driven by patients and doctors–not insurance companies, bureaucrats or Washington politicians.', 'https://www.dooleyforgeorgia.com/priorities'),
  (280, 107, 'no', 2::smallint, 0.4, 'we got to let the market dictate because we''re going to need natural gas. We''re going to need nuclear next gen. We''re going to need batteries.', 'https://www.redandblack.com/athensnews/athens-on-the-ballot-q-a-with-derek-dooley-candidate-for-u-s-senate/article_0323c71f-107f-44ae-b996-ef6801d81076.html'),
  (280, 108, 'no', 4::smallint, 0.75, 'in no way supports any amnesty for people who came here illegally', 'https://thecurrentga.org/2026/06/01/collins-dooley-clash-on-immigration-ethics-in-gop-senate-debate/'),
  (280, 111, 'no', 5::smallint, 0.9, 'I don''t have to be a sociologist or a doctor to know that it''s simply not fair to allow biological men to compete with women.', 'https://www.foxnews.com/outkick-sports/georgia-senate-candidate-derek-dooley-says-trans-athlete-participation-undermines-gains-womens-sports')
) as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,
  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at
where public.rep_positions.predicted_vote not in ('yes','no')
   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);
