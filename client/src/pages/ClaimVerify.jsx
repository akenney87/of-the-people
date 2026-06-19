// File: client/src/pages/ClaimVerify.jsx
//
// Landing page for the one-time link emailed to an official's on-file address
// (claim flow Phase 2). Reads ?claim=&token= from the URL and verifies the token
// via the claim-email edge function. Token-only: NO login required — possession of
// the one-time, expiring token (sent only to the on-file address) is the proof, so
// the link works from any device or browser. Ownership is granted to the account
// that requested the claim.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const formatName = (name) => {
  if (!name) return "your profile";
  const [s, f] = name.split(", ").map((x) => x.trim());
  return f ? `${f} ${s}` : name;
};

// Soft-failure reasons returned by verify_email_claim -> friendly copy.
const REASONS = {
  expired: "This link has expired. Open the candidate's profile and request a new verification email.",
  bad_token: "This link isn't valid. Request a fresh verification email from the profile page.",
  already_verified: "This profile is already verified — you're all set.",
  already_claimed: "This profile has already been claimed by someone else. If that's a mistake, get in touch.",
  not_found: "We couldn't find that claim. Try starting again from the profile page.",
  not_pending: "This claim is no longer open. Try starting again from the profile page.",
  unknown: "Something went wrong verifying this link. Please try again.",
};

function Shell({ children }) {
  return (
    <div className="max-w-column mx-auto pt-12 animate-rise-in">
      <p className="eyebrow text-vermillion mb-4">Claim verification</p>
      {children}
    </div>
  );
}

export default function ClaimVerify() {
  const [params] = useSearchParams();
  const claim = params.get("claim");
  const token = params.get("token");

  const [phase, setPhase] = useState("working"); // working | success | error
  const [reason, setReason] = useState("");
  const [result, setResult] = useState(null); // { rep_id, rep_name }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!claim || !token) {
        if (!cancelled) { setReason("This link is incomplete. Please use the full link from your email."); setPhase("error"); }
        return;
      }
      const { data, error } = await supabase.functions.invoke("claim-email", {
        body: { action: "verify", claim, token },
      });
      if (cancelled) return;
      if (error) {
        setReason(REASONS.unknown);
        setPhase("error");
        return;
      }
      if (data?.ok) {
        setResult({ rep_id: data.rep_id, rep_name: data.rep_name });
        setPhase("success");
      } else {
        setReason(REASONS[data?.reason] || REASONS.unknown);
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [claim, token]);

  if (phase === "working") {
    return <Shell><p className="font-body text-lede text-ink-soft">Verifying your link…</p></Shell>;
  }

  if (phase === "success") {
    return (
      <Shell>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-verified text-2xl">✓</span>
          <h1 className="font-display text-4xl text-ink leading-tight">You're verified</h1>
        </div>
        <p className="font-body text-lede text-ink-soft mt-4">
          You now manage {formatName(result?.rep_name)}'s profile. Open it to confirm or correct each
          position — your verified answers replace the AI estimates and earn the blue check.
        </p>
        <Link to={`/representatives/${result?.rep_id}`} className="btn-primary mt-6 inline-flex">
          Go to my profile
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink leading-tight">We couldn't verify this link</h1>
      <p className="font-body text-lede text-ink-soft mt-4">{reason}</p>
      <Link to="/ballot" className="btn-secondary mt-6 inline-flex">← Back to your ballot</Link>
    </Shell>
  );
}
