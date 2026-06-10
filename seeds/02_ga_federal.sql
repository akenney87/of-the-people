-- Seed: GA's federal delegation, scraped 2026-06-09 from
-- https://www.senate.gov/general/contact_information/senators_cfm.xml
-- https://www.house.gov/representatives
-- Re-run districts/update_representatives.py to refresh.

INSERT INTO public.representatives (name, position, state, party, phone, website, cong_district) VALUES
  ('Jon Ossoff',          'U.S. Senator',        'GA', 'D', '(202) 224-3521', 'https://www.ossoff.senate.gov',  NULL),
  ('Raphael G. Warnock',  'U.S. Senator',        'GA', 'D', '(202) 224-3643', 'https://www.warnock.senate.gov', NULL),
  ('Carter, Earl',           'U.S. Representative', 'GA', 'R', '(202) 225-5831', 'https://buddycarter.house.gov/',   '01'),
  ('Bishop, Sanford',        'U.S. Representative', 'GA', 'D', '(202) 225-3631', 'https://bishop.house.gov/',         '02'),
  ('Jack, Brian',            'U.S. Representative', 'GA', 'R', '(202) 225-5901', 'https://jack.house.gov/',           '03'),
  ('Johnson, Henry',         'U.S. Representative', 'GA', 'D', '(202) 225-1605', 'https://hankjohnson.house.gov/',    '04'),
  ('Williams, Nikema',       'U.S. Representative', 'GA', 'D', '(202) 225-3801', 'https://nikemawilliams.house.gov',  '05'),
  ('McBath, Lucy',           'U.S. Representative', 'GA', 'D', '(202) 225-4501', 'https://mcbath.house.gov',          '06'),
  ('McCormick, Richard',     'U.S. Representative', 'GA', 'R', '(202) 225-4272', 'https://mccormick.house.gov',       '07'),
  ('Scott, Austin',          'U.S. Representative', 'GA', 'R', '(202) 225-6531', 'https://austinscott.house.gov/',    '08'),
  ('Clyde, Andrew',          'U.S. Representative', 'GA', 'R', '(202) 225-9893', 'https://clyde.house.gov',           '09'),
  ('Collins, Mike',          'U.S. Representative', 'GA', 'R', '(202) 225-4101', 'https://collins.house.gov',         '10'),
  ('Loudermilk, Barry',      'U.S. Representative', 'GA', 'R', '(202) 225-2931', 'https://loudermilk.house.gov',      '11'),
  ('Allen, Rick',            'U.S. Representative', 'GA', 'R', '(202) 225-2823', 'https://allen.house.gov',           '12'),
  ('Scott, David- Vacancy',  'U.S. Representative', 'GA', 'D', '(202) 225-2939', 'https://davidscott.house.gov/',     '13'),
  ('Fuller, Clay',           'U.S. Representative', 'GA', 'R', '(202) 225-5211', 'https://fuller.house.gov/',         '14')
ON CONFLICT (name, position) DO UPDATE SET
  state         = EXCLUDED.state,
  party         = EXCLUDED.party,
  phone         = EXCLUDED.phone,
  website       = EXCLUDED.website,
  cong_district = EXCLUDED.cong_district;
