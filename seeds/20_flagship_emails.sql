-- seeds/20_flagship_emails.sql
-- Flagship-candidate contact emails, sourced 2026-06-19 to unlock the email-token claim flow
-- (migrations/0014). Each email is cited to an official/campaign source below. Idempotent
-- (plain UPDATE by id). representatives.email is used BOTH for public "Contact" display and as
-- the address the claim-verification token is sent to — so only deliverable, cited addresses are
-- seeded here. "Safe by construction": a wrong address can never false-approve a claim; it simply
-- fails to verify (see CLAIM_FLOW_PLAN.md).
--
-- Sourcing tiers: official legislature directory > official .gov press page > campaign site footer.
-- Held / not seeded (reason inline): Clyde (staffer email, unverifiable page), Collins / Rick
-- Jackson / Gegen (no public email — contact form only → manual claim path).

-- ── GA state legislators (official chamber member pages, confidence: high) ──
update public.representatives set email = 'drew.echols@senate.ga.gov'    where id = 73;  -- senate.ga.gov member page (SD-49, Gainesville/Hall)
update public.representatives set email = 'greg.dolezal@senate.ga.gov'   where id = 51;  -- senate.ga.gov member page (SD-27)
update public.representatives set email = 'josh.mclaurin@senate.ga.gov'  where id = 38;  -- senate.ga.gov member page (SD-14)
update public.representatives set email = 'brian.strickland@senate.ga.gov' where id = 66; -- senate.ga.gov member page (SD-42)
update public.representatives set email = 'matt.dubnik@house.ga.gov'     where id = 109; -- house.ga.gov member page (HD-29, Gainesville)

-- ── Federal incumbent (official .gov press page, confidence: high) ──
update public.representatives set email = 'press@ossoff.senate.gov'      where id = 10;  -- ossoff.senate.gov/contact-us press inquiries

-- ── 2026 statewide candidates (campaign-site footers, confidence: high) ──
update public.representatives set email = 'info@burtjonesforga.com'      where id = 261; -- burtjonesforga.com footer
update public.representatives set email = 'info@dooleyforgeorgia.com'    where id = 280; -- dooleyforgeorgia.com homepage
update public.representatives set email = 'info@keishaforgovernor.com'   where id = 282; -- keishaforgovernor.com (/contact 307 -> mailto)
update public.representatives set email = 'dana@electdanabarrett.com'    where id = 278; -- electdanabarrett.com footer

-- ── HELD (not applied) — pending founder decision / better source ──
-- Clyde (id 20): Madeline.Huffman@mail.house.gov — comms director, from clyde.house.gov/media-kit,
--   but the page 403'd on fetch (cached-excerpt only) and it's a named staffer. Uncomment to apply:
-- update public.representatives set email = 'Madeline.Huffman@mail.house.gov' where id = 20;
-- Collins (id 21): contact form only (collins.house.gov/contact) — no public email. Manual claim.
-- Rick Jackson (id 281): contact form only (rickjackson.com/contact) — no public email. Manual claim.
-- Caitlyn Gegen (id 279): caitlynforgeorgia.com is a JS SPA; no email surfaced. Needs manual visit.
