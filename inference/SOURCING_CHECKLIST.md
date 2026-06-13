# Inference Sourcing Checklist

**Read this before every inference pass, and run the per-issue loop for EVERY
(candidate, in-scope issue) pair.** The match score is only as trustworthy as
the evidence behind each position.

**Cardinal rule:** a position must trace to a specific, citable source — a vote,
a bill, a questionnaire answer, or a verbatim statement — or it is `unclear`.
**Never infer a stance from party, donors, or endorsements.** Exhaust the
accessible sources below *before* concluding `unclear`.

This is the standard for both the supervised (in-session) pass and the future
automated pipeline. See `../ROADMAP.md` §4, the scoring rules in
`migrations/0004`, and [[feedback-alignment-scoring]] in memory.

---

## 0. Per-candidate pre-flight (once per candidate)

- [ ] **Classify:** incumbent (has a voting record) or challenger (no record).
- [ ] **Determine scope** (which issues to infer — see below).
- [ ] **Assemble the source set** across the tiers, storing each retrieved
      document in `public.rep_sources` with the correct `source_type`.

## Scope — which issues to infer for this candidate

This is a **values comparison**, not a job-description match. National issues
reveal values *every* candidate holds (money in politics, abortion, guns), so
they apply to everyone. The rule is asymmetric: **score a candidate on issues at
their office's scope AND all broader (more general) scopes; exclude only issues
MORE LOCAL than their office.** (A U.S. Senator isn't scored on "should Hall
County raise property taxes" — too local — but a city-council candidate *is*
scored on national money-in-politics, because it's a real values signal.)

Breadth order: national > state > county > city.

| Office `level` | Infer issue scopes | IDs |
|---|---|---|
| `federal` (US Senate/House) | national | 100s (38) |
| `state` (Gov, statewide exec, legislature) | national + state | 100s+200s (48) |
| `county` (commission, school board) | national + state + county | 100s–300s (53) |
| `city` (council) | national + state + county + city | **all 58** |

Target = **all in-scope issues**, not just the 10 onboarding ones. Because
national issues apply to every candidate, the national-only onboarding overlaps
*all* races immediately — including local ones — so a voter who's only done
onboarding still gets a real match against their local candidates.

## Source tiers — consult in priority order; **exhaust every accessible one**

Higher tier = stronger evidence. Free/accessible status as of 2026-06 noted.

| # | Tier | Concrete sources | `source_type` | Access (zero-budget) |
|---|------|------------------|---------------|----------------------|
| 1 | **Voting record** (incumbents) | **Congress.gov API** (federal — `CONGRESS_API_KEY`): member `/v3/member/congress/{cong}/{ST}/{dist}`, then `/sponsored-legislation` + `/cosponsored-legislation`; roll-call votes. **OpenStates API** (state — `OPENSTATES_API_KEY`). GovTrack. | `vote_record`, `bill_cosponsorship` | ✅ **FREE & reliable.** The backbone for incumbents. Actions over words. |
| 2 | **Candidate questionnaires** | Vote411 (LWV), local-paper questionnaires (Gainesville Times, Main Street News), Ballotpedia Candidate Connection | `other` | ⚠️ **Often blocked** — JS/anti-bot/rate-limit (`403`/`429`). Best challenger source but hardest to reach. See "Access reality" below. |
| 3 | **Official / campaign site** | .gov issue pages (incumbents); campaign issues/platform page (challengers) | `official_page`, `press_release` | ⚠️ Mixed — static = free; JS SPA needs a headless browser. Marketing: corroborate, don't over-trust. |
| 4 | **Profiles, speeches, debates, forums** | candidate news profiles (e.g. Jejune, local outlets), Congressional Record, forum/debate writeups | `speech`, `other` | ✅ Usually free via search + fetch. A reporter paraphrase < a direct quote. |
| 5 | **News coverage** | reputable outlets quoting the candidate (targeted search **per issue**) | `other` | ✅ Free. |
| 6 | **Social media** | X / Facebook / Instagram | `social_post` | ❌ Funded-tier (paid API / ToS friction). |

## Per-issue search loop — run for EACH in-scope issue

For candidate **C** and issue **I**:

1. [ ] **Re-read the issue text** — mind the framing (which direction is "yes"?).
2. [ ] **Walk the tiers in order (1→5), and within a tier do a targeted search
       naming the issue** (e.g. `"<candidate>" <issue keyword> vote OR bill OR
       statement`). Do **not** stop at the first "not found" — try the next tier.
3. [ ] **Prefer ACTIONS over WORDS.** A vote/bill outranks a website line.
       **Conflict rule:** if the record contradicts the rhetoric, the record wins —
       and note it.
4. [ ] **Evidence bar:** after exhausting accessible tiers, is there ≥1 specific,
       citable item (a named bill/vote, a verbatim quote, a questionnaire answer)?
   - **NO →** `predicted_vote='unclear'`, `stance_strength=NULL`, `confidence=NULL`.
     Store it (documents that we looked + which sources were checked); it is
     excluded from the score. **Do not guess from ideology.**
   - **YES →** continue.
5. [ ] **Direction** (`yes`/`no`): does the evidence support or oppose I *as framed*?
6. [ ] **Intensity** (`stance_strength` 1–5 — candidate's analog of voter passion,
       used in the 1–10 alignment scale):
   - **5** signature issue (repeated votes/sponsorship + explicit strong language)
   - **3–4** a clear vote or explicit statement
   - **1–2** a single mild or indirect/adjacent signal
7. [ ] **Confidence** (0–1 — how sure WE are; display only, NOT in the score):
   - **≥0.9** multiple corroborating sources incl. a vote/bill
   - **0.7–0.9** one strong source (a vote, or an explicit statement)
   - **0.5–0.7** one moderate/indirect source
   - **<0.5** too weak → fall back to `unclear`
8. [ ] **Record** to `public.rep_positions`: `predicted_vote`, `stance_strength`,
       `confidence`, `supporting_quote` (**verbatim** statement OR a factual
       vote/bill citation — never a paraphrase presented as a quote), `source_url`
       (strongest source), `source_id` if stored in `rep_sources`.

## Output integrity (verify before finishing)

- [ ] Every `yes`/`no` row has a real `source_url`.
- [ ] `supporting_quote` is verbatim or a factual vote/bill citation — never invented.
- [ ] Indirect/adjacent evidence → **lower confidence**, not a confident guess.
- [ ] `unclear` rows are stored and excluded from scoring (honest gaps shown in UI).
- [ ] Everything `verified_by_official=false` (AI-estimated) until the candidate
      claims & confirms via the blue-check flow.

---

## Access reality (zero-budget vs funded-tier)

What a $0 budget can reach today, learned by doing:

**Reliably FREE (use these first, always):**
- Congress.gov API (federal voting record) — `CONGRESS_API_KEY`
- OpenStates API (state voting record) — `OPENSTATES_API_KEY`
- Static official/.gov pages; most local-news profiles & coverage via search+fetch

**BLOCKED on $0 (data exists, access is the wall):**
- Vote411, Ballotpedia (Cloudflare/anti-bot → `403`)
- Some local-paper questionnaires (rate-limit → `429`)
- JS-only campaign SPAs (client-side routes → `404` to a plain fetch)
- web.archive.org (blocked in this environment)

**Funded-tier upgrades to unblock the above (NOT free):**
- **Headless browser (Playwright)** — *free for JS-rendered sites*, but a vanilla
  browser is still detected by serious anti-bot; defeating that needs **paid
  proxies / anti-detect / CAPTCHA-solving**.
- **Paid candidate-data APIs** — Ballotpedia Candidate Connection, Vote Smart.
- **LWV / Vote411 data partnership** — the cleanest path for questionnaires; the
  data is meant to be distributed. Pursue this over scraping for a civic-trust
  product.

**Implication:** at $0, **incumbents are well-served** (free voting-record APIs) and
**challengers are thinner** (campaign sites/questionnaires are exactly what's
blocked). Score what's citable; mark the rest `unclear`; revisit when funded.
