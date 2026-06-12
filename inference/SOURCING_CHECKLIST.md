# Inference Sourcing Checklist

**Read this before every inference pass, and run the per-issue loop for EVERY
(candidate, issue) pair.** The match score is only as trustworthy as the
evidence behind each position. The cardinal rule: **a position must trace to a
specific, citable source — a vote, a bill, a questionnaire answer, or a verbatim
statement — or it is `unclear`. Never infer a stance from party, donors, or
endorsements.**

This is the standard for both the supervised (in-session) pass and the future
automated pipeline. See also [[../ROADMAP.md]] §4 and the alignment rules in
`migrations/0004`.

---

## 0. Per-candidate pre-flight (once per candidate)

- [ ] **Classify** the candidate: **incumbent** (has a voting record) or
      **challenger** (no record — rely on questionnaires/statements).
- [ ] **Assemble the source set** across the tiers below. Store each retrieved
      document in `public.rep_sources` with the correct `source_type`.
- [ ] Note office/district so you apply the right votes/bills.

## Source tiers — consult in priority order (higher tier = stronger evidence)

| # | Tier | Where | `source_type` | Notes |
|---|------|-------|---------------|-------|
| 1 | **Voting record** (incumbents) | Congress API (federal — key in `.env`), OpenStates (state — key in `.env`); roll-call votes + sponsored/cosponsored bills | `vote_record`, `bill_cosponsorship` | **STRONGEST. Actions over words.** A sponsored bill is a deliberate, on-record position. |
| 2 | **Candidate questionnaires** | Vote411 / LWV, local-paper questionnaires (e.g. Gainesville Times, Main Street News) | `other` | Best challenger source — the candidate's own words on the exact issue. |
| 3 | **Official site / press releases** | campaign + .gov issue pages | `official_page`, `press_release` | Stated positions = **marketing**. Corroborate with tier 1–2; never the sole basis for high confidence. |
| 4 | **Speeches / statements / debates** | Congressional Record, candidate forums, debate transcripts | `speech` | |
| 5 | **News coverage** | reputable outlets quoting the candidate | `other` | A reporter's paraphrase is weaker than a direct quote. |
| 6 | **Social media** | X / Facebook / Instagram | `social_post` | Blunt but low-access (paid/ToS-restricted) and must be authenticated. Funded-tier only. |

## Per-issue loop — run for EACH issue

For candidate **C** and issue **I**:

1. [ ] **Re-read the issue text** — mind the framing (which direction is "yes"?).
2. [ ] **Search the tiers in order** (start at tier 1) for C's stance on I.
3. [ ] **Prefer ACTIONS over WORDS.** A vote/bill outranks a website line.
       **Conflict rule:** if the record contradicts the rhetoric, the record wins
       — and note the contradiction.
4. [ ] **Apply the evidence bar:** is there ≥1 specific, citable item (a named
       bill/vote, a verbatim quote, a questionnaire answer)?
   - **NO →** `predicted_vote = 'unclear'`, `stance_strength = NULL`, `confidence
     = NULL`. **STOP.** Store it (documents that we looked) — it is excluded
     from the score. Do **not** guess from ideology.
   - **YES →** continue.
5. [ ] **Direction** (`predicted_vote` = `yes`/`no`): does the evidence support
       or oppose I *as framed*?
6. [ ] **Intensity** (`stance_strength`, 1–5 — the candidate's analog of voter
       passion, used in the 1–10 alignment scale):
   - **5** — a signature issue: repeated votes/sponsorship **and** explicit strong language.
   - **3–4** — a clear vote or explicit statement.
   - **1–2** — a single mild or indirect signal.
7. [ ] **Confidence** (0–1 — how sure WE are; display only, NOT in the score):
   - **≥0.9** — multiple corroborating sources incl. a vote/bill.
   - **0.7–0.9** — one strong source (a vote, or an explicit statement).
   - **0.5–0.7** — one moderate/indirect source.
   - **<0.5** — too weak; fall back to `unclear`.
8. [ ] **Record** to `public.rep_positions`:
   - `predicted_vote`, `stance_strength`, `confidence`
   - `supporting_quote` — **verbatim** statement, or the **factual citation** for a
     vote/bill (e.g. `Cosponsored H.R.73, the "Abortion Is Not Health Care Act"`).
     Never a paraphrase presented as a quote.
   - `source_url` — link to the strongest source; `source_id` if stored in
     `rep_sources`.

## Output integrity (verify before finishing)

- [ ] Every `yes`/`no` row has a real `source_url`.
- [ ] `supporting_quote` is verbatim or a factual vote/bill citation — never invented.
- [ ] `unclear` rows are stored and excluded from scoring.
- [ ] Indirect/adjacent evidence gets **lower confidence**, not a confident guess.
- [ ] Everything stays `verified_by_official = false` (AI-estimated) until the
      candidate claims & confirms via the blue-check flow.
