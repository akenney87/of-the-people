# Of the People — Forward Plan

_Last updated: 2026-06-11._

This is the strategic plan: where the product is going, how we generate the data
that makes it work, and how the data strategy **pivots by funding tier**. The
per-phase mechanics live in `README.md` (roadmap table) and `PHASE2B.md`
(migration runbook). This doc is the "why and what next."

---

## 1. The product in one sentence

Enter your address → see every race on your ballot (federal → city), **all
candidates, not just incumbents**, ranked by how well each aligns with *your*
answers to a set of policy questions (yes/no + a 1–5 passion weight). Officials
can claim their profile and verify their own answers.

Current scope: **Gainesville / Hall County, Georgia.** The near-term goal is a
**functional MVP to unlock funding** — not scale.

---

## 2. Two things we're matching, two data problems

VOTE411 looks like magic but is really two systems: **GIS** (address → districts
→ races) + a **human-maintained roster** of candidates and their answers. We
already have the GIS half. Our two open data problems:

| Problem | Status | How we solve it (through beta) |
|---|---|---|
| **Who is on the ballot** (challengers, not just incumbents) | Schema built (phase 3.5); data being sourced | Supervised research pass into `contests` + `candidacies` |
| **What each candidate believes** (to score them) | Pipeline scaffolded (phase 3.1–3.3); no rows yet | **Supervised Claude batch seed** into `rep_positions` (see §4) |

### Data model (phase 3.5)
- `elections` → `contests` → `candidacies`. A **candidate is a person-row in
  `representatives`**, so challengers automatically flow through the existing
  inference (`rep_sources`/`rep_positions`) and district-matching stacks — no
  duplicate person model.
- Contests carry the same district columns as `users`, so a race matches a voter
  exactly the way a rep does. `parent_contest_id` links general←primary and
  runoff←source across the lifecycle.
- **2026 GA calendar**: primary **May 19** (held), runoff **June 16**, general
  **Nov 3**, general runoff **Dec 1**. We are populating the **November general
  only** for the MVP (the live, decision-relevant ballot). Primary results are a
  later nice-to-have.

---

## 3. Question bank (phase 3.4 — done)

58 issues, rewritten for **neutral framing, single concept, value-diagnosticity**.
Design philosophy is **"A" — concrete issue-congruence**, not a latent values/
dimensional model. Rationale: transparency and the feeling of fairness beat
psychometric elegance for a civic-trust product. The **1–5 passion weight carries
the nuance** ("what you weight heavily reveals your values more than the yes/no").
10 onboarding questions form a balanced national fingerprint. Local questions are
fact-checked; `needs_review` remains on 401/405. Source of truth:
`shared/issues.json` → `seeds/00_issues.sql` → `public.issues`.

---

## 4. Inference strategy **through beta**

**Principle: don't automate prematurely.** At one-county scope the candidate set
is small and static (~30–60 people). We do not need the automated API pipeline,
local GPU inference, or paid data APIs yet. The cheapest, highest-quality option
is a **supervised, in-session Claude batch seed**, run by the founder with Claude
Code — the same model the API would call, just human-in-the-loop and billed under
the existing **$20/mo subscription** instead of per-token.

**How it works:**
1. **Roster**: supervised research (Wikipedia / Ballotpedia / GA SoS — note SoS is
   anti-bot) populates `contests` + `candidacies` for the Nov general, Hall County
   full ballot. Every candidacy carries a `source_url`.
2. **Positions**: Claude reads each candidate's record/platform and writes
   `rep_positions` rows — `predicted_vote`, `confidence`, `supporting_quote`,
   `source_url`. Cited and reviewable. Start with the **10 onboarding issues**,
   then expand to all 58. `model` column records the engine ("claude-supervised").
3. **Trust layer (the "blue check")**: the UI labels every predicted position as
   **AI-estimated until verified**. Officials/candidates **claim** their profile
   (`rep_positions.claimed_by_user_id`) and verify/correct answers
   (`verified_by_official`, `verified_at`). `takedown_requests` is the anon
   correction intake. This is the credibility mechanism — inference seeds the
   data, humans verify it, exactly as VOTE411 does manually.

**Coverage & scope.** Infer each candidate only on issues within their office's
scope — `federal`→national (100s), `state`→GA-state (200s), `county`→(300s),
`city`→(400s). Never score a congressman on county trash policy. Target is *all
in-scope issues* per candidate (e.g. the 38 national issues for a U.S. House
race), not just the 10 onboarding — across the ballot all 58 get covered,
distributed by office. The systematic per-issue source search (and the free-vs-
blocked source map) is in `inference/SOURCING_CHECKLIST.md`.

**Sourcing reality at $0:** incumbents are well-served by the free Congress.gov /
OpenStates voting-record APIs (the strongest, most defensible evidence).
Challenger questionnaires (Vote411, Ballotpedia, some local papers) are
access-blocked by anti-bot / rate-limits / JS — a *funded-tier* problem, not a
data-availability one. Score what's citable; mark the rest `unclear`.

**Cost through beta: ~$0 beyond the $20/mo subscription.**

**Dormant but ready** (do NOT run at beta scale): `inference/infer_positions.py`
+ pgvector + `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`SUPABASE_SERVICE_KEY`. This is
the *Tier B* upgrade, proven out but intentionally unused.

---

## 5. Post-beta pivot — by tier of success / funding

The inference + roster strategy scales with money. Each tier swaps manual effort
for automation and paid data.

### Tier A — Bootstrap continues (≈ $0 funding)
- Stay **manual / supervised** for everything. Expand **one county at a time** as
  capacity allows.
- **Hardware lever**: this laptop (12 GB RAM, 4 GB VRAM GTX 1650 Ti) caps Ollama
  at ~3B models — fine for *developing/testing* the local pipeline, not for
  production quality. If a used 16 GB-VRAM GPU becomes affordable, run 13–27B
  models locally as a **free production inference tier**, replacing manual
  position-seeding for new counties.
- Recruit volunteers (LWV-style) for roster upkeep + verification if a community
  forms.

### Tier B — Small grant / angel (≈ $25–100k)
- **Turn on the automated pipeline**: API keys (Anthropic + embeddings) *or* a
  local GPU box; run `infer_positions.py` on a schedule via a **Supabase
  Scheduled Edge Function** (the existing "Phase 4" automation note).
- **Buy candidate-roster data**: Ballotpedia or BallotReady/CivicEngine API →
  retire most manual sourcing. Enables multi-county / **statewide GA** coverage.
- **Unblock challenger questionnaires** (blocked at $0): an LWV/Vote411 data
  partnership (cleanest), paid candidate-data APIs (Ballotpedia Candidate
  Connection, Vote Smart), or headless-browser scraping with paid proxies.
- Part-time data + verification person for official-outreach campaigns.

### Tier C — Seed round (≈ $500k+)
- **Multi-state → national.** BallotReady CivicEngine API at scale.
- Dedicated inference infra (batched Claude API or self-hosted GPU cluster) with
  **real-time re-inference** triggered by new votes / press / news.
- **Staffed verification operation** — the VOTE411 human model, productized.
- Native mobile apps; org partnerships.

### Tier D — Breakout
- National civic utility. Partnerships (LWV, newsrooms). Full automation + human
  QA. Possible nonprofit arm to steward the data as a public commons.

---

## 6. Near-term task list (Phase 3 → 4)

- [ ] **Roster, Nov general** — build `contests` + `candidacies`, in order:
  statewide (~10) → US House GA-09 → GA legislature (Hall districts) → Hall
  County commission + school board. Mark runoff-pending slots "TBD."
  - [ ] Determine which **congressional/state-leg districts cover Hall County**
        (legislators aren't county-tagged; resolve via shapefiles /
        `find_district.py`).
  - [ ] Confirm **Gainesville municipal is off-cycle** (GA city elections are
        odd-year → 2027; likely nothing on the 2026 ballot).
- [ ] **Position seed** — supervised Claude pass → `rep_positions` for the Nov
      general candidates, onboarding-10 first, then all 58. Cited.
- [ ] **Matching/UI** — `get_my_ballot` RPC (contests + candidates by district) +
      a "Your Races" view; surface alignment scores + AI-estimated/verified
      labels.
- [ ] **Beta (Phase 4)** — Gainesville invite-only.

---

## 7. Standing principles (learned the hard way this cycle)

- **Capture schema/data as files.** The `issues` table and the phase-3.1 schema
  were applied via MCP and never captured → drift. All schema now lives in
  `migrations/`, all seed data in `seeds/`.
- **Fact-check every local claim** before it ships (we caught an already-passed
  GA RFRA worded as "should they pass it," and a wrong primary date).
- **Cite everything.** Positions and candidacies carry `source_url`; inference is
  defensible or it doesn't ship.
