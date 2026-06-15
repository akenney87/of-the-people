# Issue Wording Rubric + Audit

The 58-question bank is **AI-drafted and not yet voter-validated**, so wording precision
is the whole ballgame: a candidate's stance only counts as a match if it addresses the
question's *exact* framing — otherwise it's `unclear`. Source of truth is
`shared/issues.json` → `seeds/00_issues.sql` → `public.issues` (re-seed after edits).

## Rubric (extends Philosophy A: single concept, neutral framing, value-diagnostic)

1. **Name the concrete policy/tradeoff, never the label.** "Do you support ICE?" is
   unanswerable — the agency's existence? its tactics? its budget? Ask the specific
   contested *action*.
2. **No hidden time anchors.** "this administration's version of X" / "keep the current
   law" / "continue the current program" are correct today and stale + non-comparable
   tomorrow. Prefer the durable principle over the transient implementation.
   *Timeframe can be a dealbreaker: "support ICE" ≠ "support the current ICE."*
3. **Perishable issues get timestamped + flagged.** If an issue is inherently about a
   current/changing policy, reframe to the principle, or explicitly date it and set
   `"perishable": true` so it's re-reviewed each cycle.
4. **One scope, one timeframe.** Never blend "ever" with "currently," and avoid
   double-barrels (two distinct asks in one question).
5. **No ambiguous-direction framings.** "Should GA *keep* law X?" is broken when opposing
   it can mean BOTH "repeal" and "make it stricter" — opposite values, same answer.
   Ask the underlying position, not the status quo.
6. **Verification matches framing (incl. timeframe).** A statement about "the current
   border crisis" does NOT confirm a position on a timeless border principle.

## Proposed schema addition

Add optional `"perishable": true` to `issues.json` (+ a `perishable boolean default false`
column on `public.issues`) for time-bound questions, distinct from `needs_review`
(which flags fact-check-needed). Perishable = re-verify the *wording* each election cycle.

---

## Audit — flagged questions (proposed rewrites NOT yet applied; pending approval)

### Tier 1 — logical / matching flaws (fix before more research)

| id | current | problem | proposed rewrite |
|----|---------|---------|------------------|
| 130 | "Should the U.S. tighten border security **and** reduce overall immigration levels?" | **Double-barrel** — border security ≠ legal-immigration levels; a voter/candidate can want one not the other. | Split. 130a: "Should the U.S. tighten security at the border to reduce illegal crossings?" 130b: "Should the U.S. reduce the overall number of legal immigrants admitted each year?" |
| 210 | "Should Georgia **keep its current law** banning most abortions after about six weeks?" | **Ambiguous-direction + perishable** — "no" means both "make it less restrictive" and "ban earlier"; rots if the law changes. | "Should abortion in Georgia be legal past roughly six weeks of pregnancy?" (durable, single-direction) |
| 205 | "Should Georgia **keep the limits** on citizen's arrests it passed after the Ahmaud Arbery case?" | **Ambiguous-direction + perishable** — "no" conflates "restore broad citizen's arrest" with other intents. | "Should Georgia keep tight limits on when private citizens can detain someone they suspect of a crime?" (or split into the underlying principle) |
| 134 | "Should the government break up large corporations **that have grown too powerful**?" | **Loaded presupposition** — assumes they are too powerful. | "Should the government be more willing to break up very large corporations?" |
| 302 | "Should the Hall County Sheriff's office **continue partnering** with federal agents to identify and detain undocumented immigrants?" | **Status anchor (the ICE trap you raised)** — "continue" presumes a current partnership; matches a stance on the *current* program, not the principle. | "Should the Hall County Sheriff's office help federal immigration agents identify and detain undocumented immigrants?" |

### Tier 2 — time/status anchors → reword or mark `perishable`

| id | issue | action |
|----|-------|--------|
| 305 | "...beyond **today's limited** on-demand service" — time-anchored factual claim + "limited" is mildly loaded | drop the editorializing: "Should Hall County expand public bus/transit service?"; verify current service state |
| 126 | "raised **substantially above $7.25** an hour" — $7.25 is a current value that can change | keep for now; mark `perishable`, re-check the figure each cycle |
| 207 | "higher than the **federal $7.25** an hour" — same $7.25 anchor | mark `perishable` |
| 403 | "**increase funding** for its police department" — relative to an implicit current budget | acceptable; note it reads against current budget |

### Tier 3 — vague / leading (optional polish)

| id | issue | note |
|----|-------|------|
| 104 | "do more to **solve problems and help people**, even if higher taxes" | vague + mildly leading (who opposes helping people?); consider "Should government do more, and tax more, to provide public services?" |
| 114 | "teach students about gender identity and sexual orientation" | **scope ambiguous** — which grade level? K-3 vs high school is a different question; consider specifying age band |
| 105 / 126 | "significantly" / "substantially" higher | vague quantifiers; acceptable, the passion weight absorbs nuance |
| 108 | "path to legal status **and** eventual citizenship" | mild double-barrel (tightly linked); low priority |

### Clean (representative — no change)
102, 103, 106, 107, 109, 110, 111, 112, 113, 115, 116, 117, 118, 119, 120, 121, 122,
123, 124, 125, 127, 128, 129, 131, 132, 133, 135, 136, 137, 138, 201, 202, 203, 204,
206, 208, 209, 301, 303, 304, 402, 404. (401, 405 already carry `needs_review`.)
