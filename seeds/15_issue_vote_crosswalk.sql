-- seeds/15_issue_vote_crosswalk.sql
-- Issue->vote crosswalk (national), curated from build run wf_e3aa8c22-7d4.
-- SUPERVISED: stored keyed by BILL (not roll-call number — agents guess RC#s wrong;
-- the Phase B applier resolves the actual final-passage vote / cosponsorship from the
-- bill via the Congress.gov API). Direction (yea_means) is verifier-confirmed + human-
-- reviewed. Dropped weak/wrong proxies: 115 (Parents Bill of Rights disclaims book
-- removal), 121 (vaccine proxies tangential), 137 (Freedom to Vote != independent
-- commission), 103 Jackson amdt (stripped in conference). Relabeled 102 H.R.8->H.R.715.
-- Idempotent.

insert into public.issue_vote_crosswalk
  (issue_id, congress, chamber, measure, measure_url, description, yea_means, evidence_kind, base_strength, base_confidence, verified)
values
  (101, 118, 'house', 'H.R.11', 'https://www.congress.gov/bill/118th-congress/house-bill/11', 'Freedom to Vote Act', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (102, 118, 'house', 'H.J.Res.44', 'https://www.congress.gov/bill/118th-congress/house-joint-resolution/44', 'ATF pistol-brace rule disapproval', 'no', 'roll_call', 3::smallint, 0.85, true),
  (102, 118, 'house', 'H.R.715', 'https://www.congress.gov/bill/118th-congress/house-bill/715', 'Bipartisan Background Checks Act of 2023', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (103, 118, 'house', 'H.R.26', 'https://www.congress.gov/bill/118th-congress/house-bill/26', 'Born-Alive Abortion Survivors Protection Act', 'no', 'roll_call', 4::smallint, 0.85, true),
  (104, 119, 'house', 'H.R.1', 'https://www.congress.gov/bill/119th-congress/house-bill/1', 'One Big Beautiful Bill Act', 'no', 'roll_call', 5::smallint, 0.88, true),
  (105, 119, 'house', 'H.R.1', 'https://www.congress.gov/bill/119th-congress/house-bill/1', 'One Big Beautiful Bill Act', 'no', 'roll_call', 5::smallint, 0.88, true),
  (106, 119, 'house', 'H.R.1', 'https://www.congress.gov/bill/119th-congress/house-bill/1', 'One Big Beautiful Bill Act', 'no', 'roll_call', 4::smallint, 0.85, true),
  (107, 118, 'house', 'H.R.1', 'https://www.congress.gov/bill/118th-congress/house-bill/1', 'Lower Energy Costs Act', 'no', 'roll_call', 4::smallint, 0.85, true),
  (108, 119, 'house', 'H.R.29', 'https://www.congress.gov/bill/119th-congress/house-bill/29', 'Laken Riley Act', 'no', 'roll_call', 3::smallint, 0.6, true),
  (108, 118, 'house', 'H.R.16', 'https://www.congress.gov/bill/118th-congress/house-bill/16', 'American Dream and Promise Act of 2023', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (109, 119, 'house', 'H.R.27', 'https://www.congress.gov/bill/119th-congress/house-bill/27', null, 'no', 'roll_call', 4::smallint, 0.85, true),
  (110, 118, 'house', 'H.Con.Res.21', 'https://www.congress.gov/bill/118th-congress/house-concurrent-resolution/21', null, 'yes', 'roll_call', 4::smallint, 0.82, true),
  (111, 118, 'house', 'H.R.734', 'https://www.congress.gov/bill/118th-congress/house-bill/734', null, 'no', 'roll_call', 5::smallint, 0.9, true),
  (112, 117, 'house', 'H.R.8404', 'https://www.congress.gov/bill/117th-congress/house-bill/8404', 'Respect for Marriage Act', 'yes', 'roll_call', 5::smallint, 0.95, true),
  (113, 119, 'house', 'H.R.3492', 'https://www.congress.gov/bill/119th-congress/house-bill/3492', null, 'no', 'roll_call', 5::smallint, 0.88, true),
  (117, 118, 'house', 'H.R.1124', 'https://www.congress.gov/bill/118th-congress/house-bill/1124', 'Federal Death Penalty Abolition Act of 2023', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (119, 117, 'house', 'H.R.3617', 'https://www.congress.gov/bill/117th-congress/house-bill/3617', 'MORE Act', 'yes', 'roll_call', 4::smallint, 0.9, true),
  (122, 118, 'house', 'H.R.4117', 'https://www.congress.gov/bill/118th-congress/house-bill/4117', 'College for All Act of 2023', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (126, 118, 'house', 'H.R.4889', 'https://www.congress.gov/bill/118th-congress/house-bill/4889', 'Raise the Wage Act of 2023', 'yes', 'sponsorship', 4::smallint, 0.7, true),
  (128, 119, 'house', 'H.R.833', 'https://www.congress.gov/bill/119th-congress/house-bill/833', 'Educational Choice for Children Act of 2025', 'yes', 'sponsorship', 4::smallint, 0.7, true),
  (129, 118, 'house', 'H.R.6544', 'https://www.congress.gov/bill/118th-congress/house-bill/6544', 'Atomic Energy Advancement Act', 'yes', 'roll_call', 2::smallint, 0.55, true),
  (130, 118, 'house', 'H.R.2', 'https://www.congress.gov/bill/118th-congress/house-bill/2', 'Secure the Border Act of 2023', 'yes', 'roll_call', 5::smallint, 0.92, true),
  (131, 118, 'house', 'H.R.1404', 'https://www.congress.gov/bill/118th-congress/house-bill/1404', 'Facial Recognition and Biometric Technology Moratorium Act of 2023', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (133, 118, 'house', 'H.R.140', 'https://www.congress.gov/bill/118th-congress/house-bill/140', 'Protecting Speech from Government Interference Act', 'no', 'roll_call', 3::smallint, 0.78, true),
  (134, 117, 'house', 'H.R.3825', 'https://www.congress.gov/bill/117th-congress/house-bill/3825', 'Ending Platform Monopolies Act', 'yes', 'sponsorship', 3::smallint, 0.55, true),
  (135, 119, 'house', 'H.R.1504', 'https://www.congress.gov/bill/119th-congress/house-bill/1504', 'China Trade Relations Act of 2025', 'yes', 'sponsorship', 3::smallint, 0.55, true),
  (136, 119, 'house', 'H.J.Res.5', 'https://www.congress.gov/bill/119th-congress/house-joint-resolution/5', 'Congressional Term Limits Amendment', 'yes', 'sponsorship', 3::smallint, 0.65, true),
  (138, 118, 'house', 'H.J.Res.227', 'https://www.congress.gov/bill/118th-congress/house-joint-resolution/227', 'Electoral College Abolition Amendment', 'yes', 'sponsorship', 3::smallint, 0.6, true)
on conflict (issue_id, congress, chamber, measure) do update set
  measure_url=excluded.measure_url, description=excluded.description, yea_means=excluded.yea_means,
  evidence_kind=excluded.evidence_kind, base_strength=excluded.base_strength,
  base_confidence=excluded.base_confidence, verified=excluded.verified;
