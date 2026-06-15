-- seeds/14_gegen_lowconf.sql
-- Caitlyn Gegen (rep 279, GA-09 challenger) — yield of the low-confidence harvest
-- prototype (workflow wf_a06f0120-b67: Opus research, lean-preserving threshold,
-- Sonnet adversarial verify).
--
-- Of 26 currently-unclear issues, only ONE cleared the bar cleanly and is shipped
-- here: #126 (federal minimum wage), a verbatim, directly-cited statement.
--
-- REJECTED (supervised call): #112 same-sex marriage. The verifier returned it as
-- 'likely' (0.35) but its own note conceded the citation (a general "LGBTQ+ rights"
-- line) does NOT address same-sex marriage and the direction was "a reasonable
-- inference for a Democratic candidate" — i.e. a party inference. That violates the
-- cardinal rule (never infer from party; every shipped position must be cited to a
-- statement that actually supports it), so it is NOT shipped, at any confidence.
--
-- Takeaway: for a thin-record challenger, the 'unclear' bucket is mostly genuine
-- blanks; lowering the threshold did not meaningfully raise coverage. The fix for
-- challenger coverage is the claim flow / candidate self-report, not deeper inference.
-- Idempotent.

insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
values
  (279, 126, 'yes', 5::smallint, 0.7,
   'raising the federal minimum wage to at least $15 an hour',
   'https://www.jejunemagazine.com/home/caitlyn-gegen-georgias-9th-congressional-district',
   'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised, low-conf harvest)', now())
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength,
  confidence=excluded.confidence, supporting_quote=excluded.supporting_quote,
  source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at;
