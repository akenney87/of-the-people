-- migrations/0013_ballot_match_score.sql
-- Wire ballot scores to the inferred data. get_my_ballot now returns a match_score
-- per candidate, computed by get_my_ballot_alignment (rep_positions, Option B + /5
-- closeness) — the same source the candidate page already uses. Ballot.jsx already
-- reads c.match_score, so no client change needed for the ballot. Unifies both
-- lists on rep_positions (the empty representative_votes path is retired in the
-- client). Adds match_score as the final column; everything else is unchanged from 0002.
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
  source_url         text,
  match_score        numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    e.id, e.name, e.election_date, e.type, e.is_partisan,
    c.id, c.office_name, c.level, c.party, c.is_statewide, c.seats, c.parent_contest_id,
    ca.id, r.id, r.name, ca.party, ca.is_incumbent, ca.status, ca.ballot_order,
    r.photo_url, r.website, ca.source_url,
    public.get_my_ballot_alignment(r.id)
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
