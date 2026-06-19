-- migrations/0017_rep_consistency_notes.sql
-- Engagement workstream #4 — the "consistency check" (said-X / did-Y), the core differentiator vs
-- VOTE411/BallotReady. MVP is editorially CURATED (not crowdsourced): each row is two CITED facts
-- that contrast — a stated position vs. a contradicting action/vote/statement — with NO editorializing.
-- Strictly factual + sourced keeps it defensible; the crowdsourced version is a funded-tier item.
-- Public read; writes are seed/admin-only (no client insert policy → RLS denies by default).

create table if not exists public.rep_consistency_notes (
  id                  bigint generated always as identity primary key,
  rep_id              bigint not null references public.representatives(id) on delete cascade,
  claim_text          text not null,        -- what they said / their stated position
  claim_source_url    text,
  claim_date          date,
  contrast_text       text not null,        -- the contradicting action / vote / later statement
  contrast_source_url text,
  contrast_date       date,
  note                text,                 -- optional short, neutral framing
  created_at          timestamptz not null default now()
);
create index if not exists rep_consistency_notes_rep_idx on public.rep_consistency_notes (rep_id);

alter table public.rep_consistency_notes enable row level security;
drop policy if exists rep_consistency_notes_public_read on public.rep_consistency_notes;
create policy rep_consistency_notes_public_read on public.rep_consistency_notes
  for select using (true);
-- No insert/update/delete policy: only the service role (seeds/admin) can write.
