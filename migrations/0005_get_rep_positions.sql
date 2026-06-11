-- migrations/0005_get_rep_positions.sql
-- Per-issue position breakdown for a candidate, joined with the signed-in
-- voter's own answer and the per-issue match (same 1-10 model as the alignment
-- functions). Powers the "Where they stand" section of the candidate page.
-- Issues the voter has answered sort first. Applied to remote via MCP 2026-06-11.
create or replace function public.get_rep_positions(p_rep_id bigint)
returns table (
  issue_id             integer,
  issue_text           text,
  scope                text,
  predicted_vote       text,
  stance_strength      smallint,
  confidence           numeric,
  supporting_quote     text,
  source_url           text,
  verified_by_official boolean,
  user_vote            boolean,
  user_passion         integer,
  issue_match          numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    rp.issue_id, i.text, i.scope, rp.predicted_vote, rp.stance_strength,
    rp.confidence, rp.supporting_quote, rp.source_url, rp.verified_by_official,
    v.vote, v.passion_weight,
    case
      when rp.predicted_vote in ('yes','no') and rp.stance_strength is not null and v.vote is not null
      then round((1 - abs(
             (case when v.vote then 5 + v.passion_weight else 6 - v.passion_weight end)
           - (case when rp.predicted_vote = 'yes' then 5 + rp.stance_strength else 6 - rp.stance_strength end)
           ) / 9.0) * 100)
      else null
    end as issue_match
  from public.rep_positions rp
  join public.issues i on i.id = rp.issue_id
  left join public.votes v on v.issue_id = rp.issue_id and v.user_id = auth.uid()
  where rp.rep_id = p_rep_id
  order by (v.vote is null), i.id;
$function$;

grant execute on function public.get_rep_positions(bigint) to authenticated, anon;
