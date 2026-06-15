# Claim Flow ("Blue Check") — design

The planned handoff: AI inference seeds every profile (the bridge); officials/candidates
then **claim** their profile and verify/correct their own answers (the destination). This is
the credibility mechanism — "we don't put words in their mouth."

## What already exists (reuse, don't rebuild)

- **Auth**: full email/password + email verification (`Login`, `Register`, `VerifyEmail`,
  `ForgotPassword`, `ResetPassword`, `ProtectedRoute`), Supabase `auth.users`, app `users` table.
- **Claim columns on `rep_positions`**: `claimed_by_user_id`, `verified_by_official`, `verified_at`.
- **RLS**: on everywhere. `rep_positions_owner_update` already enforces
  `USING/WITH CHECK (auth.uid() = claimed_by_user_id)`. `rep_positions_public_read` = true.
- **Anon correction intake**: `takedown_requests` table + insert policy (precedent for review).
- **UI placeholder**: `RepresentativeDetails` has the "Are you {name}? … when the blue-check
  claim flow ships" card — the natural **Claim this profile** entry point.
- **Display hooks**: positions already labeled "AI-estimated"; `verified_by_official` ready to flip the label.

## The gap (what's missing)

1. No **claim record** linking a user → a representative, and no **identity-verification gate**.
2. No **granting** mechanism (nothing sets ownership).
3. The owner policy keys on *per-row* `rep_positions.claimed_by_user_id`, which nothing populates
   and which doesn't cover INSERTing positions for issues the rep has no row on yet.
4. No **edit UI** for an official, and no **admin review** surface.

## Identity verification (the crux)

The integrity risk: nobody who isn't the official may edit a profile.

**Email verification is the PRIMARY path.** A deliverable official/campaign email is findable for
~all incumbents (office/press address, incl. `firstname.lastname@mail.house.gov`) and nearly all
challengers (campaign site / FEC filing / Ballotpedia). We currently have only 4 of 277 on file, so
sourcing them is a data task — but findability is ~universal.

- **Mechanism — token to the on-file address.** Claimant clicks "Claim," we email a one-time signed
  token to `representatives.email`, they click it while logged in → `approve_claim()` fires
  automatically. Needs an **email provider** (Resend / Postmark / Supabase SMTP) + an edge function.
- **Safe by construction.** Verification requires *controlling* the address, so a wrong/sourced
  address can never cause a false approval — it simply fails to verify and drops to manual. This is
  what makes aggressive email-sourcing safe.
- **Policy: staff/campaign on-behalf is allowed.** A shared office inbox or `info@campaign.com`
  proves the official's *operation*, not always the named person — acceptable (like a press
  secretary). Adopt explicitly.
- **Lowest-infra variant (if deferring the provider):** auto-approve when the claimant's *verified
  signup email* exactly matches `representatives.email` — reuses existing signup verification, zero
  new infra, but forces the official to register with that exact address.

- **Manual review — the residual fallback.** Claimant submits role + evidence link; Alexander
  approves. Covers the few we can't email (no address sourced, bounced token). Same `approve_claim()`.

**Prerequisite data task:** source + capture deliverable official/campaign emails into
`representatives.email` for the active ballot (then expand). This is what makes the primary path fire.

## Data model

**New table `public.official_claims`:**

| column | meaning |
|---|---|
| `id` | pk |
| `rep_id` → representatives | the profile being claimed |
| `user_id` → auth.users | the claimant |
| `status` | `pending` / `approved` / `rejected` |
| `claimant_role` | `official` / `staff` / `candidate` |
| `evidence_url`, `note` | proof the reviewer checks |
| `method` | `manual` / `gov_email` |
| `submitted_at`, `reviewed_at`, `reviewed_by` | audit |

**Add `representatives.claimed_by_user_id`** (the single source of claim truth — rep-level, not
per-position). On approval, set it. (Keep `rep_positions.claimed_by_user_id`/`verified_at` as
per-row *audit* of who verified what.)

## RLS / security (approval is server-side only)

- **`official_claims`**: insert-own (`with check user_id = auth.uid()`), select-own. **Status is
  NEVER client-writable** — approval flips it.
- **Approval runs with elevated rights** — a `SECURITY DEFINER` function `approve_claim(claim_id)`
  restricted to an admin (Alexander's uid, or an `is_admin` flag), or the Supabase service role.
  It sets `official_claims.status='approved'` + `representatives.claimed_by_user_id`. The client can
  never grant itself ownership.
- **Rewrite `rep_positions` owner policy to rep-level** so it also covers new positions:
  ```sql
  using ( exists (select 1 from representatives r
                  where r.id = rep_positions.rep_id and r.claimed_by_user_id = auth.uid()) )
  ```
  Add a matching **INSERT** policy (officials can answer issues with no seeded row). On any official
  write: set `verified_by_official=true`, `verified_at=now()`, `claimed_by_user_id=auth.uid()` (audit).
- An official can only ever touch their own rep's rows — enforced by the `exists` check.

## UI

1. **Claim entry** — turn the existing "Are you {name}?" card into a **Claim this profile** button
   (logged-in users). Logged-out → prompt to sign in first.
2. **Claim form** — role + evidence URL + note → inserts `official_claims` (pending). Confirmation:
   "We'll review and email you." (Tier 2 later: "verify via your official email" path.)
3. **Official edit mode** — when `representatives.claimed_by_user_id === auth.uid()`, the detail page
   shows per-issue editors: each AI-seeded position shown as the starting value with a clear
   "AI estimate — confirm or change" affordance; saving sets `verified_by_official`. Issues with no
   seed show as blank/unanswered to fill.
4. **Display** — verified positions get the blue check + "Verified by {Official}"; unverified keep
   "AI-estimated." (Pairs with the tiered confirmed/likely/unknown display.)

## Admin review (beta)

Lean: a minimal admin page (gated to Alexander's uid) listing `pending` claims with the evidence
link and an Approve/Reject button calling `approve_claim`. Acceptable interim: review in the Supabase
dashboard and call `approve_claim` directly. Notification: Supabase email / a simple webhook.

## Build sequence

1. **Schema + RLS** ($0): `official_claims` table, `representatives.claimed_by_user_id`,
   `approve_claim()` SECURITY DEFINER, rewrite `rep_positions` owner policy + add INSERT policy.
   Capture as a migration.
2. **Claim entry + form** (client): button on `RepresentativeDetails` → claim form → insert.
3. **Admin review**: minimal approve/reject page (or dashboard + function for the very first claims).
4. **Official edit mode** (client): per-issue editor gated on ownership; writes verified positions.
5. **Display**: blue-check + "verified by official" vs "AI-estimated."
6. **Tier 2 (fast-follow)**: official-email token auto-verify (edge function).

## Decisions needed before building

- **Verification for beta**: Tier 1 manual-first (recommended) vs build Tier 2 (gov-email) now?
- **Claim ownership**: rep-level `representatives.claimed_by_user_id` + policy rewrite (recommended)
  vs keep per-row?
- **Admin surface**: minimal in-app admin page now, vs Supabase-dashboard + `approve_claim()` for the
  first few claims (leaner)?
