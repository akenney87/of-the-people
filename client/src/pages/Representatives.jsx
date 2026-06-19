// File: client/src/pages/Representatives.jsx
//
// "Who Represents You" — broadsheet-style ledger of every official matched
// to the user's address, grouped by jurisdiction. Alignment score sits in
// the right rail like a closing price in a financial table.
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLocalStorage } from "../hooks/useLocalStorage";

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

const formatName = (name) => {
  if (!name) return "";
  const [surname, firstname] = name.split(", ").map((s) => s.trim());
  return firstname ? `${firstname} ${surname}` : name;
};

const partyMark = (party) => {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.startsWith('d')) return { letter: 'D', cls: 'text-navy' };
  if (p.startsWith('r')) return { letter: 'R', cls: 'text-vermillion' };
  if (p.startsWith('nonp')) return { letter: '·', cls: 'text-ink-soft' };
  return { letter: party[0].toUpperCase(), cls: 'text-ink-soft' };
};

const jurisdiction = (rep) => {
  const sn = STATE_NAMES[rep.state] || rep.state || "";
  if (rep.city) return `${rep.city}, ${sn}`;
  if (rep.position === 'U.S. Representative' && rep.cong_district)
    return `${sn} · Congressional District ${rep.cong_district}`;
  if (rep.position === 'State Senator' && rep.state_senate_district)
    return `${sn} · Senate District ${rep.state_senate_district}`;
  if (rep.position === 'State Representative' && rep.state_assembly_district)
    return `${sn} · House District ${rep.state_assembly_district}`;
  if (rep.county) return `${rep.county} County, ${sn}`;
  return sn;
};

const GROUPS = [
  { key: 'federal', label: 'United States Congress', match: r => r.position.startsWith('U.S.') },
  { key: 'gaexec',  label: 'Georgia · Executive',   match: r => ['Governor','Lieutenant Governor','Attorney General','Secretary of State','State Auditor'].includes(r.position) },
  { key: 'galeg',   label: 'Georgia · Legislature', match: r => ['State Senator','State Representative','Assembly Member'].includes(r.position) },
  { key: 'county',  label: 'Hall County',           match: r => r.county === 'Hall' && !r.city },
  { key: 'city',    label: 'City of Gainesville',   match: r => Boolean(r.city) },
];

export default function Representatives() {
  const navigate = useNavigate();
  const [reps, setReps] = useLocalStorage("representatives", []);
  const [alignmentScores, setAlignmentScores] = useLocalStorage("alignmentScores", {});
  const [positionCounts, setPositionCounts] = useLocalStorage("repPositionCounts", {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dataFetchedRef = useRef(false);

  const fetchAlignmentScores = useCallback(async (rows) => {
    const scores = {};
    for (const rep of rows) {
      const { data, error: rpcErr } = await supabase.rpc("get_my_ballot_alignment", { p_rep_id: rep.id });
      scores[rep.id] = rpcErr || data == null ? null : data;
    }
    setAlignmentScores(scores);
  }, [setAlignmentScores]);

  useEffect(() => {
    if (dataFetchedRef.current) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_my_representatives");
        if (rpcErr) throw rpcErr;
        setReps(data || []);
        fetchAlignmentScores(data || []);
        const ids = (data || []).map((r) => r.id);
        if (ids.length) {
          const { data: counts } = await supabase.rpc("get_rep_position_counts", { p_rep_ids: ids });
          const m = {};
          (counts || []).forEach((cnt) => { m[cnt.rep_id] = cnt.cnt; });
          setPositionCounts(m);
        }
        dataFetchedRef.current = true;
      } catch (err) {
        setError("Couldn't load your representatives: " + (err.message || ''));
      } finally { setLoading(false); }
    })();
  }, [fetchAlignmentScores, setReps]);

  // Group + sort within group
  const seen = new Set();
  const groupedReps = GROUPS.map(g => {
    const items = reps.filter(r => !seen.has(r.id) && g.match(r));
    items.forEach(r => seen.add(r.id));
    return { ...g, items };
  });
  const remaining = reps.filter(r => !seen.has(r.id));
  if (remaining.length) groupedReps.push({ key: 'other', label: 'Other', items: remaining });

  return (
    <div className="max-w-spread mx-auto">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">Who Represents You</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          The ledger.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          Every elected official with authority over you, from the U.S.
          Capitol to the Gainesville council. The percentage on the right is
          how often, weighted by your passion, your votes align with theirs.
        </p>
      </header>

      {loading && (
        <p className="mt-12 eyebrow text-ink-faint">Setting the type…</p>
      )}

      {error && !loading && (
        <div className="my-8 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
          {error}
        </div>
      )}

      {!loading && reps.length === 0 && (
        <p className="mt-12 font-body text-lede text-ink-soft max-w-xl">
          No representatives matched to your address yet. Visit your{" "}
          <button onClick={() => navigate('/profile')} className="text-vermillion underline underline-offset-4">profile</button>{" "}
          and confirm your city, state, and ZIP so we can re-resolve your districts.
        </p>
      )}

      {!loading && reps.length > 0 && (
        <div className="mt-12 space-y-14">
          {groupedReps.filter(g => g.items.length > 0).map((group, gi) => (
            <section key={group.key} className="animate-rise-in" style={{ animationDelay: `${gi * 60}ms` }}>
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <h2 className="eyebrow text-ink">{group.label}</h2>
                <span className="folio">{group.items.length} {group.items.length === 1 ? 'official' : 'officials'}</span>
              </div>
              <ul>
                {group.items.map((rep) => {
                  const pct = alignmentScores[rep.id];
                  const positions = positionCounts[rep.id] ?? 0;
                  const isStrong = pct != null && pct >= 70;
                  const isWeak   = pct != null && pct < 40;
                  const mark = partyMark(rep.party);
                  return (
                    <li
                      key={rep.id}
                      onClick={() => navigate(`/representatives/${rep.id}`)}
                      className="ledger-row cursor-pointer hover:bg-paper-warm transition-colors"
                    >
                      <div>
                        <div className="flex items-baseline gap-3">
                          {mark && (
                            <span className={`font-mono text-sm font-medium ${mark.cls}`}>
                              [{mark.letter}]
                            </span>
                          )}
                          <p className="font-body text-lg md:text-xl text-ink">
                            {formatName(rep.name)}
                          </p>
                        </div>
                        <p className="eyebrow text-ink-faint mt-1">
                          {rep.position} · {jurisdiction(rep)}
                        </p>
                      </div>
                      <div className="text-right">
                        {pct != null ? (
                          <p className={`font-mono tabular-nums text-xl md:text-2xl ${
                            isStrong ? 'text-vermillion' : isWeak ? 'text-ink-soft' : 'text-ink'
                          }`}>{pct}%</p>
                        ) : positions === 0 ? (
                          <p className="eyebrow text-ink-faint leading-tight">Not yet<br />scored</p>
                        ) : (
                          <p className="font-mono tabular-nums text-xl md:text-2xl text-ink-faint">—</p>
                        )}
                        <p className="eyebrow text-ink-faint mt-1">
                          {pct == null && positions > 0 ? "Vote to compare" : "View →"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
