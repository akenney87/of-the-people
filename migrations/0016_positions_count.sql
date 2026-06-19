-- migrations/0016_positions_count.sql
-- Engagement workstream #1 (graceful empty states). The list views can't tell apart the two
-- reasons a match shows "—": (a) we have NO positions on that person (uncovered → claim/accountability
-- moment) vs (b) we DO, but the viewer hasn't answered overlapping issues yet (vote-more moment).
-- This adds a per-rep count of CLEAR positions (predicted_vote in yes/no) so the client can branch:
--   positions_count = 0  -> "Not yet scored" (no data)
--   positions_count > 0 and match_score is null -> "—" (you haven't voted on overlapping issues)
--
-- get_my_ballot gains a positions_count column; get_rep_position_counts() is a one-call bulk lookup
-- for the representatives list (get_my_representatives stays SETOF representatives, untouched).

-- Bulk count for the reps list (one round-trip for all matched reps).
create or replace function public.get_rep_position_counts(p_rep_ids bigint[])
returns table(rep_id bigint, cnt integer)
language sql
stable
set search_path to 'public'
as $function$
  select rp.rep_id, count(*)::int
  from public.rep_positions rp
  where rp.rep_id = any(p_rep_ids)
    and rp.predicted_vote in ('yes','no')
  group by rp.rep_id;
$function$;
grant execute on function public.get_rep_position_counts(bigint[]) to authenticated, anon;

-- Recreate get_my_ballot adding positions_count (unchanged from 0013 except the new column).
-- DROP first: adding a column changes the OUT-parameter row type, which CREATE OR REPLACE can't do.
drop function if exists public.get_my_ballot(bigint);
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
  match_score        numeric,
  positions_count    integer
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
    public.get_my_ballot_alignment(r.id),
    (select count(*)::int from public.rep_positions rp
       where rp.rep_id = r.id and rp.predicted_vote in ('yes','no'))
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
