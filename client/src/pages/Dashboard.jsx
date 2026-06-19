// File: client/src/pages/Dashboard.jsx
//
// "The Issue Feed" — an editorial broadsheet of policy issues, one card per issue.
// Only issues you HAVEN'T voted on yet appear here; the moment you cast a vote the
// card leaves the feed (revisit or change it anytime in "My Votes"). Casting a vote
// simply records it — there's no post-vote overlay. (We dropped the old "how your
// reps stack up" overlay: until candidate coverage is deep, a per-issue comparison
// isn't meaningful yet.)
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { applyOnboardingStash } from "../lib/onboarding";
import issuesList from "../../../shared/issues.json";

const SCOPE_LABEL = {
  national: "National",
  state:    "Georgia",
  county:   "Hall County",
  city:     "Gainesville",
};
const SCOPE_ACCENT = {
  national: 'text-navy',
  state:    'text-vermillion',
  county:   'text-ink',
  city:     'text-gold',
};
const PASSION_WORDS = ['Indifferent', 'Mild', 'Concerned', 'Strong', 'Defining'];

export default function Dashboard() {
  const [votes, setVotes] = useState({});               // {issueId: bool} — live Yes/No selection
  const [passion, setPassion] = useState({});           // {issueId: 1..5}
  const [votedIds, setVotedIds] = useState(() => new Set()); // persisted votes -> hidden from the feed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [submittingId, setSubmittingId] = useState(null);

  // ------------------------------------------------------------------ init
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const result = await applyOnboardingStash(user.id, user.email);
          if (result.applied) console.log(`Applied onboarding stash: ${result.voteCount} votes`);
        }
        const { data, error: fetchErr } = await supabase
          .from("votes")
          .select("issue_id, vote, passion_weight");
        if (fetchErr) throw fetchErr;
        const v = {}, p = {};
        (data || []).forEach((r) => { v[r.issue_id] = r.vote; p[r.issue_id] = r.passion_weight; });
        setVotes(v);
        setPassion(p);
        setVotedIds(new Set((data || []).map((r) => r.issue_id)));
      } catch (err) {
        console.error(err);
        setError("Couldn't load your feed.");
      } finally { setLoading(false); }
    };
    init();
  }, []);

  // ------------------------------------------------------------------ helpers
  const setVote = (id, v) => setVotes(prev => ({ ...prev, [id]: v }));
  const setPassionFor = (id, v) => setPassion(prev => ({ ...prev, [id]: v }));

  const submitVote = useCallback(async (issueId) => {
    const v = votes[issueId];
    const p = passion[issueId] ?? 3;
    if (v === undefined) return;
    setSubmittingId(issueId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: upErr } = await supabase.from("votes").upsert(
        { user_id: user.id, issue_id: issueId, vote: v, passion_weight: p, last_updated: new Date().toISOString() },
        { onConflict: "user_id,issue_id" }
      );
      if (upErr) throw upErr;
      // Recorded — drop it from the feed. It now lives in "My Votes," where it can be changed.
      setVotedIds(prev => new Set(prev).add(issueId));
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save that vote.");
    } finally { setSubmittingId(null); }
  }, [votes, passion]);

  // ------------------------------------------------------------------ data
  // The feed only shows issues the user hasn't voted on yet.
  const unvoted = issuesList.filter((i) => !votedIds.has(i.id));
  const filtered = unvoted.filter((issue) => {
    const matchesSearch = issue.text.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'national') return issue.scope === 'national';
    if (activeTab === 'state')    return issue.scope === 'state';
    if (activeTab === 'local')    return issue.scope === 'county' || issue.scope === 'city';
    return true;
  });
  const countByScope = (pred) => unvoted.filter(pred).length;
  const allDone = unvoted.length === 0;

  // ------------------------------------------------------------------ render
  if (loading) {
    return (
      <div className="max-w-spread mx-auto px-2 md:px-6 py-12">
        <p className="eyebrow text-ink-faint">Setting the type…</p>
      </div>
    );
  }

  // Everything answered — point them to their record.
  if (allDone) {
    return (
      <div className="max-w-spread mx-auto">
        <header className="border-b-2 border-ink pb-6">
          <p className="eyebrow text-vermillion">The Issue Feed</p>
          <h1
            className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
          >
            You&apos;ve weighed in on every issue.
          </h1>
          <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
            That&apos;s the whole question bank. Revisit or change any of your positions anytime — they
            keep refining your alignment with the people who represent you.
          </p>
          <Link to="/votes" className="btn-primary mt-6 inline-flex">Review your votes</Link>
        </header>
      </div>
    );
  }

  return (
    <div className="max-w-spread mx-auto">
      {/* Masthead */}
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">The Issue Feed</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          {filtered.length} questions awaiting your judgment.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          Read each one, take a position, set how strongly you feel. Every
          vote refines your alignment with the people who represent you.
        </p>
      </header>

      {/* Filters */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end pb-6 border-b border-rule">
        <div className="md:col-span-6">
          <label className="field-label">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field"
            placeholder="Find an issue…"
          />
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-2">
          {[
            ['all',      `All · ${unvoted.length}`],
            ['national', `National · ${countByScope(i => i.scope === 'national')}`],
            ['state',    `Georgia · ${countByScope(i => i.scope === 'state')}`],
            ['local',    `Local · ${countByScope(i => i.scope === 'county' || i.scope === 'city')}`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`font-ui uppercase tracking-eyebrow text-xs font-medium px-3 py-2 border transition-colors ${
                activeTab === key
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink-soft border-rule-soft hover:text-ink hover:border-ink'
              }`}
              style={{ borderRadius: 2 }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="my-6 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
          {error}
        </div>
      )}

      {/* Issue grid — single column on mobile, broadsheet 2-col on lg */}
      <section className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.length === 0 && (
          <p className="font-body text-lede text-ink-soft col-span-full">
            Nothing matches. Try a different search.
          </p>
        )}

        {filtered.map((issue, idx) => {
          const myVote = votes[issue.id];
          const myPassion = passion[issue.id] ?? 3;
          return (
            <article
              key={issue.id}
              className="relative card animate-rise-in"
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="folio">No. {String(issue.id).padStart(3, '0')}</p>
                  <p className={`eyebrow mt-1 ${SCOPE_ACCENT[issue.scope] || 'text-ink-soft'}`}>
                    {SCOPE_LABEL[issue.scope] || issue.scope}
                  </p>
                </div>
              </header>

              <h2
                className="font-display text-h4 md:text-[1.625rem] leading-[1.15] mt-5 text-ink"
                style={{ fontVariationSettings: '"opsz" 60, "wght" 500' }}
              >
                {issue.text}
              </h2>

              {/* Action row */}
              <div className="mt-7 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setVote(issue.id, true)}
                  className={`font-ui uppercase tracking-eyebrow text-sm py-3 border-2 transition-all ${
                    myVote === true
                      ? 'bg-yes border-yes text-paper'
                      : 'border-yes text-yes hover:bg-yes hover:text-paper'
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setVote(issue.id, false)}
                  className={`font-ui uppercase tracking-eyebrow text-sm py-3 border-2 transition-all ${
                    myVote === false
                      ? 'bg-no border-no text-paper'
                      : 'border-no text-no hover:bg-no hover:text-paper'
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  No
                </button>
              </div>

              {/* Passion */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="eyebrow text-ink-soft">Passion</span>
                  <span className="font-mono text-caption text-ink tabular-nums">
                    {myPassion}/5 · {PASSION_WORDS[myPassion - 1]}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={myPassion}
                  onChange={(e) => setPassionFor(issue.id, Number(e.target.value))}
                  className="passion-range"
                />
              </div>

              {/* Submit */}
              <div className="mt-7 border-t border-rule-soft pt-5 flex items-center justify-end">
                <button
                  onClick={() => submitVote(issue.id)}
                  disabled={myVote === undefined || submittingId === issue.id}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submittingId === issue.id ? 'Recording…' : 'Cast vote'}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
