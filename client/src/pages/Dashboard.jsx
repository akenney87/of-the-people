// File: client/src/pages/Dashboard.jsx
//
// "The issue feed" — editorial broadsheet of policy issues. One card per
// issue. After casting a vote, a Vote Impact overlay slides up showing the
// user's live alignment scores with every elected official, fetched from
// the get_my_representatives + get_my_alignment RPCs in Supabase.
import { useState, useEffect, useCallback } from "react";
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

const ORDER_BUCKETS = (pos) => {
  if (pos === 'U.S. Senator') return 1;
  if (pos === 'U.S. Representative') return 2;
  if (pos === 'Governor') return 10;
  if (pos === 'Lieutenant Governor') return 11;
  if (pos === 'Attorney General') return 12;
  if (pos === 'Secretary of State') return 13;
  if (pos === 'State Senator') return 20;
  if (pos === 'State Representative' || pos === 'Assembly Member') return 21;
  if (pos === 'County Commission Chair' || pos.startsWith('County Commissioner')) return 30;
  if (pos === 'County Sheriff') return 31;
  if (pos === 'District Attorney') return 32;
  if (pos.startsWith('County')) return 33;
  if (pos === 'Mayor') return 40;
  if (pos.startsWith('City Council')) return 41;
  return 99;
};

export default function Dashboard() {
  const [votes, setVotes] = useState({});               // {issueId: bool}
  const [passion, setPassion] = useState({});            // {issueId: 1..5}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(null);   // currently focused issue id
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [submittingId, setSubmittingId] = useState(null);
  const [reps, setReps] = useState([]);                  // cached for overlay
  const [alignments, setAlignments] = useState({});      // {repId: pct}
  const [overlayIssue, setOverlayIssue] = useState(null);

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
        setVotes(v); setPassion(p);

        // Prefetch reps so the Vote Impact overlay opens instantly on first vote.
        const { data: repRows } = await supabase.rpc("get_my_representatives");
        if (repRows) setReps([...repRows].sort((a, b) => ORDER_BUCKETS(a.position) - ORDER_BUCKETS(b.position)));
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

      // Recompute alignment for every rep — just the ones we already have.
      const scores = { ...alignments };
      for (const rep of reps) {
        const { data: pct, error: rpcErr } = await supabase.rpc("get_my_alignment", { p_rep_id: rep.id });
        if (!rpcErr) scores[rep.id] = pct;
      }
      setAlignments(scores);
      setOverlayIssue(issueId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save that vote.");
    } finally { setSubmittingId(null); }
  }, [votes, passion, alignments, reps]);

  // ------------------------------------------------------------------ filters
  const filtered = issuesList.filter((issue) => {
    const matchesSearch = issue.text.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'national') return issue.scope === 'national';
    if (activeTab === 'state')    return issue.scope === 'state';
    if (activeTab === 'local')    return issue.scope === 'county' || issue.scope === 'city';
    return true;
  });

  // ------------------------------------------------------------------ render
  if (loading) {
    return (
      <div className="max-w-spread mx-auto px-2 md:px-6 py-12">
        <p className="eyebrow text-ink-faint">Setting the type…</p>
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
            ['all',      `All · ${issuesList.length}`],
            ['national', `National · ${issuesList.filter(i=>i.scope==='national').length}`],
            ['state',    `Georgia · ${issuesList.filter(i=>i.scope==='state').length}`],
            ['local',    `Local · ${issuesList.filter(i=>i.scope==='county'||i.scope==='city').length}`],
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
          const cast = myVote !== undefined;
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
                {cast && (
                  <span className="font-mono text-eyebrow text-ink-soft uppercase tracking-eyebrow">
                    {myVote ? '✓ Yes' : '✕ No'} · P{myPassion}
                  </span>
                )}
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
                  {submittingId === issue.id
                    ? 'Recording…'
                    : cast ? 'Update vote' : 'Cast vote'}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* Vote Impact overlay */}
      {overlayIssue !== null && (
        <VoteImpactOverlay
          issue={issuesList.find(i => i.id === overlayIssue)}
          reps={reps}
          alignments={alignments}
          onClose={() => setOverlayIssue(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function VoteImpactOverlay({ issue, reps, alignments, onClose }) {
  const groupOrder = [
    { key: 'federal', label: 'United States Congress',     match: r => r.position.startsWith('U.S.') },
    { key: 'gaexec',  label: 'Georgia, Executive',          match: r => ['Governor','Lieutenant Governor','Attorney General','Secretary of State'].includes(r.position) },
    { key: 'galeg',   label: 'Georgia, Legislature',        match: r => ['State Senator','State Representative','Assembly Member'].includes(r.position) },
    { key: 'county',  label: 'Hall County',                 match: r => r.county === 'Hall' && !r.city && r.position !== 'U.S. Representative' && !['U.S. Senator','Governor','Lieutenant Governor','Attorney General','Secretary of State','State Senator','State Representative','Assembly Member'].includes(r.position) },
    { key: 'city',    label: 'City of Gainesville',         match: r => r.city === 'Gainesville' },
  ];
  const seen = new Set();
  const groups = groupOrder.map(g => {
    const items = reps.filter(r => !seen.has(r.id) && g.match(r));
    items.forEach(r => seen.add(r.id));
    return { ...g, items };
  }).filter(g => g.items.length > 0);

  const formatName = (name) => {
    if (!name) return '';
    const [surname, firstname] = name.split(', ').map(s => s.trim());
    return firstname ? `${firstname} ${surname}` : name;
  };

  return (
    <div className="fixed inset-0 z-50 bg-paper/95 backdrop-blur-sm flex items-stretch animate-ink-fade">
      <div className="w-full max-w-3xl mx-auto h-full overflow-y-auto px-6 md:px-12 py-12 md:py-16 animate-rise-in">
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p className="eyebrow text-vermillion">Vote recorded</p>
            <h2
              className="font-display text-h3 md:text-h2 leading-[1.05] mt-3 text-ink"
              style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
            >
              How your representatives stack up.
            </h2>
            <p className="font-body text-caption text-ink-soft mt-3 max-w-xl border-t border-rule pt-3">
              On <span className="italic">&ldquo;{issue.text}&rdquo;</span> and every
              vote you&apos;ve cast so far. A dash means we don&apos;t yet have
              the rep&apos;s position on enough of your issues. The blue-check
              inference pipeline (Phase 3) will close those gaps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="eyebrow text-ink-soft hover:text-ink shrink-0"
          >
            Close ×
          </button>
        </div>

        {groups.length === 0 && (
          <p className="font-body text-lede text-ink-soft">
            You don&apos;t have any representatives matched to your address yet.
            Check that your profile address is set.
          </p>
        )}

        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <h3 className="eyebrow text-ink">{g.label}</h3>
                <span className="folio">{g.items.length} {g.items.length === 1 ? 'official' : 'officials'}</span>
              </div>
              <ul className="mt-3">
                {g.items.map((rep) => {
                  const pct = alignments[rep.id];
                  const display = (pct == null) ? '—' : `${pct}%`;
                  const isStrong = pct != null && pct >= 70;
                  const isWeak   = pct != null && pct < 40;
                  return (
                    <li key={rep.id} className="ledger-row group">
                      <div>
                        <p className="font-body text-base md:text-lg text-ink">
                          {formatName(rep.name)}
                        </p>
                        <p className="eyebrow text-ink-faint mt-1">
                          {rep.position}{rep.party ? ` · ${rep.party}` : ''}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`font-mono tabular-nums text-lg md:text-xl ${
                          isStrong ? 'text-vermillion' :
                          isWeak   ? 'text-ink-soft' : 'text-ink'
                        }`}>
                          {display}
                        </span>
                        {pct != null && isStrong && (
                          <span className="eyebrow text-vermillion">aligned</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t-2 border-ink pt-6 flex items-center justify-between">
          <button onClick={onClose} className="btn-ghost">
            ← Back to the feed
          </button>
          <button onClick={onClose} className="btn-primary">
            Next issue
          </button>
        </div>
      </div>
    </div>
  );
}
