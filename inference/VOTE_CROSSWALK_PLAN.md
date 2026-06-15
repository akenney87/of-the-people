# Issue → Vote Crosswalk — design

## The idea (and why it's the inverse of "derive questions from data")

Keep the question bank fixed (voter-values-first). Build a reusable map: **for each issue,
the canonical recorded votes / sponsorships that indicate a position, with a curated
direction mapping.** Build it once; then *every* incumbent is scored against the same
evidence set — by a cheap, near-deterministic applier, not a fresh research pass each time.

This fixes the three things ad-hoc research can't:
- **Coverage** — Clyde sits at 61% because we mined bills + a few votes; the full roll-call
  record plausibly takes a multi-term member to ~75-85%.
- **Consistency** — two members scored on issue 103 are scored against the *same* votes, so
  their alignment numbers are comparable.
- **Scale** — the expensive, integrity-sensitive work (direction mapping) is done ONCE.
  Adding the next incumbent is a cheap lookup, not a new investigation.

## Two phases

### Phase A — BUILD the crosswalk (once, supervised + adversarially verified)
For each of the 38 national issues, identify 1-3 canonical recent (118th-119th Congress)
recorded votes / sponsorships that bear on it, and curate the **direction mapping** — the
crux and the only integrity-sensitive step. Example: a YEA on a national abortion-ban bill
maps to **"no"** on issue 103 ("abortion legal in most circumstances"). This is exactly the
GA-analog direction discipline we already use, captured as durable data instead of
re-derived per candidate.

### Phase B — APPLY per member (cheap, repeatable, mostly deterministic)
For a given member: fetch their vote on each crosswalk measure, map Yea/Nay through the
curated polarity, aggregate per issue, emit `rep_sources` + `rep_positions` (same shape as
seeds 09/10). This is a script — minimal/zero model usage. The dormant
`inference/infer_positions.py` becomes this applier.

## Data model

`public.issue_vote_crosswalk` (capture as `seeds/` file + table, per data discipline):

| column | meaning |
|---|---|
| `issue_id` | → `public.issues.id` |
| `congress` | e.g. 119 |
| `chamber` | `house` / `senate` |
| `measure` | bill or roll-call id (e.g. `H.R.7`, `house-rollcall:2025-123`) |
| `measure_url` | congress.gov / clerk.house.gov URL |
| `description` | what the measure does (one line) |
| `yea_means` | `yes` / `no` — **what a YEA vote implies for the issue AS FRAMED** |
| `evidence_kind` | `roll_call` (strong) / `sponsorship` (weaker) |
| `base_strength` | 1-5 candidate intensity this evidence implies |
| `base_confidence` | 0-1 (roll_call ≈0.8-0.95; sponsorship ≈0.55-0.75) |
| `verified` | bool — direction mapping passed adversarial review |
| `notes` | caveats (procedural vote? watered-down later? etc.) |

Example rows:

| issue | measure | yea_means | kind | conf |
|---|---|---|---|---|
| 103 (abortion legal) | a national ban / "born-alive" bill | `no` | roll_call | 0.9 |
| 130 (tighten border) | Secure the Border Act (H.R.2) | `yes` | roll_call | 0.9 |
| 112 (same-sex marriage) | Respect for Marriage Act | `yes` | roll_call | 0.95 |
| 105 (tax the wealthy) | TCJA-extension / high-end tax cut | `no` | roll_call | 0.85 |
| 126 (raise min wage) | Raise the Wage Act | `yes` | roll_call | 0.9 |

## Data sources (all $0)

- **Congress.gov API** (`CONGRESS_API_KEY` already in `OtP/.env`) — member info, sponsored/
  cosponsored legislation, and member vote data.
- **House Clerk roll-call XML** (clerk.house.gov) + **Senate roll-call** (senate.gov) — the
  authoritative per-member Yea/Nay.
- **GovTrack** — convenient member vote history + bill subject tags (cross-check).
- Later: **OpenStates** (`OPENSTATES_API_KEY`) for a parallel GA-state crosswalk (state
  issues 201-210) applied to Echols/Dubnik and other state legislators.

## Integrity safeguards (carry every prior lesson)

1. **Direction mapping is curated + adversarially verified once** — a second pass re-checks
   every `yea_means` against the bill text and the issue framing (this is where errors hide).
2. **Recorded votes only for `roll_call`** — real roll-call id + URL, never inference from party.
3. **Exclude procedural votes** (motion to recommit, previous question) — final passage /
   substantive amendments only; flag anything ambiguous in `notes`.
4. **Conflicting votes** on one issue → prefer final-passage + most recent; if still
   contradictory, lower confidence or mark `unclear` rather than auto-averaging into a wrong
   direction.
5. **Perishable awareness** — re-pull each cycle; a new Congress adds new canonical votes.

## Confidence / strength → ties into Option B

`base_confidence` flows straight into `rep_positions.confidence`, which Option B now uses as
a scoring weight. Multiple consistent crosswalk votes on one issue → boost confidence toward
0.95 and strength toward 5. A single tangential vote → stays modest (a "likely", correctly
down-weighted). So the crosswalk populates the *confirmed* tier for incumbents, exactly where
the low-confidence harvest could not help.

## Coverage realism (be honest about the ceiling)

- **Strong proxies (most issues):** abortion, guns, taxes, healthcare, border/immigration,
  energy, min wage, marriage, trans-sports, trade, marijuana — these have clean recent
  roll calls. Expect big lift here.
- **Weak / rare floor votes:** term limits (136), national popular vote / electoral college
  (138), independent redistricting (137), some "values" framings. These rarely get a vote;
  may rely on cosponsorship of a constitutional amendment, or stay `unclear`. The crosswalk
  won't magic them into existence — and that's fine (honest blanks).
- Realistic target for a multi-term federal incumbent: **~75-85%**, not 100%.

## Build sequence

1. **Scaffold** the `issue_vote_crosswalk` table + seed file + the `infer_positions.py`
   applier signature ($0).
2. **Phase A build (one supervised workflow):** research agents (Congress.gov + Clerk) find
   canonical votes per issue-batch and propose `yea_means`; an adversarial pass verifies every
   direction mapping. Curate → `seeds/` file + table. *One-time model usage.*
3. **Phase B apply to Clyde:** run the applier; emit `rep_positions`; verify the jump from 61%.
   *Cheap / scriptable.*
4. **Reuse:** apply to every other federal incumbent on the ballot at near-zero marginal cost;
   then build the GA-state crosswalk (OpenStates) and apply to Echols/Dubnik.

## Cost shape

The investment is concentrated in **Phase A (once)**. Every member after the first is a cheap
lookup. That's the whole point — it converts per-candidate research (the thing that blew the
usage limit) into a one-time asset + a script.
