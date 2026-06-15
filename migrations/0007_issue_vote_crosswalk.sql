-- migrations/0007_issue_vote_crosswalk.sql
-- The reusable issue -> vote evidence map (see inference/VOTE_CROSSWALK_PLAN.md).
-- Built ONCE (curated + adversarially verified), then a cheap applier maps any
-- member's Yea/Nay through `yea_means` to produce rep_positions. Direction mapping
-- (`yea_means`) is the integrity-critical field.

create table if not exists public.issue_vote_crosswalk (
  id              bigint generated always as identity primary key,
  issue_id        integer not null references public.issues(id),
  congress        integer not null,                                   -- e.g. 119
  chamber         text not null check (chamber in ('house','senate')),
  measure         text not null,                                      -- bill / roll-call id
  measure_url     text,
  description     text,
  yea_means       text not null check (yea_means in ('yes','no')),    -- a YEA => this answer on the issue AS FRAMED
  evidence_kind   text not null default 'roll_call'
                    check (evidence_kind in ('roll_call','sponsorship')),
  base_strength   smallint check (base_strength between 1 and 5),
  base_confidence numeric check (base_confidence >= 0 and base_confidence <= 1),
  verified        boolean not null default false,                     -- direction passed adversarial review
  notes           text,
  created_at      timestamptz not null default now(),
  unique (issue_id, congress, chamber, measure)
);
