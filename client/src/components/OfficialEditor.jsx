// File: client/src/components/OfficialEditor.jsx
//
// Official edit mode (claim flow). A claimed official confirms or corrects their
// position on every in-scope issue — including ones the AI left blank. Saving
// writes verified answers (verified_by_official=true, confidence=1.0 so Option B
// weights them fully) that replace the AI estimates. RLS already restricts writes
// to the rep this user owns; this UI just collects the answers.
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { supabase } from "../lib/supabaseClient";

const SCOPE_LABEL = { national: "National", state: "State", county: "County", city: "City" };
const CHOICES = [
  ["yes", "Support"],
  ["no", "Oppose"],
  ["unclear", "No position"],
];

export default function OfficialEditor({ rep, onDone }) {
  const [rows, setRows] = useState(null);   // fetched in-scope issues
  const [draft, setDraft] = useState({});   // issue_id -> { vote, strength }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase.rpc("get_rep_editable_positions", { p_rep_id: rep.id });
      if (cancelled) return;
      if (e) { setError(e.message || "Couldn't load issues."); return; }
      setRows(data || []);
      const init = {};
      for (const r of data || []) {
        init[r.issue_id] = {
          vote: r.predicted_vote ?? null,
          strength: r.stance_strength ?? 3,
        };
      }
      setDraft(init);
    })();
    return () => { cancelled = true; };
  }, [rep.id]);

  // which issues changed vs what the RPC returned
  const dirty = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const d = draft[r.issue_id];
      if (!d || d.vote == null) return false;                 // nothing chosen
      const sameVote = d.vote === (r.predicted_vote ?? null);
      const sameStr = (d.vote === "unclear") || d.strength === (r.stance_strength ?? 3);
      return !(sameVote && sameStr && r.verified_by_official); // unchanged & already verified -> skip
    });
  }, [rows, draft]);

  const setVote = (id, vote) => setDraft((p) => ({ ...p, [id]: { ...p[id], vote } }));
  const setStrength = (id, strength) => setDraft((p) => ({ ...p, [id]: { ...p[id], strength } }));

  const save = async () => {
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const payload = dirty.map((r) => {
      const d = draft[r.issue_id];
      const unclear = d.vote === "unclear";
      return {
        rep_id: rep.id,
        issue_id: r.issue_id,
        predicted_vote: d.vote,
        stance_strength: unclear ? null : d.strength,
        confidence: unclear ? null : 1.0,
        supporting_quote: null,
        source_url: null,
        verified_by_official: true,
        verified_at: now,
        claimed_by_user_id: user.id,
        model: "official self-report",
        inferred_at: now,
      };
    });
    const { error: e } = await supabase
      .from("rep_positions")
      .upsert(payload, { onConflict: "rep_id,issue_id" });
    setSaving(false);
    if (e) { setError(e.message || "Save failed."); return; }
    onDone(true);
  };

  if (error && !rows) return <p className="font-body text-vermillion">{error}</p>;
  if (!rows) return <p className="eyebrow text-ink-faint">Loading your issues…</p>;

  // group rows by scope, preserving the RPC's order
  const groups = [];
  for (const r of rows) {
    const g = groups.find((x) => x.scope === r.scope);
    if (g) g.items.push(r); else groups.push({ scope: r.scope, items: [r] });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="eyebrow text-ink">Confirm or correct your positions</h2>
        <span className="folio">{dirty.length} change{dirty.length === 1 ? "" : "s"} to save</span>
      </div>
      <p className="font-body text-caption text-ink-soft mt-3 max-w-2xl">
        Set where you stand on each issue. Your answers are marked verified and replace the
        AI estimates. Leave anything blank to keep the current value.
      </p>

      {error && (
        <div className="mt-4 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
          {error}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.scope} className="mt-8">
          <p className="eyebrow text-ink-faint mb-3">{SCOPE_LABEL[g.scope] || g.scope}</p>
          <div className="space-y-6">
            {g.items.map((r) => {
              const d = draft[r.issue_id] || {};
              return (
                <article key={r.issue_id} className="border-b border-rule pb-5">
                  <div className="flex items-baseline gap-3">
                    <p className="font-body text-base text-ink flex-1">{r.issue_text}</p>
                    {r.verified_by_official && <span className="text-verified font-mono text-sm">✓</span>}
                    {!r.verified_by_official && r.predicted_vote && (
                      <span className="eyebrow text-ink-faint whitespace-nowrap">AI estimate</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {CHOICES.map(([val, label]) => {
                      const active = d.vote === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setVote(r.issue_id, val)}
                          className={`px-3 py-1.5 font-ui text-sm border transition-colors ${
                            active
                              ? "border-ink bg-ink text-paper"
                              : "border-rule text-ink-soft hover:border-ink"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {(d.vote === "yes" || d.vote === "no") && (
                      <label className="ml-2 inline-flex items-center gap-2 font-ui text-sm text-ink-soft">
                        How strongly?
                        <select
                          className="field !w-auto !py-1"
                          value={d.strength ?? 3}
                          onChange={(e) => setStrength(r.issue_id, Number(e.target.value))}
                        >
                          <option value={1}>1 — mildly</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5 — strongly</option>
                        </select>
                      </label>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <div className="mt-10 flex gap-3 sticky bottom-0 bg-paper py-4 border-t border-rule">
        <button className="btn-primary justify-center" onClick={save} disabled={saving || dirty.length === 0}>
          {saving ? "Saving…" : `Save ${dirty.length || ""} change${dirty.length === 1 ? "" : "s"}`}
        </button>
        <button className="btn-secondary" onClick={() => onDone(false)} disabled={saving}>
          Done
        </button>
      </div>
    </div>
  );
}

OfficialEditor.propTypes = {
  rep: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired }).isRequired,
  onDone: PropTypes.func.isRequired,
};
