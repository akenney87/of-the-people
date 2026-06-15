-- migrations/0009_rep_sources_public_read.sql
-- rep_sources had RLS enabled with NO policy (deny-all), which blocked anon reads
-- of the citation/evidence content shown on candidate pages. It's public,
-- non-sensitive sourcing data, so add a public read policy. (Caught by the
-- security advisor during the claim-flow work.) Idempotent.
drop policy if exists rep_sources_public_read on public.rep_sources;
create policy rep_sources_public_read on public.rep_sources for select to public using (true);
