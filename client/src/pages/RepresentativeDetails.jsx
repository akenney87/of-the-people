// File: client/src/pages/RepresentativeDetails.jsx
//
// Single-rep profile, treated like a profile piece in a Sunday section.
// Big name as headline, jurisdiction as kicker, alignment as a marquee
// number, contact info in a clean infobox underneath.
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const STATE_NAMES = { GA: "Georgia", NY: "New York" };

const formatName = (name) => {
  if (!name) return "";
  const [s, f] = name.split(", ").map(x => x.trim());
  return f ? `${f} ${s}` : name;
};

const partyLong = (party) => {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.startsWith('d')) return 'Democrat';
  if (p.startsWith('r')) return 'Republican';
  if (p.startsWith('nonp')) return 'Nonpartisan';
  return party;
};

const jurisdiction = (rep) => {
  if (!rep) return '';
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

export default function RepresentativeDetails() {
  const { id } = useParams();
  const [rep, setRep] = useState(null);
  const [alignment, setAlignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [repRes, alignRes] = await Promise.all([
        supabase.from('representatives').select('*').eq('id', id).maybeSingle(),
        supabase.rpc('get_my_alignment', { p_rep_id: Number(id) }),
      ]);
      if (cancelled) return;
      if (repRes.error || !repRes.data) {
        setError("Couldn't find that representative.");
      } else {
        setRep(repRes.data);
        setAlignment(alignRes.error || alignRes.data == null ? null : alignRes.data);
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
        <Link to="/representatives" className="btn-secondary mt-6 inline-flex">
          ← Back to the ledger
        </Link>
      </div>
    );
  }

  const pct = alignment;
  const tone = pct == null ? 'unknown' : pct >= 70 ? 'aligned' : pct >= 40 ? 'mixed' : 'opposed';

  return (
    <div className="max-w-spread mx-auto animate-rise-in">
      <Link to="/representatives" className="eyebrow text-ink-soft hover:text-ink">← The ledger</Link>

      <header className="mt-6 border-b-2 border-ink pb-8">
        <p className="eyebrow text-vermillion mb-3">{rep.position}</p>
        <h1
          className="font-display text-[2.75rem] md:text-hero leading-[0.92] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          {formatName(rep.name)}
        </h1>
        <p className="font-body text-lede text-ink-soft mt-5 max-w-3xl border-t border-rule pt-4">
          {jurisdiction(rep)}{partyLong(rep.party) ? ` · ${partyLong(rep.party)}` : ''}
        </p>
      </header>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Alignment marquee */}
        <div className="lg:col-span-7">
          <p className="eyebrow text-ink-soft">Your alignment, based on votes so far</p>
          <p
            className={`font-display text-[8rem] md:text-[12rem] leading-none mt-4 tabular-nums ${
              tone === 'aligned' ? 'text-vermillion' :
              tone === 'opposed' ? 'text-ink-soft' : 'text-ink'
            }`}
            style={{ fontVariationSettings: '"opsz" 144, "wght" 700' }}
          >
            {pct == null ? '—' : `${pct}%`}
          </p>
          <p className="font-body text-base text-ink-soft mt-2 max-w-md">
            {tone === 'aligned' && 'Strong alignment so far. They have voted with your position more often than not, weighted by how strongly you feel.'}
            {tone === 'mixed'   && 'Mixed signal. You agree on some issues, disagree on others. The number gets sharper with each new vote.'}
            {tone === 'opposed' && 'Diverges from your positions on the issues you\'ve weighed in on so far.'}
            {tone === 'unknown' && 'We do not yet have enough of this rep\'s positions to score. The blue-check inference pipeline (Phase 3) will close this gap.'}
          </p>
        </div>

        {/* Contact card */}
        <aside className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-12">
          <p className="eyebrow text-ink-soft mb-5">Contact</p>
          <dl className="space-y-4">
            {rep.email && (
              <div className="border-b border-rule-soft pb-3">
                <dt className="eyebrow text-ink-faint">Email</dt>
                <dd className="font-mono text-sm text-ink mt-1 break-all">
                  <a href={`mailto:${rep.email}`} className="hover:text-vermillion">{rep.email}</a>
                </dd>
              </div>
            )}
            {rep.phone && (
              <div className="border-b border-rule-soft pb-3">
                <dt className="eyebrow text-ink-faint">Phone</dt>
                <dd className="font-mono text-sm text-ink mt-1">
                  <a href={`tel:${rep.phone.replace(/\D/g,'')}`} className="hover:text-vermillion">{rep.phone}</a>
                </dd>
              </div>
            )}
            {rep.website && (
              <div className="border-b border-rule-soft pb-3">
                <dt className="eyebrow text-ink-faint">Official site</dt>
                <dd className="font-mono text-sm text-ink mt-1 break-all">
                  <a href={rep.website} target="_blank" rel="noopener noreferrer" className="hover:text-vermillion">
                    {rep.website.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </div>
            )}
            {!rep.email && !rep.phone && !rep.website && (
              <p className="font-body text-caption text-ink-faint italic">
                No contact info on file yet.
              </p>
            )}
          </dl>

          {/* Blue-check placeholder */}
          <div className="mt-10 border border-rule-soft p-6 bg-paper-warm">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-verified text-lg">✓</span>
              <p className="eyebrow text-ink">Not yet verified</p>
            </div>
            <p className="font-body text-caption text-ink-soft mt-3">
              Are you {formatName(rep.name)}, or on their staff? The
              blue-check claim flow is part of the next phase. When it ships,
              you&apos;ll be able to override the AI-inferred positions with
              your actual answers.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
