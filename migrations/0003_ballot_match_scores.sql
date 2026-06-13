-- migrations/0003_ballot_match_scores.sql
-- Adds candidate match scores to the ballot, computed from inferred
-- rep_positions. Applied to remote via MCP 2026-06-11. Self-contained:
-- re-running reproduces both functions exactly.

-- Alignment of the signed-in voter with a candidate, from inferred positions.
-- Weighted by user passion x prediction confidence; 'unclear' skipped; null when
-- there's no overlap between the voter's answers and the candidate's positions.
create or replace function public.get_my_ballot_alignment(p_rep_id bigint)
returns numeric
language sql
stable
set search_path to 'public'
as $function$
  with j as (
    select v.vote as uvote,
           v.passion_weight * coalesce(rp.confidence, 0.5) as w,
           (rp.predicted_vote = 'yes') as pred
    from public.votes v
    join public.rep_positions rp on rp.issue_id = v.issue_id
    where v.user_id = auth.uid()
      and rp.rep_id = p_rep_id
      and rp.predicted_vote in ('yes','no')
  )
  select case when sum(w) > 0
              then round(sum(case when uvote = pred then w else 0 end) / sum(w) * 100, 0)
              else null end
  from j;
$function$;

-- Recreate get_my_ballot with a match_score column (return shape changes, so
-- drop first). Body matches migrations/0002 plus the match_score select expr.
drop function if exists public.get_my_ballot(bigint);

create function public.get_my_ballot(p_election_id bigint default null)
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
    public.get_my_ballot_alignment(r.id) as match_score
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
grant execute on function public.get_my_ballot_alignment(bigint) to authenticated, anon;
