-- seeds/05_contests_2026_statewide.sql
-- 2026 GA ballot: statewide + federal (GA-09) contests & candidacies.
-- Sourced 2026-06-11 from Wikipedia 2026 GA race pages + Gainesville Times /
-- Ballotpedia (GA-09). The May 19 primary is decided; Senate & Governor R
-- nominees are pending the June 16 runoff (modeled as primary_runoff contests).
-- Idempotent: people guarded by name, contests by (election_id, office_name,
-- party), candidacies by the unique (contest_id, rep_id).
--
-- Election ids (from seeds/04): 4=May19 primary, 1=Jun16 runoff,
-- 2=Nov3 general, 3=Dec1 general runoff.

-- 1) Challenger people not already in representatives (incumbents already exist).
insert into public.representatives (name, position, party, state, is_statewide)
select v.name, v.position, v.party, v.state, v.is_statewide
from (values
  ('Keisha Lance Bottoms','Former Mayor of Atlanta','D','GA',false),
  ('Rick Jackson','Businessman','R','GA',false),
  ('Derek Dooley','Former college football coach','R','GA',false),
  ('Dana Barrett','Fulton County Commissioner','D','GA',false),
  ('Caitlyn Gegen','U.S. House candidate (GA-09)','D','GA',false)
) as v(name,position,party,state,is_statewide)
where not exists (select 1 from public.representatives r where r.name = v.name);

-- 2) November general contests (election_id 2). Party null = not party-segmented.
insert into public.contests (election_id, office_name, level, is_statewide, cong_district)
select * from (values
  (2,'United States Senate','federal',true ,null),
  (2,'Governor','state',true ,null),
  (2,'Lieutenant Governor','state',true ,null),
  (2,'Secretary of State','state',true ,null),
  (2,'Attorney General','state',true ,null),
  (2,'U.S. House of Representatives','federal',false,'09')
) as v(election_id,office_name,level,is_statewide,cong_district)
where not exists (
  select 1 from public.contests c
  where c.election_id = v.election_id and c.office_name = v.office_name and c.party is null
);

-- 3) June 16 Republican primary runoffs (election_id 1) for the two races where
--    no one cleared 50% on May 19.
insert into public.contests (election_id, office_name, level, is_statewide, party)
select * from (values
  (1,'United States Senate','federal',true,'Republican'),
  (1,'Governor','state',true,'Republican')
) as v(election_id,office_name,level,is_statewide,party)
where not exists (
  select 1 from public.contests c
  where c.election_id = v.election_id and c.office_name = v.office_name and c.party = v.party
);

-- 4) Link each general contest to the runoff that will fill its pending R slot.
update public.contests g
   set parent_contest_id = r.id
  from public.contests r
 where g.election_id = 2 and r.election_id = 1
   and g.office_name = r.office_name
   and g.parent_contest_id is null;

-- 5) Candidacies. Helper lookups by office keep this re-runnable.
--    rep ids resolved by name so the file is self-contained.
insert into public.candidacies (contest_id, rep_id, party, is_incumbent, status, source_url)
select c.id, r.id, x.party, x.is_incumbent, x.status, x.source_url
from (values
  -- US Senate (general): Ossoff (D, incumbent). R slot pending June 16 runoff.
  (2,'United States Senate',null::text,        'Jon Ossoff','D',true ,'qualified','https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_Georgia'),
  -- US Senate (R runoff, June 16)
  (1,'United States Senate','Republican',      'Collins, Mike','R',false,'advanced','https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_Georgia'),
  (1,'United States Senate','Republican',      'Derek Dooley','R',false,'advanced','https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_Georgia'),
  -- Governor (general): Bottoms (D). R slot pending June 16 runoff.
  (2,'Governor',null,                          'Keisha Lance Bottoms','D',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_gubernatorial_election'),
  -- Governor (R runoff, June 16)
  (1,'Governor','Republican',                  'Burt Jones','R',false,'advanced','https://en.wikipedia.org/wiki/2026_Georgia_gubernatorial_election'),
  (1,'Governor','Republican',                  'Rick Jackson','R',false,'advanced','https://en.wikipedia.org/wiki/2026_Georgia_gubernatorial_election'),
  -- Lieutenant Governor (general, open seat)
  (2,'Lieutenant Governor',null,               'Josh McLaurin','D',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_lieutenant_gubernatorial_election'),
  (2,'Lieutenant Governor',null,               'Greg Dolezal','R',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_lieutenant_gubernatorial_election'),
  -- Secretary of State (general, open seat)
  (2,'Secretary of State',null,                'Dana Barrett','D',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_Secretary_of_State_election'),
  (2,'Secretary of State',null,                'Tim Fleming','R',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_Secretary_of_State_election'),
  -- Attorney General (general, open seat)
  (2,'Attorney General',null,                  'Tanya F. Miller','D',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_Attorney_General_election'),
  (2,'Attorney General',null,                  'Brian Strickland','R',false,'qualified','https://en.wikipedia.org/wiki/2026_Georgia_Attorney_General_election'),
  -- U.S. House GA-09 (general): Clyde (R, incumbent) vs Gegen (D)
  (2,'U.S. House of Representatives',null,      'Caitlyn Gegen','D',false,'qualified','https://www.gainesvilletimes.com/news/elections/caitlyn-gegen-wins-democratic-bid-for-us-house-9th-district/'),
  (2,'U.S. House of Representatives',null,      'Clyde, Andrew','R',true ,'qualified','https://ballotpedia.org/Georgia%27s_9th_Congressional_District_election,_2026')
) as x(election_id,office_name,cparty,cand_name,party,is_incumbent,status,source_url)
join public.contests c
  on c.election_id = x.election_id
 and c.office_name = x.office_name
 and c.party is not distinct from x.cparty
join public.representatives r
  on r.name = x.cand_name
on conflict (contest_id, rep_id) do nothing;
