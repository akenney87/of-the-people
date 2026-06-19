-- seeds/19_hall_roster_general.sql
-- Hall County GA roster build → 2026 GENERAL ballot (election_id=2).
-- Built from supervised multi-agent research (workflow wf_1199c287-526): Hall County
-- Board of Elections, GA SoS, Ballotpedia, AJC, AccessWDUN, Gainesville Times, etc.
-- ROSTER/NAMES ONLY — not positions (alignment inference comes later, per person).
--
-- Adds confirmed challengers + missing current officeholders, creates the general
-- contests, and links confirmed candidacies (status 'qualified', cited).
--
-- SUPERVISED HOLDS (NOT asserted here — accuracy over completeness):
--   * HD-031 GOP nominee — incumbent Emory Dunahoo RETIRED (confirmed: farewell
--     speech on House floor + AJC Sept-2025). Open seat; nominee likely Chad Bingham
--     (binghamforstatehouse.com) but no primary-result citation found. Only the
--     confirmed Democrat (Conolus Scott Jr.) is loaded; GOP side pending verification.
--   * HD-027 (Hawkins) and HD-030 (McCollum) — no general opponent confirmed; may be
--     uncontested. Incumbent loaded only.
--   * DA (Darragh) and Solicitor General (Grant) — no general opponent confirmed.
--   * PSC D5 Libertarian "Thomas Blooming" — name spelling unverified vs GA SoS list.
--   * State Senate D49 Dem (William Wallace) — Ballotpedia snippet; verify vs sample ballot.
--   * Board of Education Post 2 (Sloan) — full general field unverified; incumbent only.
--
-- DATA NOTE: representatives.id 276 "Bruce Thompson" (Labor Commissioner) is STALE —
-- Thompson died in office (Nov 2024); Barbara Rivera Holmes (Kemp appointee, 2025) is
-- the real current commissioner and is loaded here. Recommend retiring id 276.
--
-- Idempotent (NOT EXISTS guards on rep name+position, contest office+district,
-- candidacy contest+rep). Mirrors migration hall_roster_general_2026.

-- 1) NEW REPRESENTATIVES (challengers + missing current officeholders)
insert into public.representatives
  (name, party, position, state, county, city, is_statewide,
   cong_district, state_senate_district, state_assembly_district,
   county_commission_district, school_board_district, office_name, website, last_verified)
select v.name, v.party, v.position, 'GA', v.county, null, v.is_statewide,
   null, v.ssd, v.shd, v.ccd, v.sbd, v.office_name, v.website, current_date
from (values
  ('Katherine Juhan-Arnold','D','Agriculture Commissioner',null,true,null,null,null,null,'Georgia Commissioner of Agriculture',null),
  ('Keisha Sean Waites','D','Insurance Commissioner',null,true,null,null,null,null,'Georgia Insurance and Safety Fire Commissioner',null),
  ('Barbara Rivera Holmes','R','Labor Commissioner',null,true,null,null,null,null,'Georgia Commissioner of Labor',null),
  ('Nikki Porcher','D','Labor Commissioner',null,true,null,null,null,null,'Georgia Commissioner of Labor',null),
  ('Lydia Catalina Powell','D','State School Superintendent',null,true,null,null,null,null,'Georgia State School Superintendent',null),
  ('Peter Hubbard','D','Public Service Commissioner',null,true,null,null,null,null,'Public Service Commission, District 3',null),
  ('Fitz Johnson','R','Public Service Commissioner',null,true,null,null,null,null,'Public Service Commission, District 3',null),
  ('Josh Tolbert','R','Public Service Commissioner',null,true,null,null,null,null,'Public Service Commission, District 5',null),
  ('Shelia Edwards','D','Public Service Commissioner',null,true,null,null,null,null,'Public Service Commission, District 5',null),
  ('Thomas Blooming','L','Public Service Commissioner',null,true,null,null,null,null,'Public Service Commission, District 5',null),
  ('William Wallace','D','State Senator',null,false,'49',null,null,null,null,null),
  ('Dave Cooper','D','State Senator',null,false,'50',null,null,null,null,null),
  ('Mateo Sanabria','D','State Representative',null,false,null,'028',null,null,null,null),
  ('Scott Soracco','D','State Representative',null,false,null,'029',null,null,null,null),
  ('Conolus Scott Jr.','D','State Representative',null,false,null,'031',null,null,null,null),
  ('Mark Turner','R','County Commissioner, District 1','Hall',false,null,null,'D1',null,null,null),
  ('Tyler Crawford','R','County Commissioner, District 3','Hall',false,null,null,'D3',null,null,null),
  ('Gina Pilcher','I','County Commissioner, District 3','Hall',false,null,null,'D3',null,null,null),
  ('Inez Grant','R','Solicitor General','Hall',false,null,null,null,null,null,null),
  ('David Gibbs','R','County Commission Chairman','Hall',false,null,null,null,null,null,null),
  ('Mark Pettitt',null,'Clerk of Superior Court','Hall',false,null,null,null,null,null,null),
  ('Patti Walters Laine',null,'Probate Court Judge','Hall',false,null,null,null,null,null,null),
  ('Margaret S. Gregory','R','Chief Magistrate Judge','Hall',false,null,null,null,null,null,null),
  ('Marion G. Merck','R','County Coroner','Hall',false,null,null,null,null,null,null),
  ('Bill Thompson','R','Board of Education Member','Hall',false,null,null,null,'At-Large',null,null),
  ('Joe Anglin','R','Board of Education Member','Hall',false,null,null,null,'At-Large',null,null),
  ('Susan Martin Taylor','D','Board of Education Member','Hall',false,null,null,null,'At-Large',null,null),
  ('Brian Gregory Sloan','R','Board of Education Member','Hall',false,null,null,null,'Post 2',null,null)
) as v(name, party, position, county, is_statewide, ssd, shd, ccd, sbd, office_name, website)
where not exists (
  select 1 from public.representatives r where r.name = v.name and r.position = v.position
);

-- 2) GENERAL-ELECTION CONTESTS (election_id = 2)
insert into public.contests
  (election_id, office_name, level, is_statewide, county,
   state_senate_district, state_house_district, county_commission_district, school_board_district)
select 2, v.office_name, v.level, v.is_statewide, v.county, v.ssd, v.shd, v.ccd, v.sbd
from (values
  ('Agriculture Commissioner','state',true,null,null,null,null,null),
  ('Insurance Commissioner','state',true,null,null,null,null,null),
  ('Labor Commissioner','state',true,null,null,null,null,null),
  ('State School Superintendent','state',true,null,null,null,null,null),
  ('Public Service Commission, District 3','state',true,null,null,null,null,null),
  ('Public Service Commission, District 5','state',true,null,null,null,null,null),
  ('State Senator','state',false,'Hall','49',null,null,null),
  ('State Senator','state',false,'Hall','50',null,null,null),
  ('State Representative','state',false,'Hall',null,'027',null,null),
  ('State Representative','state',false,'Hall',null,'028',null,null),
  ('State Representative','state',false,'Hall',null,'029',null,null),
  ('State Representative','state',false,'Hall',null,'030',null,null),
  ('State Representative','state',false,'Hall',null,'031',null,null),
  ('Board of Commissioners, District 1','county',false,'Hall',null,null,'D1',null),
  ('Board of Commissioners, District 3','county',false,'Hall',null,null,'D3',null),
  ('District Attorney','county',false,'Hall',null,null,null,null),
  ('Solicitor General','county',false,'Hall',null,null,null,null),
  ('Board of Education, At-Large','school',false,'Hall',null,null,null,'At-Large'),
  ('Board of Education, Post 2','school',false,'Hall',null,null,null,'Post 2')
) as v(office_name, level, is_statewide, county, ssd, shd, ccd, sbd)
where not exists (
  select 1 from public.contests c
  where c.election_id = 2 and c.office_name = v.office_name
    and c.state_senate_district is not distinct from v.ssd
    and c.state_house_district is not distinct from v.shd
    and c.county_commission_district is not distinct from v.ccd
    and c.school_board_district is not distinct from v.sbd
);

-- 3) CANDIDACIES (confirmed only; status qualified; cited)
insert into public.candidacies (contest_id, rep_id, party, is_incumbent, status, source_url)
select co.id, r.id, v.party, v.is_incumbent, 'qualified', v.src
from (values
  ('Tyler Harper','Agriculture Commissioner',null,null,null,null,'R',true,'https://ballotpedia.org/Georgia_Agriculture_Commissioner_election,_2026'),
  ('Katherine Juhan-Arnold','Agriculture Commissioner',null,null,null,null,'D',false,'https://ballotpedia.org/Georgia_Agriculture_Commissioner_election,_2026'),
  ('John F. King','Insurance Commissioner',null,null,null,null,'R',true,'https://ballotpedia.org/Georgia_Insurance_Commissioner_election,_2026'),
  ('Keisha Sean Waites','Insurance Commissioner',null,null,null,null,'D',false,'https://ballotpedia.org/Georgia_Insurance_Commissioner_election,_2026'),
  ('Barbara Rivera Holmes','Labor Commissioner',null,null,null,null,'R',true,'https://ballotpedia.org/Georgia_Labor_Commissioner_election,_2026'),
  ('Nikki Porcher','Labor Commissioner',null,null,null,null,'D',false,'https://ballotpedia.org/Georgia_Labor_Commissioner_election,_2026'),
  ('Richard Woods','State School Superintendent',null,null,null,null,'R',true,'https://ballotpedia.org/Georgia_Superintendent_of_Schools_election,_2026'),
  ('Lydia Catalina Powell','State School Superintendent',null,null,null,null,'D',false,'https://ballotpedia.org/Georgia_Superintendent_of_Schools_election,_2026'),
  ('Peter Hubbard','Public Service Commission, District 3',null,null,null,null,'D',true,'https://ballotpedia.org/Georgia_Public_Service_Commission_election,_2026'),
  ('Fitz Johnson','Public Service Commission, District 3',null,null,null,null,'R',false,'https://ballotpedia.org/Georgia_Public_Service_Commission_election,_2026'),
  ('Josh Tolbert','Public Service Commission, District 5',null,null,null,null,'R',false,'https://ballotpedia.org/Georgia_Public_Service_Commission_election,_2026'),
  ('Shelia Edwards','Public Service Commission, District 5',null,null,null,null,'D',false,'https://ballotpedia.org/Georgia_Public_Service_Commission_election,_2026'),
  ('Thomas Blooming','Public Service Commission, District 5',null,null,null,null,'L',false,'https://ballotpedia.org/Georgia_Public_Service_Commission_election,_2026'),
  ('Drew Echols','State Senator','49',null,null,null,'R',true,'https://ballotpedia.org/Georgia_State_Senate_District_49'),
  ('William Wallace','State Senator','49',null,null,null,'D',false,'https://ballotpedia.org/Georgia_State_Senate_District_49'),
  ('Bo Hatchett','State Senator','50',null,null,null,'R',true,'https://ballotpedia.org/Georgia_State_Senate_District_50'),
  ('Dave Cooper','State Senator','50',null,null,null,'D',false,'https://ballotpedia.org/Georgia_State_Senate_District_50'),
  ('Lee Hawkins','State Representative',null,'027',null,null,'R',true,'https://ballotpedia.org/Georgia_House_of_Representatives_District_27'),
  ('Brent Cox','State Representative',null,'028',null,null,'R',true,'https://ballotpedia.org/Brent_Cox'),
  ('Mateo Sanabria','State Representative',null,'028',null,null,'D',false,'https://ballotpedia.org/Mateo_Sanabria'),
  ('Matt Dubnik','State Representative',null,'029',null,null,'R',true,'https://accesswdun.com/news/matt-dubnik-qualifies-to-seek-re-election-for-state-house-district-29'),
  ('Scott Soracco','State Representative',null,'029',null,null,'D',false,'https://nowgeorgia.com/hall-county-democrat-soracco-lays-out-platform-in-house-district-29-race'),
  ('Derrick McCollum','State Representative',null,'030',null,null,'R',true,'https://ballotpedia.org/Derrick_McCollum'),
  ('Conolus Scott Jr.','State Representative',null,'031',null,null,'D',false,'https://www.mainstreetnews.com/jackson/news/general-primary-election-results-jackson-county/article_9adf8bd2-7af0-5061-a7ed-ba9fd0283c72.html'),
  ('Mark Turner','Board of Commissioners, District 1',null,null,'D1',null,'R',false,'https://www.hallcounty.org/DocumentCenter/View/22510'),
  ('Tyler Crawford','Board of Commissioners, District 3',null,null,'D3',null,'R',false,'https://www.hallcounty.org/DocumentCenter/View/22510'),
  ('Gina Pilcher','Board of Commissioners, District 3',null,null,'D3',null,'I',false,'https://www.mainstreetnews.com/braselton/news/turner-ousts-district-1-incumbent-on-hall-boc/article_5d63799c-0a32-4611-aa3e-24bbdb687ffc.html'),
  ('Lee Darragh','District Attorney',null,null,null,null,'R',true,'https://www.gainesvilletimes.com/news/elections/hall-county-da-lee-darragh-wins-election-in-blowout/'),
  ('Inez Grant','Solicitor General',null,null,null,null,'R',true,'https://www.hallcounty.org/DocumentCenter/View/22510'),
  ('Joe Anglin','Board of Education, At-Large',null,null,null,'At-Large','R',false,'https://accessnorthga.com/news/joe-anglin-wins-republican-nomination-nomination-for-hall-co-board-of-education-seat-2'),
  ('Susan Martin Taylor','Board of Education, At-Large',null,null,null,'At-Large','D',false,'https://www.branch.vote/races/2026-georgia-primary-runoff-ga-state-county-school-board-ga-hall-r'),
  ('Brian Gregory Sloan','Board of Education, Post 2',null,null,null,'Post 2','R',true,'https://ballotpedia.org/Brian_Gregory_Sloan_(Hall_County_Schools_school_board_Post_2,_Georgia,_candidate_2026)')
) as v(rep_name, office_name, ssd, shd, ccd, sbd, party, is_incumbent, src)
join public.representatives r on r.name = v.rep_name
join public.contests co on co.election_id = 2 and co.office_name = v.office_name
   and co.state_senate_district is not distinct from v.ssd
   and co.state_house_district is not distinct from v.shd
   and co.county_commission_district is not distinct from v.ccd
   and co.school_board_district is not distinct from v.sbd
where not exists (
  select 1 from public.candidacies x where x.contest_id = co.id and x.rep_id = r.id
);
