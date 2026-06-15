-- migrations/0008_claim_flow.sql
-- Claim flow ("blue check") foundation — see CLAIM_FLOW_PLAN.md.
-- Shared by BOTH approval paths (email-token auto-verify [Phase 2] and manual review):
-- the grant always runs server-side via approve_claim(); the client can never grant
-- itself ownership. Claim ownership is rep-level (representatives.claimed_by_user_id),
-- which also lets an owner answer issues that have no seeded rep_positions row yet.

-- 1. Admin flag (gates manual approval + admin review visibility).
alter table public.users add column if not exists is_admin boolean not null default false;
update public.users set is_admin = true
  where id in (select id from auth.users where lower(email) = 'alexanderkenney@gmail.com');

-- 2. Rep-level claim ownership.
alter table public.representatives
  add column if not exists claimed_by_user_id uuid references auth.users(id),
  add column if not exists claimed_at timestamptz;

-- 3. Claim requests.
create table if not exists public.official_claims (
  id            bigint generated always as identity primary key,
  rep_id        bigint not null references public.representatives(id),
  user_id       uuid   not null references auth.users(id),
  status        text   not null default 'pending' check (status in ('pending','approved','rejected')),
  claimant_role text   check (claimant_role in ('official','staff','candidate','campaign')),
  method        text   not null default 'manual' check (method in ('manual','email')),
  evidence_url  text,
  note          text,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id)
);
-- at most one approved claim per rep; one open claim per (rep,user)
create unique index if not exists official_claims_one_approved_per_rep
  on public.official_claims (rep_id) where status = 'approved';
create unique index if not exists official_claims_one_open_per_user_rep
  on public.official_claims (rep_id, user_id) where status in ('pending','approved');

alter table public.official_claims enable row level security;
drop policy if exists claims_insert_own on public.official_claims;
create policy claims_insert_own on public.official_claims for insert to public
  with check (user_id = auth.uid());
drop policy if exists claims_select_own on public.official_claims;
create policy claims_select_own on public.official_claims for select to public
  using (user_id = auth.uid() or coalesce((select is_admin from public.users where id = auth.uid()), false));
-- no client UPDATE/DELETE: status changes only via approve_claim()/email edge fn (server-side).

-- 4. Server-side grant (manual path). SECURITY DEFINER, gated to admins.
create or replace function public.approve_claim(p_claim_id bigint, p_approve boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare c public.official_claims%rowtype;
begin
  if not coalesce((select is_admin from public.users where id = auth.uid()), false) then
    raise exception 'not authorized';
  end if;
  select * into c from public.official_claims where id = p_claim_id;
  if not found then raise exception 'claim % not found', p_claim_id; end if;
  if p_approve then
    update public.official_claims set status='approved', reviewed_at=now(), reviewed_by=auth.uid() where id=p_claim_id;
    update public.representatives set claimed_by_user_id=c.user_id, claimed_at=now() where id=c.rep_id;
  else
    update public.official_claims set status='rejected', reviewed_at=now(), reviewed_by=auth.uid() where id=p_claim_id;
  end if;
end;
$function$;
revoke all on function public.approve_claim(bigint, boolean) from public, anon;
grant execute on function public.approve_claim(bigint, boolean) to authenticated;

-- 5. Rep-level edit/insert for the claiming official (replaces the per-row owner policy).
drop policy if exists rep_positions_owner_update on public.rep_positions;
create policy rep_positions_owner_update on public.rep_positions for update to public
  using (exists (select 1 from public.representatives r where r.id = rep_positions.rep_id and r.claimed_by_user_id = auth.uid()))
  with check (exists (select 1 from public.representatives r where r.id = rep_positions.rep_id and r.claimed_by_user_id = auth.uid()));
drop policy if exists rep_positions_owner_insert on public.rep_positions;
create policy rep_positions_owner_insert on public.rep_positions for insert to public
  with check (exists (select 1 from public.representatives r where r.id = rep_positions.rep_id and r.claimed_by_user_id = auth.uid()));
