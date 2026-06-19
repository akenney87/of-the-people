-- seeds/21_ballot_reconciliation.sql
-- Post-runoff ballot reconciliation (GA 2026 June-16 runoffs verified 2026-06-19, multi-source).
-- See project memory "VERIFIED GA-2026 RESULTS". get_my_ballot filters to election_date >= today
-- (so primary/runoff contests already auto-hide) and does NOT filter candidacy status, so the
-- November GENERAL contests must contain exactly the real nominees.
--
-- STEP A (this file): promote the verified GOP runoff WINNERS into their general contests and
-- record runoff outcomes. Losers keep their representatives rows (Jones = sitting Lt. Gov; Dooley
-- a real candidate) but are marked 'lost' in the runoff contest (which is past-dated and hidden).
-- Idempotent.

-- Governor general (contest 2) — add R nominee Rick Jackson (rep 281). Ballot -> Bottoms (D) vs Jackson (R).
insert into public.candidacies (contest_id, rep_id, party, is_incumbent, status, source_url)
values (2, 281, 'R', false, 'qualified',
        'https://www.ajc.com/politics/2026/06/rick-jackson-topples-burt-jones-wins-gop-nod-for-governor/')
on conflict (contest_id, rep_id) do nothing;

-- U.S. Senate general (contest 1) — add R nominee Mike Collins (rep 21). Ballot -> Ossoff (D) vs Collins (R).
insert into public.candidacies (contest_id, rep_id, party, is_incumbent, status, source_url)
values (1, 21, 'R', false, 'qualified',
        'https://www.cbsnews.com/news/georgia-senate-republican-runoff-primary-results-mike-collins-derek-dooley-trump-ossoff/')
on conflict (contest_id, rep_id) do nothing;

-- Record runoff outcomes (Gov runoff contest 8 / Senate runoff contest 7).
update public.candidacies set status = 'won'  where id = 11;  -- Rick Jackson (Gov R runoff)
update public.candidacies set status = 'lost' where id = 12;  -- Burt Jones  (Gov R runoff)
update public.candidacies set status = 'won'  where id = 10;  -- Mike Collins (Sen R runoff)
update public.candidacies set status = 'lost' where id = 9;   -- Derek Dooley (Sen R runoff)


-- STEP B: Secretary of State — fix the wrong Dem nominee. DB had Dana Barrett (rep 278), but she
-- LOST the June-16 Dem runoff to Penny Brown Reynolds (verified, Atlanta News First 2026-06-17).
-- Reynolds wasn't in the roster. Add her + her candidacy; remove Barrett's stale general candidacy
-- (Barrett's representatives row is kept — she's a real Fulton County commissioner). Idempotent.
insert into public.representatives (name, party, position, state, is_statewide, website)
select 'Penny Brown Reynolds','D','Former Fulton County State Court Judge','GA',false,'https://www.pennyforgeorgia.com'
where not exists (select 1 from public.representatives where name='Penny Brown Reynolds');

insert into public.candidacies (contest_id, rep_id, party, is_incumbent, status, source_url)
select 4, r.id, 'D', false, 'qualified',
       'https://www.atlantanewsfirst.com/2026/06/17/penny-brown-reynolds-wins-democratic-secretary-state-runoff/'
from public.representatives r where r.name='Penny Brown Reynolds'
on conflict (contest_id, rep_id) do nothing;

delete from public.candidacies where contest_id=4 and rep_id=278;  -- Barrett out of SoS general

-- STEP C: verified statewide slate. The OTHER 7 statewide races (Lt Gov, AG, PSC D3, PSC D5, Ag,
-- Insurance, Labor, School Super) were independently verified 2026-06-19 and the NOMINEES ARE
-- CORRECT — no candidate swaps needed. Only two verified spelling fixes:
update public.representatives set name='Bárbara Rivera Holmes' where id=286 and name='Barbara Rivera Holmes'; -- Labor R incumbent (accent)
update public.representatives set name='Lydia Powell'          where id=293 and name='Lydia Catalina Powell'; -- School Super D ("Catalina" unverified in any source -> drop)
-- Flagged, NOT changed (low priority): Insurance has a Libertarian (Colin McKinney) not yet in the
-- roster; PSC D3 incumbent is Hubbard (D, won Nov-2025 special) — DB is_incumbent already correct.
