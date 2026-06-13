-- migrations/0002_get_my_ballot.sql
-- The "pull what Vote411 pulls" RPC. Returns the contests on the signed-in
-- user's ballot (matched by district, same logic as get_my_representatives)
-- with every candidate per contest. One row per candidacy; the client groups
-- by election then contest.
--   p_election_id null -> all UPCOMING elections (election_date >= today)
--   p_election_id set  -> just that election (any date)
-- Applied to remote via MCP 2026-06-11.

create or replace function public.get_my_ballot(p_election_id bigint default null)
returns table (
  election_id        bigint,
  election_name      text,
  election_date      date,
  election_type      text,
  is_partisan        boolean,
  contest_id         bigint,
  office_name        text,
  level              text,
  contest_party      text,
  is_statewide       boolean,
  seats              integer,
  parent_contest_id  bigint,
  candidacy_id       bigint,
  rep_id             bigint,
  candidate_name     text,
  candidate_party    text,
  is_incumbent       boolean,
  status             text,
  ballot_order       integer,
  photo_url          text,
  website            text,
  source_url         text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    e.id, e.name, e.election_date, e.type, e.is_partisan,
    c.id, c.office_name, c.level, c.party, c.is_statewide, c.seats, c.parent_contest_id,
    ca.id, r.id, r.name, ca.party, ca.is_incumbent, ca.status, ca.ballot_order,
    r.photo_url, r.website, ca.source_url
  from public.contests c
  join public.elections e       on e.id = c.election_id
  join public.candidacies ca    on ca.contest_id = c.id
  join public.representatives r on r.id = ca.rep_id
  cross join public.users u
  where u.id = auth.uid()
    and u.state is not null
    and (p_election_id is not null or e.election_date >= current_date)
    and (p_election_id is null or e.id = p_election_id)
    and (
         (c.is_statewide and e.state = u.state)
      or (c.cong_district is not null and c.cong_district = u.cong_district)
      or (c.state_senate_district is not null and c.state_senate_district = u.state_senate_dist)
      or (c.state_house_district  is not null and c.state_house_district  = u.state_house_dist)
      or (c.county is not null
          and (c.county = u.county
            or c.county = replace(u.county,'St.','Saint')
            or c.county = replace(u.county,'Saint','St.'))
          and (c.county_commission_district is null
            or c.county_commission_district = u.county_commission_dist)
          and (c.school_board_district is null
            or c.school_board_district = u.school_board_dist))
      or (c.city is not null and c.city = u.city
          and (c.city_council_district is null
            or c.city_council_district = u.city_council_dist))
    )
  order by e.election_date, c.office_name, ca.party desc nulls last, r.name;
$function$;

grant execute on function public.get_my_ballot(bigint) to authenticated, anon;
