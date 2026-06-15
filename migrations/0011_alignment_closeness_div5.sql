-- migrations/0011_alignment_closeness_div5.sql
-- Steeper per-issue closeness (founder decision 2026-06-14): a gap of >= 5 on the
-- 1-10 position scale is a 0% match on that issue, scaling 100/80/60/40/20/0 for
-- gaps 0-5 (smooth, no cliff). Replaces the previous /9 curve. Effect is
-- intentionally harsher — same-side-but-different-intensity is punished (e.g.,
-- you 10 / rep 6 = gap 4 = 20%). Applied to all three closeness call sites so the
-- displayed per-issue match and the overall scores stay consistent.
--   closeness = greatest(0, 1 - |user_s - rep_s| / 5.0)

-- Ballot alignment (inferred rep_positions; Option B confidence weighting retained).
create or replace function public.get_my_ballot_alignment(p_rep_id bigint)
returns numeric language sql stable set search_path to 'public'
as $function$
  with j as (
    select
      case when v.vote then 5 + v.passion_weight else 6 - v.passion_weight end as user_s,
      case when rp.predicted_vote = 'yes' then 5 + rp.stance_strength
           else 6 - rp.stance_strength end as rep_s,
      v.passion_weight * rp.confidence as w
    from public.votes v
    join public.rep_positions rp on rp.issue_id = v.issue_id
    where v.user_id = auth.uid()
      and rp.rep_id = p_rep_id
      and rp.predicted_vote in ('yes','no')
      and rp.stance_strength is not null
      and rp.confidence is not null
      and rp.confidence >= 0.3
  )
  select case when sum(w) > 0
              then round(sum(greatest(0, 1 - abs(user_s - rep_s) / 5.0) * w) / sum(w) * 100, 0)
              else null end
  from j;
$function$;

-- Officeholder alignment (recorded representative_votes).
create or replace function public.get_my_alignment(p_rep_id bigint)
returns numeric language sql stable set search_path to 'public'
as $function$
  with j as (
    select
      case when u.vote then 5 + u.passion_weight else 6 - u.passion_weight end as user_s,
      case when rv.vote then 5 + rv.passion_weight else 6 - rv.passion_weight end as rep_s,
      u.passion_weight as w
    from public.votes u
    join public.representative_votes rv on rv.issue_id = u.issue_id
    where u.user_id = auth.uid() and rv.rep_id = p_rep_id
  )
  select case when sum(w) > 0
              then round(sum(greatest(0, 1 - abs(user_s - rep_s) / 5.0) * w) / sum(w) * 100, 0)
              else null end
  from j;
$function$;

-- Per-issue breakdown (issue_match shown on the candidate page).
create or replace function public.get_rep_positions(p_rep_id bigint)
returns table (
  issue_id integer, issue_text text, scope text, predicted_vote text,
  stance_strength smallint, confidence numeric, supporting_quote text,
  source_url text, verified_by_official boolean, user_vote boolean,
  user_passion integer, issue_match numeric
)
language sql stable set search_path to 'public'
as $function$
  select
    rp.issue_id, i.text, i.scope, rp.predicted_vote, rp.stance_strength,
    rp.confidence, rp.supporting_quote, rp.source_url, rp.verified_by_official,
    v.vote, v.passion_weight,
    case
      when rp.predicted_vote in ('yes','no') and rp.stance_strength is not null and v.vote is not null
      then round(greatest(0, 1 - abs(
             (case when v.vote then 5 + v.passion_weight else 6 - v.passion_weight end)
           - (case when rp.predicted_vote = 'yes' then 5 + rp.stance_strength else 6 - rp.stance_strength end)
           ) / 5.0) * 100)
      else null
    end as issue_match
  from public.rep_positions rp
  join public.issues i on i.id = rp.issue_id
  left join public.votes v on v.issue_id = rp.issue_id and v.user_id = auth.uid()
  where rp.rep_id = p_rep_id
  order by (v.vote is null), i.id;
$function$;

grant execute on function public.get_rep_positions(bigint) to authenticated, anon;
