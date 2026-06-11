-- migrations/0004_alignment_scale_fix.sql
-- Corrects alignment scoring to the intended 1-10 model and adds the per-
-- candidate intensity it needs. Applied to remote via MCP 2026-06-11.
--
-- Position score on a 1-10 scale:
--   support + passion p  ->  5 + p   (p1 = 6  .. p5 = 10)
--   oppose  + passion p  ->  6 - p   (p1 = 5  .. p5 = 1)
-- Per-issue closeness = 1 - |user_score - rep_score| / 9   (0..1).
-- Overall % = passion-weighted average of closeness * 100.
-- A perfect 100% requires same DIRECTION *and* same INTENSITY on every scored
-- issue, so it is rare by design.
--
-- Bug fixed: the prior opposition mapping (0 + passion) was inverted — it scored
-- a passion-5 opponent as 5 (near neutral) and a passion-1 opponent as 1
-- (extreme). Now oppose = 6 - passion.

-- Candidate's own intensity on a position (their analog of a voter's passion),
-- inferred issue-by-issue from evidence. NULL when the stance is 'unclear'.
alter table public.rep_positions
  add column if not exists stance_strength smallint
    check (stance_strength between 1 and 5);

-- Ballot alignment: voter vs candidate, from inferred rep_positions. 'unclear'
-- and strength-less rows are excluded (no guessing).
create or replace function public.get_my_ballot_alignment(p_rep_id bigint)
returns numeric
language sql
stable
set search_path to 'public'
as $function$
  with j as (
    select
      case when v.vote then 5 + v.passion_weight else 6 - v.passion_weight end as user_s,
      case when rp.predicted_vote = 'yes' then 5 + rp.stance_strength
           else 6 - rp.stance_strength end as rep_s,
      v.passion_weight as w
    from public.votes v
    join public.rep_positions rp on rp.issue_id = v.issue_id
    where v.user_id = auth.uid()
      and rp.rep_id = p_rep_id
      and rp.predicted_vote in ('yes','no')
      and rp.stance_strength is not null
  )
  select case when sum(w) > 0
              then round(sum((1 - abs(user_s - rep_s) / 9.0) * w) / sum(w) * 100, 0)
              else null end
  from j;
$function$;

-- Officeholder alignment: voter vs a rep's recorded votes. Same corrected model;
-- both sides carry a real passion weight.
create or replace function public.get_my_alignment(p_rep_id bigint)
returns numeric
language sql
stable
set search_path to 'public'
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
              then round(sum((1 - abs(user_s - rep_s) / 9.0) * w) / sum(w) * 100, 0)
              else null end
  from j;
$function$;
