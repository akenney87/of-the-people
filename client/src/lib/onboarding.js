// Onboarding-data stash, used to bridge the gap between signUp and the
// session that gets created after email confirmation.
//
// Supabase's default "confirm email" setting makes signUp return
// session: null. Without a session, we can't write to RLS-protected
// public.users / public.votes from the browser. So at signup time we
// stash the street address and the 10 votes here, and the Dashboard
// applies the stash on its first mount (when the user is finally
// authenticated). Cleared on success.
import { supabase } from "./supabaseClient";

const STASH_KEY = "otp_pending_onboarding";

export function stashOnboarding({ email, street_address, city, state, zip_code, votes }) {
  localStorage.setItem(
    STASH_KEY,
    JSON.stringify({
      email,                 // tag the stash so we only apply it for the right user
      street_address,
      city,
      state,
      zip_code,
      votes,
      created_at: Date.now(),
    })
  );
}

export function clearOnboardingStash() {
  localStorage.removeItem(STASH_KEY);
}

export function getOnboardingStash() {
  const raw = localStorage.getItem(STASH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Apply any pending stash for the given authenticated user.
 * - Resolves districts via /api/lookup-districts (best-effort).
 * - Upserts the 10 onboarding votes.
 * - Clears the stash on success.
 *
 * Returns:
 *   { applied: true,  districts, voteCount }      on a fresh apply
 *   { applied: false, reason: 'no_stash' }        if nothing to do
 *   { applied: false, reason: 'no_user' }         if the call is unauthed
 *   { applied: false, reason: 'votes', error }    if the vote write fails
 */
export async function applyOnboardingStash(userId, currentEmail = null) {
  if (!userId) return { applied: false, reason: "no_user" };
  const stash = getOnboardingStash();
  if (!stash) return { applied: false, reason: "no_stash" };

  // Safety: the stash belongs to a specific email. If a different user has
  // signed in on this browser since the stash was written, drop it rather
  // than apply someone else's onboarding to the wrong account.
  if (currentEmail && stash.email && stash.email.toLowerCase() !== currentEmail.toLowerCase()) {
    clearOnboardingStash();
    return { applied: false, reason: "email_mismatch" };
  }

  // Same defense: stash older than 24 hours is almost certainly abandoned.
  if (stash.created_at && Date.now() - stash.created_at > 24 * 60 * 60 * 1000) {
    clearOnboardingStash();
    return { applied: false, reason: "stale" };
  }

  // Resolve districts. The street is held in this function's memory only and
  // never written to the DB (the discard policy lives at the api/ boundary).
  let districts = null;
  try {
    const res = await fetch("/api/lookup-districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        street_address: stash.street_address,
        city: stash.city,
        state: stash.state,
        zip_code: stash.zip_code,
      }),
    });
    if (res.ok) {
      districts = await res.json();
      await supabase
        .from("users")
        .update({
          county: districts.county,
          cong_district: districts.cong_district,
          state_senate_dist: districts.state_senate_dist,
          state_house_dist: districts.state_house_dist,
          districts_resolved_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
  } catch (lookupErr) {
    console.warn("District lookup failed during stash apply:", lookupErr);
    // Continue — the votes still need to land.
  }

  // Upsert the onboarding votes. onConflict means if the user has already
  // voted on an issue (e.g. they re-voted from the Dashboard before we
  // got here), the original vote is overwritten by the onboarding one.
  // That's fine — onboarding is the source of truth for the first 10.
  // "Skip" answers don't get persisted at all — the votes table is yes/no
  // boolean, and absent rows correctly drop out of the alignment math.
  const voteRows = (stash.votes || [])
    .filter((v) => v.vote === true || v.vote === false)
    .map((v) => ({
      user_id: userId,
      issue_id: v.issue_id,
      vote: v.vote,
      passion_weight: v.passion_weight,
      last_updated: new Date().toISOString(),
    }));

  if (voteRows.length > 0) {
    const { error: votesErr } = await supabase
      .from("votes")
      .upsert(voteRows, { onConflict: "user_id,issue_id" });
    if (votesErr) {
      return { applied: false, reason: "votes", error: votesErr };
    }
  }

  clearOnboardingStash();
  return { applied: true, districts, voteCount: voteRows.length };
}
