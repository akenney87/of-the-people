// File: client/src/pages/Ballot.jsx
//
// "Your Ballot" — the Vote411 move: enter an address, see every race you're
// eligible to vote in, with ALL candidates (not just incumbents), grouped by
// upcoming election. Powered by the get_my_ballot() RPC, which matches contests
// to the user's districts. Match scores are intentionally omitted until
// candidate positions are seeded (rep_positions); the structure is ready for them.
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLocalStorage } from "../hooks/useLocalStorage";

// "Collins, Mike" -> "Mike Collins"; "Jon Ossoff" -> "Jon Ossoff"
const formatName = (name) => {
  if (!name) return "";
  const [surname, firstname] = name.split(", ").map((s) => s.trim());
  return firstname ? `${firstname} ${surname}` : name;
};

const partyMark = (party) => {
  if (!party) return { letter: "·", cls: "text-ink-soft" };
  const p = party.toLowerCase();
  if (p.startsWith("d")) return { letter: "D", cls: "text-navy" };
  if (p.startsWith("r")) return { letter: "R", cls: "text-vermillion" };
  if (p.startsWith("i")) return { letter: "I", cls: "text-ink-soft" };
  if (p.startsWith("l")) return { letter: "L", cls: "text-ink-soft" };
  return { letter: party[0].toUpperCase(), cls: "text-ink-soft" };
};

const ELECTION_LABEL = {
  primary: "Primary",
  primary_runoff: "Primary Runoff",
  general: "General Election",
  general_runoff: "General Runoff",
};

const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

// Group the flat RPC rows into elections -> contests -> candidates.
function shapeBallot(rows) {
  const order = [];
  const byEl = new Map();
  for (const row of rows) {
    if (!byEl.has(row.election_id)) {
      const el = {
        id: row.election_id, name: row.election_name,
        date: row.election_date, type: row.election_type,
        contests: new Map(),
      };
      byEl.set(row.election_id, el);
      order.push(el);
    }
    const el = byEl.get(row.election_id);
    if (!el.contests.has(row.contest_id)) {
      el.contests.set(row.contest_id, {
        id: row.contest_id, office: row.office_name, ballotParty: row.contest_party,
        level: row.level, hasParent: row.parent_contest_id != null, candidates: [],
      });
    }
    el.contests.get(row.contest_id).candidates.push(row);
  }
  // incumbent first, then alphabetical by display name
  for (const el of order) {
    for (const c of el.contests.values()) {
      c.candidates.sort((a, b) =>
        (b.is_incumbent - a.is_incumbent) ||
        formatName(a.candidate_name).localeCompare(formatName(b.candidate_name)));
    }
  }
  return order.map((el) => ({ ...el, contests: [...el.contests.values()] }));
}

// When a general contest still descends from a runoff, one party's nominee
// isn't set yet. Name the missing major party so the voter understands.
function pendingNote(contest) {
  if (!contest.hasParent) return null;
  const parties = new Set(contest.candidates.map((c) => (c.candidate_party || "")[0]?.toUpperCase()));
  if (!parties.has("R")) return "Republican nominee decided in the June 16 runoff.";
  if (!parties.has("D")) return "Democratic nominee decided in the June 16 runoff.";
  return "A nominee is still pending the June 16 runoff.";
}

export default function Ballot() {
  const navigate = useNavigate();
  const [ballot, setBallot] = useLocalStorage("myBallot", []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_my_ballot");
        if (rpcErr) throw rpcErr;
        setBallot(data || []);
        fetched.current = true;
      } catch (err) {
        setError("Couldn't load your ballot: " + (err.message || ""));
      } finally { setLoading(false); }
    })();
  }, [setBallot]);

  const elections = shapeBallot(ballot);

  return (
    <div className="max-w-spread mx-auto">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">What's On Your Ballot</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          Your ballot.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          Every race you're eligible to vote in, from the U.S. Senate down to
          your county commission — and <em>everyone</em> running for each seat,
          not just whoever holds it now. The percentage on the right is how
          closely each candidate's positions track your own, weighted by what
          you care about most.
        </p>
        <p className="font-body text-caption text-ink-faint italic mt-3 max-w-3xl">
          Match scores are AI-estimated from candidates' public statements and
          voting records — unverified until the candidate confirms them.
        </p>
      </header>

      {loading && <p className="mt-12 eyebrow text-ink-faint">Setting the type…</p>}

      {error && !loading && (
        <div className="my-8 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
          {error}
        </div>
      )}

      {!loading && elections.length === 0 && !error && (
        <p className="mt-12 font-body text-lede text-ink-soft max-w-xl">
          No upcoming races matched to your address yet. Visit your{" "}
          <button onClick={() => navigate("/profile")} className="text-vermillion underline underline-offset-4">profile</button>{" "}
          and confirm your city, state, and ZIP so we can re-resolve your districts.
        </p>
      )}

      {!loading && elections.length > 0 && (
        <div className="mt-12 space-y-16">
          {elections.map((el, ei) => (
            <section key={el.id} className="animate-rise-in" style={{ animationDelay: `${ei * 80}ms` }}>
              <div className="flex items-baseline justify-between border-b border-ink pb-2">
                <h2
                  className="font-display text-2xl md:text-3xl text-ink"
                  style={{ fontVariationSettings: '"opsz" 72, "wght" 600' }}
                >
                  {ELECTION_LABEL[el.type] || el.name}
                </h2>
                <span className="folio">{longDate(el.date)}</span>
              </div>

              <div className="mt-8 space-y-10">
                {el.contests.map((contest) => {
                  const note = pendingNote(contest);
                  return (
                    <div key={contest.id}>
                      <div className="flex items-baseline justify-between border-b border-rule pb-2">
                        <h3 className="eyebrow text-ink">
                          {contest.office}
                          {contest.ballotParty ? ` · ${contest.ballotParty} ballot` : ""}
                        </h3>
                        <span className="folio">
                          {contest.candidates.length} {contest.candidates.length === 1 ? "candidate" : "candidates"}
                        </span>
                      </div>
                      <ul>
                        {contest.candidates.map((c) => {
                          const mark = partyMark(c.candidate_party);
                          return (
                            <li
                              key={c.candidacy_id}
                              onClick={() => navigate(`/representatives/${c.rep_id}`)}
                              className="ledger-row cursor-pointer hover:bg-paper-warm transition-colors"
                            >
                              <div>
                                <div className="flex items-baseline gap-3">
                                  <span className={`font-mono text-sm font-medium ${mark.cls}`}>
                                    [{mark.letter}]
                                  </span>
                                  <p className="font-body text-lg md:text-xl text-ink">
                                    {formatName(c.candidate_name)}
                                  </p>
                                  {c.is_incumbent && (
                                    <span className="eyebrow text-ink-faint border border-rule px-1.5 py-0.5">
                                      Incumbent
                                    </span>
                                  )}
                                  {c.status === "advanced" && (
                                    <span className="eyebrow text-vermillion">In runoff</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {(() => {
                                  const pct = c.match_score == null ? null : Number(c.match_score);
                                  const isStrong = pct != null && pct >= 70;
                                  const isWeak = pct != null && pct < 40;
                                  return (
                                    <p className={`font-mono tabular-nums text-xl md:text-2xl ${
                                      isStrong ? "text-vermillion" : isWeak ? "text-ink-soft" : "text-ink"
                                    }`}>
                                      {pct == null ? "—" : `${pct}%`}
                                    </p>
                                  );
                                })()}
                                <p className="eyebrow text-ink-faint mt-1">View →</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {note && (
                        <p className="font-body text-caption text-ink-faint italic mt-2 pl-1">
                          {note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
