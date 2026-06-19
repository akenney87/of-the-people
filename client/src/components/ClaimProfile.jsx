// File: client/src/components/ClaimProfile.jsx
//
// The "blue check" entry point, shown in the candidate profile sidebar. Keeps
// the rep/candidate's path deliberately SIMPLE: one screen, a role tap, and an
// optional link — no uploads. Submitting records a pending official_claims row;
// an admin (or, later, an official-email link) approves it via approve_claim().
// Ownership is rep-level (representatives.claimed_by_user_id); once approved the
// official gets edit rights on their positions (RLS-enforced).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { supabase } from "../lib/supabaseClient";

const formatName = (name) => {
  if (!name) return "";
  const [s, f] = name.split(", ").map((x) => x.trim());
  return f ? `${f} ${s}` : name;
};

const ROLES = [
  ["official", "I'm the official"],
  ["staff", "I'm on their staff"],
  ["candidate", "I'm the candidate"],
  ["campaign", "I'm on their campaign"],
];

// Shared card shell so every state looks consistent in the sidebar.
function Card({ children }) {
  return <div className="mt-10 border border-rule-soft p-6 bg-paper-warm">{children}</div>;
}
Card.propTypes = { children: PropTypes.node };

export default function ClaimProfile({ rep }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [claim, setClaim] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState("official");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error
  const [sentTo, setSentTo] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (cancelled) return;
      setUser(u);
      if (u) {
        const { data: rows } = await supabase
          .from("official_claims")
          .select("id,status,method")
          .eq("rep_id", rep.id)
          .eq("user_id", u.id)
          .order("submitted_at", { ascending: false })
          .limit(1);
        if (!cancelled) setClaim(rows?.[0] ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [rep.id]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { data, error: insErr } = await supabase
      .from("official_claims")
      .insert({
        rep_id: rep.id,
        user_id: user.id,
        claimant_role: role,
        evidence_url: evidenceUrl.trim() || null,
        note: note.trim() || null,
        method: "manual",
      })
      .select("id,status")
      .single();
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message || "Couldn't submit. Please try again.");
      return;
    }
    setClaim(data);
    setShowForm(false);
  };

  // One-click path: email a verification link to the address already on file.
  const EMAIL_ERRORS = {
    no_email_on_file: "There's no official email on file for this profile. Use manual review instead.",
    email_not_configured: "Email verification isn't available right now. Use manual review instead.",
    email_send_failed: "We couldn't send the email just now. Try again, or use manual review.",
    already_claimed: "This profile has just been claimed by someone else.",
  };
  const requestEmail = async () => {
    setEmailState("sending");
    setEmailError("");
    const { data, error: fnErr } = await supabase.functions.invoke("claim-email", {
      body: { action: "request", rep_id: rep.id, role: "official" },
    });
    if (fnErr || !data?.ok) {
      // invoke surfaces non-2xx as fnErr; our soft errors come back on data.error
      const code = data?.error || "email_send_failed";
      setEmailError(EMAIL_ERRORS[code] || "We couldn't send the email. Try manual review.");
      setEmailState("error");
      return;
    }
    setSentTo(data.sent_to || "your official email");
    setEmailState("sent");
  };

  // --- Already claimed ---
  if (rep.claimed_by_user_id) {
    const mine = user && rep.claimed_by_user_id === user.id;
    return (
      <Card>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-verified text-lg">✓</span>
          <p className="eyebrow text-ink">{mine ? "You manage this profile" : "Claimed & verified"}</p>
        </div>
        <p className="font-body text-caption text-ink-soft mt-3">
          {mine
            ? "You’ve claimed this profile. You can confirm or correct each position below — verified answers replace the AI estimates."
            : `Positions marked “verified by candidate” were confirmed by ${formatName(rep.name)} or their office.`}
        </p>
      </Card>
    );
  }

  // --- Loading auth ---
  if (user === undefined) return <Card><p className="eyebrow text-ink-faint">…</p></Card>;

  // --- Existing claim by this user ---
  // An email-method pending claim that we just (re)sent shows the inbox prompt below instead.
  if (claim?.status === "pending" && !(claim.method === "email" && emailState === "sent")) {
    const viaEmail = claim.method === "email";
    return (
      <Card>
        <p className="eyebrow text-ink">{viaEmail ? "Check your email" : "Claim under review"}</p>
        <p className="font-body text-caption text-ink-soft mt-3">
          {viaEmail
            ? `We sent a verification link to ${formatName(rep.name)}’s official email on file. Click it (signed in as this account) to finish — it expires in an hour.`
            : `Thanks — we’re reviewing your request to manage ${formatName(rep.name)}’s profile and will be in touch.`}
        </p>
      </Card>
    );
  }

  // --- Signed out ---
  if (!user) {
    return (
      <Card>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-verified text-lg">✓</span>
          <p className="eyebrow text-ink">Not yet verified</p>
        </div>
        <p className="font-body text-caption text-ink-soft mt-3">
          Are you {formatName(rep.name)}, or on their staff or campaign? The positions
          below are AI-estimated. Sign in to claim this profile and verify them yourself.
        </p>
        <Link to="/login" className="btn-secondary mt-5 inline-flex">Sign in to claim</Link>
      </Card>
    );
  }

  // --- Signed in: claim CTA or form ---
  return (
    <Card>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-verified text-lg">✓</span>
        <p className="eyebrow text-ink">Not yet verified</p>
      </div>

      {emailState === "sent" ? (
        <>
          <p className="font-body text-caption text-ink-soft mt-3">
            We sent a verification link to <span className="font-mono text-ink">{sentTo}</span>. Open it
            (signed in as this account) to claim {formatName(rep.name)}’s profile — it expires in an hour.
          </p>
          <p className="font-body text-caption text-ink-faint mt-3">
            Didn’t get it? Check spam, or <button type="button" className="underline hover:text-vermillion" onClick={requestEmail}>send it again</button>.
          </p>
        </>
      ) : !showForm ? (
        <>
          <p className="font-body text-caption text-ink-soft mt-3">
            Are you {formatName(rep.name)}, or on their staff or campaign? Claim this
            profile to confirm or correct the AI-estimated positions below.
          </p>
          {claim?.status === "rejected" && (
            <p className="font-body text-caption text-ink-faint mt-2 italic">
              A previous claim wasn’t approved. You can submit again with more detail.
            </p>
          )}
          {emailError && (
            <p className="font-body text-caption text-vermillion-deep mt-3">{emailError}</p>
          )}

          {rep.email ? (
            <>
              {/* Fastest path: one click, verify via the official email already on file. */}
              <button className="btn-primary mt-5 inline-flex justify-center" onClick={requestEmail} disabled={emailState === "sending"}>
                {emailState === "sending" ? "Sending…" : "Verify with your official email"}
              </button>
              <p className="font-body text-caption text-ink-faint mt-3">
                Can’t access that inbox?{" "}
                <button type="button" className="underline hover:text-vermillion" onClick={() => setShowForm(true)}>
                  Request manual review
                </button>
              </p>
            </>
          ) : (
            <button className="btn-secondary mt-5 inline-flex" onClick={() => setShowForm(true)}>
              Claim this profile
            </button>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-5">
          {error && (
            <div className="px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
              {error}
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="claim-role">Your role</label>
            <select id="claim-role" className="field" value={role} onChange={(e) => setRole(e.target.value)} disabled={submitting}>
              {ROLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="claim-evidence">
              Link that confirms you <span className="text-ink-faint">(optional)</span>
            </label>
            <input
              id="claim-evidence" type="url" className="field"
              placeholder="Official site, campaign page, or .gov email page"
              value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} disabled={submitting}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="claim-note">
              Anything to add <span className="text-ink-faint">(optional)</span>
            </label>
            <textarea
              id="claim-note" className="field" rows={2}
              value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting}
            />
          </div>
          <p className="font-body text-caption text-ink-faint">
            We verify before granting access — fastest if your official email is on file.
          </p>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary justify-center" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit claim"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

ClaimProfile.propTypes = {
  rep: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string,
    email: PropTypes.string,
    claimed_by_user_id: PropTypes.string,
  }).isRequired,
};
