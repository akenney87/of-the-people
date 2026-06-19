-- migrations/0014_email_claim_verification.sql
-- Claim flow Phase 2 — official-email token verification (see CLAIM_FLOW_PLAN.md §"Identity verification").
--
-- Mechanism: a logged-in claimant requests verification → we email a one-time token to the
-- address ALREADY on file (representatives.email) → clicking it (while logged in as the same
-- user) grants the blue check. Safe by construction: completing the claim requires CONTROL of
-- the on-file address, so a wrong/sourced address can never cause a false approval.
--
-- Security model:
--  * We store only the SHA-256 HASH of the token, never the token itself.
--  * Both functions are SECURITY DEFINER and are NOT granted to anon/authenticated — they take
--    p_user_id as a parameter, so granting them to clients would let a client forge identity.
--    Only the edge function (service_role), which derives the real user id from the verified JWT,
--    may call them.
--  * The grant always runs server-side; the client can never set its own ownership (same
--    guarantee as approve_claim()).

-- 1. Token columns on the existing claim table.
alter table public.official_claims
  add column if not exists email_token_hash       text,
  add column if not exists email_sent_to          text,
  add column if not exists email_token_expires_at timestamptz,
  add column if not exists email_verified_at       timestamptz;

-- 2. Request: create/refresh a pending email claim, returning the on-file address to send to.
--    Raises a typed error the edge function maps to a friendly message.
create or replace function public.request_email_claim(
  p_rep_id      bigint,
  p_user_id     uuid,
  p_role        text,
  p_token_hash  text,
  p_ttl_minutes int default 60
) returns table(claim_id bigint, send_to text, rep_name text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text;
  v_name  text;
  v_owner uuid;
  v_id    bigint;
begin
  select email, name, claimed_by_user_id into v_email, v_name, v_owner
    from public.representatives where id = p_rep_id;
  if not found then raise exception 'rep_not_found'; end if;
  if v_owner is not null then raise exception 'already_claimed'; end if;
  if v_email is null or btrim(v_email) = '' then raise exception 'no_email_on_file'; end if;

  -- Reuse an open (pending) claim by this user for this rep if one exists (the partial unique
  -- index official_claims_one_open_per_user_rep guarantees at most one), else insert.
  select id into v_id from public.official_claims
    where rep_id = p_rep_id and user_id = p_user_id and status = 'pending'
    order by submitted_at desc limit 1;

  if v_id is null then
    insert into public.official_claims
      (rep_id, user_id, status, claimant_role, method,
       email_token_hash, email_sent_to, email_token_expires_at, submitted_at)
    values
      (p_rep_id, p_user_id, 'pending', coalesce(p_role, 'official'), 'email',
       p_token_hash, v_email, now() + (p_ttl_minutes * interval '1 minute'), now())
    returning id into v_id;
  else
    update public.official_claims set
      email_token_hash       = p_token_hash,
      email_sent_to          = v_email,
      email_token_expires_at = now() + (p_ttl_minutes * interval '1 minute'),
      method                 = 'email',
      claimant_role          = coalesce(p_role, claimant_role)
    where id = v_id;
  end if;

  return query select v_id, v_email, v_name;
end;
$function$;

-- 3. Verify: validate the token (hash + expiry + same user), then grant ownership atomically.
--    Returns ok=false + a reason rather than raising, so the landing page can show a clean message.
create or replace function public.verify_email_claim(
  p_claim_id   bigint,
  p_user_id    uuid,
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
  if c.user_id <> p_user_id then
    return query select false, c.rep_id, null::text, 'wrong_user'; return;
  end if;
  if c.email_token_hash is null or c.email_token_hash <> p_token_hash then
    return query select false, c.rep_id, null::text, 'bad_token'; return;
  end if;
  if c.email_token_expires_at is null or c.email_token_expires_at < now() then
    return query select false, c.rep_id, null::text, 'expired'; return;
  end if;
  -- Don't grant if the rep was claimed by someone else in the meantime.
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
    email_token_hash       = null,    -- single-use: burn the token
    email_token_expires_at = null
  where id = p_claim_id;

  update public.representatives
    set claimed_by_user_id = c.user_id, claimed_at = now()
  where id = c.rep_id;

  select name into v_name from public.representatives where id = c.rep_id;
  return query select true, c.rep_id, v_name, null::text;
end;
$function$;

-- 4. Lock down execution: only the service role (the edge function) may call these.
revoke all on function public.request_email_claim(bigint, uuid, text, text, int) from public, anon, authenticated;
revoke all on function public.verify_email_claim(bigint, uuid, text)             from public, anon, authenticated;
grant execute on function public.request_email_claim(bigint, uuid, text, text, int) to service_role;
grant execute on function public.verify_email_claim(bigint, uuid, text)             to service_role;
