// File: src/pages/MyVotes.jsx
//
// "Your Record" — a clean ledger of every vote the user has cast, with
// inline editing. Treated like a personal voting log of record.
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import issuesList from "../../../shared/issues.json";

const PASSION_WORDS = ['Indifferent', 'Mild', 'Concerned', 'Strong', 'Defining'];
const SCOPE_LABEL = { national: "National", state: "Georgia", county: "Hall County", city: "Gainesville" };

const getIssue = (id) => issuesList.find((i) => i.id === parseInt(id)) || null;

export default function MyVotes() {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("votes")
      .select("issue_id, vote, passion_weight, last_updated")
      .order("last_updated", { ascending: false });
    if (fetchErr) setError(fetchErr.message);
    else setVotes(data || []);
    setLoading(false);
  };

  const updateLocal = (issueId, patch) => {
    setVotes(prev => prev.map(v => v.issue_id === issueId ? { ...v, ...patch } : v));
  };

  const saveVote = async (issueId) => {
    const v = votes.find(x => x.issue_id === issueId);
    if (!v) return;
    setSavingId(issueId);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("Not signed in.");
      const nowIso = new Date().toISOString();
      const { error: e } = await supabase.from("votes").update({
        vote: v.vote, passion_weight: v.passion_weight, last_updated: nowIso,
      }).eq("user_id", userId).eq("issue_id", issueId);
      if (e) throw e;
      updateLocal(issueId, { last_updated: nowIso });
      setSavedId(issueId);
      setTimeout(() => setSavedId(null), 2400);
    } catch (err) {
      setError(err.message);
    } finally { setSavingId(null); }
  };

  const filtered = votes.filter(v => {
    const i = getIssue(v.issue_id);
    if (!i) return false;
    return i.text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-spread mx-auto animate-rise-in">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">Your Record</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          {votes.length} {votes.length === 1 ? 'vote' : 'votes'} cast so far.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          Every position you&apos;ve taken. You can change your mind any
          time — adjustments propagate to your alignment scores immediately.
        </p>
      </header>

      <section className="mt-8 pb-6 border-b border-rule max-w-xl">
        <label className="field-label">Search your votes</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field"
          placeholder="Find an issue you voted on…"
        />
      </section>

      {error && (
        <div className="mt-6 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
          {error}
        </div>
      )}

      {loading && (
        <p className="mt-12 eyebrow text-ink-faint">Setting the type…</p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="mt-12 font-body text-lede text-ink-soft">
          {votes.length === 0
            ? "You haven't cast any votes yet. Visit the issue feed to start."
            : "Nothing matches your search."}
        </p>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((v, idx) => {
          const issue = getIssue(v.issue_id);
          if (!issue) return null;
          const saved = savedId === v.issue_id;
          const saving = savingId === v.issue_id;

          return (
            <article
              key={v.issue_id}
              className="card animate-rise-in"
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="folio">No. {String(issue.id).padStart(3, '0')}</p>
                  <p className="eyebrow text-ink-soft mt-1">{SCOPE_LABEL[issue.scope] || issue.scope}</p>
                </div>
                <p className="font-mono text-eyebrow text-ink-faint tabular-nums shrink-0 text-right">
                  Last updated<br />{v.last_updated ? format(new Date(v.last_updated), "MMM d, yyyy") : '—'}
                </p>
              </header>

              <h2
                className="font-display text-h4 md:text-[1.625rem] leading-[1.15] mt-5 text-ink"
                style={{ fontVariationSettings: '"opsz" 60, "wght" 500' }}
              >
                {issue.text}
              </h2>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateLocal(v.issue_id, { vote: true })}
                  className={`font-ui uppercase tracking-eyebrow text-sm py-3 border-2 transition-all ${
                    v.vote === true ? 'bg-yes border-yes text-paper' : 'border-yes text-yes hover:bg-yes hover:text-paper'
                  }`}
                  style={{ borderRadius: 2 }}
                >Yes</button>
                <button
                  onClick={() => updateLocal(v.issue_id, { vote: false })}
                  className={`font-ui uppercase tracking-eyebrow text-sm py-3 border-2 transition-all ${
                    v.vote === false ? 'bg-no border-no text-paper' : 'border-no text-no hover:bg-no hover:text-paper'
                  }`}
                  style={{ borderRadius: 2 }}
                >No</button>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="eyebrow text-ink-soft">Passion</span>
                  <span className="font-mono text-caption text-ink tabular-nums">
                    {v.passion_weight}/5 · {PASSION_WORDS[v.passion_weight - 1]}
                  </span>
                </div>
                <input
                  type="range" min="1" max="5"
                  value={v.passion_weight}
                  onChange={(e) => updateLocal(v.issue_id, { passion_weight: parseInt(e.target.value) })}
                  className="passion-range"
                />
              </div>

              <div className="mt-7 pt-5 border-t border-rule-soft flex items-center justify-between">
                <span className="eyebrow text-ink-faint">
                  {saved ? '✓ Saved' : ''}
                </span>
                <button
                  onClick={() => saveVote(v.issue_id)}
                  disabled={saving}
                  className="btn-primary disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save change'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
