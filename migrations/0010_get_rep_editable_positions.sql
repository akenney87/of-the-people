-- migrations/0010_get_rep_editable_positions.sql
-- Powers the official edit mode (claim flow). Returns EVERY in-scope issue for a
-- rep — at their office level and all broader scopes (national > state > county >
-- city) — left-joined with their current position, so a claiming official can
-- confirm/correct existing answers AND fill in ones with no row yet. Read-only;
-- runs as invoker under the existing public-read policies.
create or replace function public.get_rep_editable_positions(p_rep_id bigint)
returns table (
  issue_id             integer,
  issue_text           text,
  scope                text,
  predicted_vote       text,
  stance_strength      smallint,
  verified_by_official boolean
)
language sql
stable
set search_path to 'public'
as $function$
  with r as (
    select * from public.representatives where id = p_rep_id
  ),
  scopes as (
    select case
      when (select city_council_district from r) is not null
        or (select position from r) ilike any (array['%council%','%mayor%','%city%'])
        then array['national','state','county','city']
      when (select county_commission_district from r) is not null
        or (select position from r) ilike any (array['%county%','%sheriff%','%commission%'])
        then array['national','state','county']
      when (select state_senate_district from r) is not null
        or (select state_assembly_district from r) is not null
        or (select position from r) ilike 'state %'
        then array['national','state']
      else array['national']
    end as allowed
  )
  select i.id, i.text, i.scope, rp.predicted_vote, rp.stance_strength,
         coalesce(rp.verified_by_official, false)
  from public.issues i
  cross join scopes s
  left join public.rep_positions rp on rp.issue_id = i.id and rp.rep_id = p_rep_id
  where i.scope = any (s.allowed)
  order by case i.scope when 'national' then 1 when 'state' then 2 when 'county' then 3 else 4 end, i.id;
$function$;

grant execute on function public.get_rep_editable_positions(bigint) to authenticated;
