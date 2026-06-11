// File: client/src/pages/RepresentativeDetails.jsx
//
// Single-candidate profile. Big name as headline, alignment as a marquee
// number, then "Where they stand" — the per-issue breakdown showing the
// candidate's inferred position, your own answer, the per-issue match, and the
// verbatim supporting quote + source behind each call. This is where the cited
// evidence becomes visible and the match score becomes defensible.
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const STATE_NAMES = { GA: "Georgia", NY: "New York" };

const formatName = (name) => {
  if (!name) return "";
  const [s, f] = name.split(", ").map((x) => x.trim());
  return f ? `${f} ${s}` : name;
};

const partyLong = (party) => {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.startsWith("d")) return "Democrat";
  if (p.startsWith("r")) return "Republican";
  if (p.startsWith("nonp")) return "Nonpartisan";
  return party;
};

const jurisdiction = (rep) => {
  if (!rep) return "";
  const sn = STATE_NAMES[rep.state] || rep.state || "";
  if (rep.city) return `${rep.city}, ${sn}`;
  if (rep.position === "U.S. Representative" && rep.cong_district)
    return `${sn} · Congressional District ${rep.cong_district}`;
  if (rep.position === "State Senator" && rep.state_senate_district)
    return `${sn} · Senate District ${rep.state_senate_district}`;
  if (rep.position === "State Representative" && rep.state_assembly_district)
    return `${sn} · House District ${rep.state_assembly_district}`;
  if (rep.county) return `${rep.county} County, ${sn}`;
  return sn;
};

// inferred stance -> human label + direction
const stance = (vote, strength) => {
  if (vote !== "yes" && vote !== "no") return { text: "Position unclear", kind: "unclear" };
  const intensity = strength >= 4 ? "Strongly " : strength <= 2 ? "Mildly " : "";
  const dir = vote === "yes" ? "supports" : "opposes";
  return { text: `${intensity}${dir}`.replace(/^./, (c) => c.toUpperCase()), kind: vote === "yes" ? "support" : "oppose" };
};

const matchCls = (pct) =>
  pct == null ? "text-ink" : pct >= 70 ? "text-vermillion" : pct < 40 ? "text-ink-soft" : "text-ink";

export default function RepresentativeDetails() {
  const { id } = useParams();
  const [rep, setRep] = useState(null);
  const [alignment, setAlignment] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [repRes, alignRes, posRes] = await Promise.all([
        supabase.from("representatives").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("get_my_ballot_alignment", { p_rep_id: Number(id) }),
        supabase.rpc("get_rep_positions", { p_rep_id: Number(id) }),
      ]);
      if (cancelled) return;
      if (repRes.error || !repRes.data) {
        setError("Couldn't find that candidate.");
      } else {
        setRep(repRes.data);
        setAlignment(alignRes.error || alignRes.data == null ? null : alignRes.data);
        setPositions(posRes.error ? [] : posRes.data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-spread mx-auto">
        <p className="eyebrow text-ink-faint">Setting the type…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-column mx-auto pt-12">
        <p className="eyebrow text-vermillion mb-4">Not found</p>
        <p className="font-body text-lede text-ink-soft">{error}</p>
        <Link to="/ballot" className="btn-secondary mt-6 inline-flex">← Back to your ballot</Link>
      </div>
    );
  }

  const pct = alignment;
  const tone = pct == null ? "unknown" : pct >= 70 ? "aligned" : pct >= 40 ? "mixed" : "opposed";
  const scored = positions.filter((p) => p.issue_match != null);
  const known = positions.filter((p) => p.predicted_vote === "yes" || p.predicted_vote === "no");
  const unclear = positions.filter((p) => p.predicted_vote === "unclear");

  return (
    <div className="max-w-spread mx-auto animate-rise-in">
      <Link to="/ballot" className="eyebrow text-ink-soft hover:text-ink">← Your ballot</Link>

      <header className="mt-6 border-b-2 border-ink pb-8">
        <p className="eyebrow text-vermillion mb-3">{rep.position}</p>
        <h1
          className="font-display text-[2.75rem] md:text-hero leading-[0.92] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          {formatName(rep.name)}
        </h1>
        <p className="font-body text-lede text-ink-soft mt-5 max-w-3xl border-t border-rule pt-4">
          {jurisdiction(rep)}{partyLong(rep.party) ? ` · ${partyLong(rep.party)}` : ""}
        </p>
      </header>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Alignment marquee */}
        <div className="lg:col-span-7">
          <p className="eyebrow text-ink-soft">Your match, from their positions on issues you've answered</p>
          <p
            className={`font-display text-[8rem] md:text-[12rem] leading-none mt-4 tabular-nums ${
              tone === "aligned" ? "text-vermillion" : tone === "opposed" ? "text-ink-soft" : "text-ink"
            }`}
            style={{ fontVariationSettings: '"opsz" 144, "wght" 700' }}
          >
            {pct == null ? "—" : `${pct}%`}
          </p>
          <p className="font-body text-base text-ink-soft mt-2 max-w-md">
            {tone === "aligned" && "Strong alignment on the issues you've weighed in on, weighted by how strongly you feel about each."}
            {tone === "mixed" && "Mixed. You agree on some issues and diverge on others."}
            {tone === "opposed" && "Diverges from your positions on most of the issues you've answered."}
            {tone === "unknown" && "Not enough overlap yet between your answers and this candidate's known positions to score."}
          </p>
          {scored.length > 0 && (
            <p className="folio mt-4">Based on {scored.length} issue{scored.length === 1 ? "" : "s"} you've answered</p>
          )}
        </div>

        {/* Contact + blue-check */}
        <aside className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-12">
          <p className="eyebrow text-ink-soft mb-5">Contact</p>
          <dl className="space-y-4">
            {rep.website && (
              <div className="border-b border-rule-soft pb-3">
                <dt className="eyebrow text-ink-faint">Official site</dt>
                <dd className="font-mono text-sm text-ink mt-1 break-all">
                  <a href={rep.website} target="_blank" rel="noopener noreferrer" className="hover:text-vermillion">
                    {rep.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            )}
            {rep.email && (
              <div className="border-b border-rule-soft pb-3">
                <dt className="eyebrow text-ink-faint">Email</dt>
                <dd className="font-mono text-sm text-ink mt-1 break-all">
                  <a href={`mailto:${rep.email}`} className="hover:text-vermillion">{rep.email}</a>
                </dd>
              </div>
            )}
            {!rep.email && !rep.website && (
              <p className="font-body text-caption text-ink-faint italic">No contact info on file yet.</p>
            )}
          </dl>

          <div className="mt-10 border border-rule-soft p-6 bg-paper-warm">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-verified text-lg">✓</span>
              <p className="eyebrow text-ink">Not yet verified</p>
            </div>
            <p className="font-body text-caption text-ink-soft mt-3">
              Are you {formatName(rep.name)}, or on their staff? The positions below
              are AI-estimated from public statements. When the blue-check claim flow
              ships, you&apos;ll be able to confirm or correct each one.
            </p>
          </div>
        </aside>
      </section>

      {/* Where they stand — per-issue breakdown */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="eyebrow text-ink">Where they stand</h2>
          <span className="folio">{known.length} position{known.length === 1 ? "" : "s"} on record</span>
        </div>

        {positions.length === 0 && (
          <p className="mt-8 font-body text-lede text-ink-soft max-w-xl">
            No positions estimated for this candidate yet.
          </p>
        )}

        <div className="mt-8 space-y-8">
          {known.map((p) => {
            const st = stance(p.predicted_vote, p.stance_strength);
            const voted = p.user_vote != null;
            return (
              <article key={p.issue_id} className="border-b border-rule pb-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-9">
                    <p className="font-body text-lg text-ink">{p.issue_text}</p>
                    <p className="mt-2 font-ui text-sm">
                      <span className={st.kind === "support" ? "text-navy" : st.kind === "oppose" ? "text-vermillion" : "text-ink-soft"}>
                        {st.text}
                      </span>
                      {voted && (
                        <span className="text-ink-faint">
                          {"  ·  "}You {p.user_vote ? "support" : "oppose"} (passion {p.user_passion})
                        </span>
                      )}
                      {p.verified_by_official
                        ? <span className="text-verified">{"  ·  "}✓ verified by candidate</span>
                        : <span className="text-ink-faint">{"  ·  "}AI-estimated{p.confidence != null ? ` · ${Math.round(p.confidence * 100)}% conf.` : ""}</span>}
                    </p>
                    {p.supporting_quote && (
                      <blockquote className="mt-3 border-l-2 border-rule pl-4 font-body text-base italic text-ink-soft">
                        “{p.supporting_quote}”
                      </blockquote>
                    )}
                    {p.source_url && (
                      <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                         className="inline-block mt-2 eyebrow text-ink-faint hover:text-vermillion break-all">
                        Source ↗
                      </a>
                    )}
                  </div>
                  <div className="md:col-span-3 md:text-right">
                    {p.issue_match != null ? (
                      <>
                        <p className={`font-mono tabular-nums text-3xl ${matchCls(Number(p.issue_match))}`}>
                          {Number(p.issue_match)}%
                        </p>
                        <p className="eyebrow text-ink-faint mt-1">your match</p>
                      </>
                    ) : (
                      <p className="eyebrow text-ink-faint">
                        {voted ? "—" : "You haven't answered this"}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Unclear / no-record positions, listed plainly so we're honest about gaps */}
        {unclear.length > 0 && (
          <div className="mt-10">
            <p className="eyebrow text-ink-faint">No public record found yet</p>
            <ul className="mt-3 space-y-2">
              {unclear.map((p) => (
                <li key={p.issue_id} className="font-body text-base text-ink-faint">
                  {p.issue_text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
