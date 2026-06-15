-- migrations/0012_issues_perishable.sql
-- Adds the `perishable` flag to issues — marks time-bound questions (e.g. ones that
-- name the current $7.25 federal minimum wage, or "keep the current law") for
-- cyclic WORDING review, distinct from `needs_review` (which flags a fact to verify).
-- Which issues are perishable is data: shared/issues.json -> seeds/00_issues.sql.
-- See shared/ISSUE_WORDING_RUBRIC.md. Idempotent.
alter table public.issues add column if not exists perishable boolean not null default false;
