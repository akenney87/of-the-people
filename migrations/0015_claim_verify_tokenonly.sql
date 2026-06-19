-- migrations/0015_claim_verify_tokenonly.sql
-- Simplify the official-email verification UX (founder principle: "keep the rep's path SIMPLE —
-- one click + email link"). Drop the same-user requirement at click-time: possession of the
-- one-time token (single-use, 60-min, sent ONLY to the on-file address) is sufficient proof, so the
-- link now works from any device/browser, logged in or not. Ownership is granted to the user who
-- REQUESTED the claim (who had to be authenticated to start it). Replaces the 3-arg
-- verify_email_claim(bigint, uuid, text) from migrations/0014 with a 2-arg token-only version.

drop function if exists public.verify_email_claim(bigint, uuid, text);

create or replace function public.verify_email_claim(
  p_claim_id   bigint,
  p_token_hash text
) returns table(ok boolean, rep_id bigint, rep_name text, reason text)
language plpgsql
security definer
set search_path = public
as $function$
declare c public.official_claims%rowtype; v_name text;
begin
  select * into c from public.official_claims where id = p_claim_id;
  if not found then
    return query select false, null::bigint, null::text, 'not_found'; return;
  end if;
  if c.status <> 'pending' then
    return query select false, c.rep_id, null::text,
      case when c.status = 'approved' then 'already_verified' else 'not_pending' end;
    return;
  end if;
  if c.email_token_hash is null or c.email_token_hash <> p_token_hash then
    return query select false, c.rep_id, null::text, 'bad_token'; return;
  end if;
  if c.email_token_expires_at is null or c.email_token_expires_at < now() then
    return query select false, c.rep_id, null::text, 'expired'; return;
  end if;
  -- don't grant if someone else already claimed this rep in the meantime
  if exists (select 1 from public.representatives r
             where r.id = c.rep_id
               and r.claimed_by_user_id is not null
               and r.claimed_by_user_id <> c.user_id) then
    return query select false, c.rep_id, null::text, 'already_claimed'; return;
  end if;

  update public.official_claims set
    status                 = 'approved',
    email_verified_at      = now(),
    reviewed_at            = now(),
    email_token_hash       = null,   -- single-use
    email_token_expires_at = null
  where id = p_claim_id;

  update public.representatives
    set claimed_by_user_id = c.user_id, claimed_at = now()
  where id = c.rep_id;

  select name into v_name from public.representatives where id = c.rep_id;
  return query select true, c.rep_id, v_name, null::text;
end;
$function$;

revoke all on function public.verify_email_claim(bigint, text) from public, anon, authenticated;
grant execute on function public.verify_email_claim(bigint, text) to service_role;
