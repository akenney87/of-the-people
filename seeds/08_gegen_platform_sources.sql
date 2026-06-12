-- seeds/08_gegen_platform_sources.sql
-- Caitlyn Gegen (rep 279) — challenger, no voting record, so her evidence comes
-- from platform coverage + profiles (SOURCING_CHECKLIST tiers 2-3/5). Stored as
-- 'other'. Her own campaign site (caitlynforgeorgia.com) and the Vote411 /
-- Main Street News questionnaires hold more, but are JS/anti-bot/rate-limited
-- (429/403) and not reliably fetchable yet — a funded-tier (browser automation /
-- paid data) gap. Idempotent on (rep_id, url).

insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash)
select 279, 'other', v.url, v.title, v.content, md5(v.content)
from (values
  ('https://nowgeorgia.com/gegen-pitches-progressive-platform-systemic-change-in-9th-district-race/','Gegen pitches progressive platform (Now Georgia)','Caitlyn Gegen platform coverage: universal healthcare, $15 minimum wage, clean energy, breaking up corporate monopolies, overturning Dobbs, gun training/background checks.'),
  ('https://www.jejunemagazine.com/home/caitlyn-gegen-georgias-9th-congressional-district','Caitlyn Gegen profile (Jejune Magazine)','Caitlyn Gegen profile with direct quotes on immigration (abolish ICE, fund immigration courts; views immigration as a human-rights and economics concern) and support for criminal justice reform.')
) as v(url, title, content)
where not exists (select 1 from public.rep_sources rs where rs.rep_id = 279 and rs.url = v.url);
