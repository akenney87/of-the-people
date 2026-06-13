-- seeds/07_clyde_congress_sources.sql
-- Andrew Clyde's (rep 20) legislative record as evidence, pulled from the
-- Congress.gov API (member C001116) 2026-06-12. These bills ground his inferred
-- positions in actual sponsorship/cosponsorship — actions, not website copy.
-- See inference/SOURCING_CHECKLIST.md (tier 1). Idempotent on (rep_id, url).

insert into public.rep_sources (rep_id, source_type, url, title, content, content_hash)
select 20, 'bill_cosponsorship', v.url, v.title, v.content, md5(v.content)
from (values
  ('https://www.congress.gov/bill/119th-congress/house-bill/2395','SHORT Act','Rep. Andrew Clyde sponsored H.R.2395, the SHORT Act (deregulating short-barreled rifles).'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/6035','Second Amendment Restoration Act of 2025','Rep. Andrew Clyde cosponsored H.R.6035, the Second Amendment Restoration Act of 2025.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/73','Abortion Is Not Health Care Act of 2025','Rep. Andrew Clyde cosponsored H.R.73, the Abortion Is Not Health Care Act of 2025.'),
  ('https://www.congress.gov/bill/119th-congress/house-resolution/56','Memorializing the unborn','Rep. Andrew Clyde sponsored H.Res.56, memorializing the unborn by lowering the flag to half-staff each January 22.'),
  ('https://www.congress.gov/bill/119th-congress/house-joint-resolution/11','Balanced Budget Amendment','Rep. Andrew Clyde cosponsored H.J.Res.11, a proposed balanced budget amendment to the Constitution.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/899','To terminate the Department of Education','Rep. Andrew Clyde cosponsored H.R.899, to terminate the Department of Education.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/6512','Putting Patients First Healthcare Freedom Act','Rep. Andrew Clyde cosponsored H.R.6512, the Putting Patients First Healthcare Freedom Act.'),
  ('https://www.congress.gov/bill/118th-congress/house-bill/10299','Medicaid Funds Integrity Act of 2024','Rep. Andrew Clyde sponsored H.R.10299, the Medicaid Funds Integrity Act of 2024.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/4117','Fuel Emissions Freedom Act','Rep. Andrew Clyde cosponsored H.R.4117, the Fuel Emissions Freedom Act.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/6057','Criminal Alien Removal Clarification Act of 2025','Rep. Andrew Clyde cosponsored H.R.6057, the Criminal Alien Removal Clarification Act of 2025.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/7817','No Federal Tax Dollars for Illegal Aliens Health Insurance Act of 2026','Rep. Andrew Clyde cosponsored H.R.7817, the No Federal Tax Dollars for Illegal Aliens Health Insurance Act.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/5107','Common-Sense Law Enforcement and Accountability Now in DC Act of 2025','Rep. Andrew Clyde sponsored H.R.5107, the Common-Sense Law Enforcement and Accountability Now in DC Act.'),
  ('https://www.congress.gov/bill/118th-congress/house-bill/6046','Standing Against Houthi Aggression Act','Rep. Andrew Clyde sponsored H.R.6046, the Standing Against Houthi Aggression Act.'),
  ('https://www.congress.gov/bill/119th-congress/house-bill/7651','Chloe Cole Act of 2026','Rep. Andrew Clyde cosponsored H.R.7651, the Chloe Cole Act of 2026 (restricting gender-transition procedures).')
) as v(url, title, content)
where not exists (select 1 from public.rep_sources rs where rs.rep_id = 20 and rs.url = v.url);
