-- migrations/0006_option_b_confidence_weight.sql
-- Option B (chosen 2026-06): candidate confidence becomes a SCORING WEIGHT, not
-- display-only. Each scored issue's weight = voter passion × candidate confidence,
-- so a weak (but cited) inference can only nudge the match, never dominate — and
-- the arbitrary 0.5 include/exclude cliff is replaced by a smooth weight plus a
-- low floor. Tiered display (confirmed/likely/unknown) is a client concern; this
-- function just needs confidence present and above the floor.
--
-- Only get_my_ballot_alignment (INFERRED rep_positions) changes. get_my_alignment
-- (recorded representative_votes) is unchanged — recorded votes are facts, not
-- inferences, so they carry no confidence weight.

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
      -- Option B: voter passion × candidate confidence
      v.passion_weight * rp.confidence as w
    from public.votes v
    join public.rep_positions rp on rp.issue_id = v.issue_id
    where v.user_id = auth.uid()
      and rp.rep_id = p_rep_id
      and rp.predicted_vote in ('yes','no')
      and rp.stance_strength is not null
      and rp.confidence is not null
      and rp.confidence >= 0.3   -- floor: below this stays 'likely'/unclear, excluded from score
  )
  select case when sum(w) > 0
              then round(sum((1 - abs(user_s - rep_s) / 9.0) * w) / sum(w) * 100, 0)
              else null end
  from j;
$function$;
