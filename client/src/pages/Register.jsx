// File: client/src/pages/Register.jsx
//
// Two-step registration:
//   1) Address + credentials (one well-spaced form)
//   2) Ten onboarding issues, one per "page", with a passion slider
// After submit the on_auth_user_created trigger seeds public.users, the
// localStorage stash gets flushed on the first Dashboard mount, and the
// user lands on the dashboard with all 10 votes already in place.
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { stashOnboarding, applyOnboardingStash } from "../lib/onboarding";
import allIssues from "../../../shared/issues.json";

const ONBOARDING_ISSUES = allIssues.filter((i) => i.onboarding);
const SCOPE_LABEL = {
  national: 'National', state: 'Georgia',
  county: 'Hall County', city: 'Gainesville',
};
const PASSION_WORDS = ['Indifferent', 'Mild', 'Concerned', 'Strong', 'Defining'];

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);             // 1 = form, 2 = issues, 3 = confirm
  const [userData, setUserData] = useState({
    email: "", password: "", confirmPassword: "",
    street_address: "", city: "", state: "GA", zip_code: "",
  });
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [votes, setVotes] = useState([]);
  const [passion, setPassion] = useState(3);
  const [selectedVote, setSelectedVote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const goToIssues = (e) => {
    e?.preventDefault();
    if (!userData.email || !userData.password || !userData.confirmPassword
        || !userData.street_address || !userData.city || !userData.zip_code) {
      setError("All fields are required.");
      return;
    }
    if (userData.password !== userData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (userData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleVote = async () => {
    if (selectedVote === null || loading) return;
    const issue = ONBOARDING_ISSUES[currentIssueIndex];
    const newVote = { issue_id: issue.id, vote: selectedVote, passion_weight: passion };
    const updatedVotes = [...votes, newVote];

    setVotes(updatedVotes);
    setSelectedVote(null);
    setPassion(3);

    if (currentIssueIndex < ONBOARDING_ISSUES.length - 1) {
      setCurrentIssueIndex(currentIssueIndex + 1);
    } else {
      setLoading(true);
      await submitRegistration(updatedVotes);
    }
  };

  const goBack = () => {
    if (currentIssueIndex > 0) {
      setCurrentIssueIndex(currentIssueIndex - 1);
      setVotes(votes.slice(0, -1));
      setSelectedVote(null);
      setPassion(3);
    }
  };

  const submitRegistration = async (finalVotes) => {
    try {
      stashOnboarding({
        email:          userData.email,
        street_address: userData.street_address,
        city:           userData.city,
        state:          userData.state,
        zip_code:       userData.zip_code,
        votes:          finalVotes,
      });
      const { data: signUp, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            city:     userData.city,
            state:    userData.state,
            zip_code: userData.zip_code,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (signUp.session && signUp.user) {
        await applyOnboardingStash(signUp.user.id, signUp.user.email);
      }
      setStep(3);
    } catch (err) {
      console.error("Registration failed:", err);
      setError("Registration failed: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  if (step === 3) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="border-b border-rule">
          <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
            <span className="eyebrow text-ink-faint">Registration</span>
            <Link to="/login" className="eyebrow text-ink-faint hover:text-ink">Sign in →</Link>
          </div>
        </header>
        <main className="flex-1 max-w-column w-full mx-auto px-6 md:px-12 py-24 animate-rise-in">
          <p className="eyebrow text-vermillion mb-6">Welcome aboard</p>
          <h1
            className="font-display text-h2 leading-[1.02] text-ink mb-6"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
          >
            Check your inbox.
          </h1>
          <p className="font-body text-lede text-ink-soft border-t border-rule pt-5 mb-10">
            We&apos;ve sent a confirmation link to{' '}
            <span className="text-ink font-semibold">{userData.email}</span>.
            Click it and you&apos;re in — your ten onboarding votes,
            districts, and Gainesville representatives will be waiting on
            the issue feed.
          </p>
          <button onClick={() => navigate('/login')} className="btn-secondary">
            Go to sign in
          </button>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  if (step === 2) {
    const issue = ONBOARDING_ISSUES[currentIssueIndex];
    const progress = ((currentIssueIndex + 1) / ONBOARDING_ISSUES.length) * 100;

    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="border-b border-rule">
          <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
            <span className="eyebrow text-vermillion">Onboarding</span>
            <span className="eyebrow text-ink-faint">
              {String(currentIssueIndex + 1).padStart(2, '0')} of {String(ONBOARDING_ISSUES.length).padStart(2, '0')}
            </span>
          </div>
          {/* Progress hairline */}
          <div className="h-px bg-rule-soft">
            <div
              className="h-px bg-vermillion transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <main key={issue.id} className="flex-1 max-w-3xl w-full mx-auto px-6 md:px-12 py-12 md:py-16 animate-ink-fade">
          <p className="folio mb-2">No. {String(issue.id).padStart(3, '0')}</p>
          <p className="eyebrow text-ink-soft mb-8">{SCOPE_LABEL[issue.scope] || issue.scope}</p>

          <h2
            className="font-display text-[2.25rem] md:text-h2 leading-[1.05] text-ink"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 500, "SOFT" 0' }}
          >
            {issue.text}
          </h2>

          <div className="mt-12 grid grid-cols-3 gap-3 max-w-xl">
            {[
              { val: true,  label: 'Yes', cls: 'border-yes text-yes hover:bg-yes hover:text-paper' },
              { val: null,  label: 'Skip', cls: 'border-ink-soft text-ink-soft hover:bg-ink-soft hover:text-paper' },
              { val: false, label: 'No',  cls: 'border-no text-no hover:bg-no hover:text-paper' },
            ].map(opt => {
              const active = selectedVote === opt.val && !(opt.val === null && selectedVote === null);
              const activeStyle =
                opt.val === true  ? 'bg-yes text-paper border-yes' :
                opt.val === false ? 'bg-no text-paper border-no' :
                                    'bg-ink-soft text-paper border-ink-soft';
              // We treat "Skip" as selectedVote === 'skip' to distinguish from "unchosen"
              const isPicked =
                (opt.val === true && selectedVote === true)
                || (opt.val === false && selectedVote === false)
                || (opt.val === null && selectedVote === 'skip');
              return (
                <button
                  key={opt.label}
                  onClick={() => setSelectedVote(opt.val === null ? 'skip' : opt.val)}
                  className={`font-ui uppercase tracking-eyebrow text-sm font-semibold py-4 border-2 transition-all duration-150 ${
                    isPicked ? activeStyle : `bg-transparent ${opt.cls}`
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-14 max-w-xl">
            <div className="flex items-baseline justify-between mb-4">
              <span className="eyebrow text-ink-soft">How strongly do you feel?</span>
              <span className="font-mono text-caption text-ink tabular-nums">
                {passion} / 5 · {PASSION_WORDS[passion - 1]}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={passion}
              onChange={(e) => setPassion(Number(e.target.value))}
              className="passion-range"
            />
            <div className="mt-2 grid grid-cols-5 font-mono text-eyebrow text-ink-faint">
              {[1,2,3,4,5].map(n => <span key={n} className="tabular-nums">{n}</span>)}
            </div>
          </div>

          {error && (
            <div className="mt-10 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
              {error}
            </div>
          )}

          <div className="mt-14 flex items-center justify-between border-t border-rule pt-6">
            <button
              onClick={goBack}
              disabled={loading || currentIssueIndex === 0}
              className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={handleVote}
              disabled={selectedVote === null || loading}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Submitting…'
                : currentIssueIndex === ONBOARDING_ISSUES.length - 1
                  ? 'Cast & finish'
                  : 'Cast vote'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ----- STEP 1: Address + credentials ----------------------------------
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
          <Link to="/login" className="eyebrow text-ink-faint hover:text-ink">← Already a reader?</Link>
          <span className="eyebrow text-ink-faint">Account setup · 1 of 2</span>
        </div>
      </header>

      <main className="flex-1 max-w-spread w-full mx-auto px-6 md:px-12 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 animate-rise-in">
        <section className="lg:col-span-5">
          <p className="eyebrow text-vermillion mb-6">Subscribe</p>
          <h1
            className="font-display text-[2.5rem] md:text-h1 leading-[0.95] text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
          >
            Pull up a chair.
          </h1>
          <p className="font-body text-lede text-ink-soft mt-8 border-t border-rule pt-5 max-w-md">
            Two short steps. We need your address so we can match you to the
            right ballot — federal down to city council — and ten questions
            so we know what you actually care about.
          </p>

          <ul className="mt-10 space-y-4 max-w-md">
            {[
              ['Street stays here.', 'We geocode your address once and discard it. Only your district IDs and ZIP are stored.'],
              ['No tracking, no ads.', 'Non-profit; we don\'t monetize what you tell us.'],
              ['Ten questions.', 'Then you\'re on the issue feed with a full alignment scorecard.'],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-4 border-t border-rule-soft pt-4">
                <span className="font-mono text-caption text-vermillion shrink-0 mt-1">▸</span>
                <div>
                  <p className="font-ui text-sm uppercase tracking-eyebrow text-ink font-semibold">{k}</p>
                  <p className="font-body text-caption text-ink-soft mt-1">{v}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-7 lg:pl-12 lg:border-l lg:border-rule">
          {error && (
            <div className="mb-6 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
              {error}
            </div>
          )}
          <form onSubmit={goToIssues} className="space-y-7">
            <p className="eyebrow text-ink-soft">Credentials</p>
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={userData.email}
                onChange={handleChange}
                className="field"
                placeholder="you@somewhere.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
              <div>
                <label htmlFor="password" className="field-label">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={userData.password}
                  onChange={handleChange}
                  className="field"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="field-label">Confirm</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={userData.confirmPassword}
                  onChange={handleChange}
                  className="field"
                  placeholder="Match the above"
                />
              </div>
            </div>

            <p className="eyebrow text-ink-soft pt-6">Address</p>
            <div>
              <label htmlFor="street_address" className="field-label">Street</label>
              <input
                id="street_address"
                name="street_address"
                type="text"
                value={userData.street_address}
                onChange={handleChange}
                className="field"
                placeholder="123 Green St SW"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-7">
              <div className="col-span-2">
                <label htmlFor="city" className="field-label">City</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={userData.city}
                  onChange={handleChange}
                  className="field"
                  placeholder="Gainesville"
                />
              </div>
              <div>
                <label htmlFor="state" className="field-label">State</label>
                <select
                  id="state"
                  name="state"
                  value={userData.state}
                  onChange={handleChange}
                  className="field font-body bg-transparent"
                >
                  <option value="GA">GA</option>
                </select>
              </div>
              <div>
                <label htmlFor="zip_code" className="field-label">ZIP</label>
                <input
                  id="zip_code"
                  name="zip_code"
                  type="text"
                  value={userData.zip_code}
                  onChange={handleChange}
                  className="field font-mono tabular-nums"
                  placeholder="30501"
                />
              </div>
            </div>

            <div className="pt-6">
              <button type="submit" className="btn-primary">
                Continue → ten questions
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
