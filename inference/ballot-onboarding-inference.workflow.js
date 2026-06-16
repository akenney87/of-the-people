export const meta = {
  name: 'ballot-onboarding-inference',
  description: 'Supervised inference of the 10 ONBOARDING issues for a batch of ballot candidates (Opus research per candidate, Sonnet adversarial verify). Cite-or-unclear, tiered confidence, never party-line. Returns per-candidate rep_positions SQL. Onboarding-first so every candidate shows a score from onboarding alone.',
  phases: [
    { title: 'Research', detail: 'one Opus agent per candidate finds cited positions on the 10 onboarding issues' },
    { title: 'Verify', detail: 'one Sonnet agent per candidate re-checks every citation + framing', model: 'claude-sonnet-4-6' },
  ],
}

const ONB = {
  "102": "When making gun policy, should reducing gun violence generally take priority over protecting gun owners' rights?",
  "103": "Should abortion be legal in most circumstances?",
  "104": "Should the government do more to solve problems and help people, even if that means higher taxes?",
  "105": "Should the wealthiest Americans pay significantly higher taxes to reduce economic inequality?",
  "106": "Should the government guarantee health coverage for everyone, even if it means higher taxes and a larger government role in healthcare?",
  "107": "When environmental protection and economic growth conflict, should protecting the environment generally come first?",
  "108": "Should most undocumented immigrants already living in the U.S. have a path to legal status and eventual citizenship?",
  "109": "Should the criminal justice system focus more on rehabilitation than on tougher sentencing and policing?",
  "110": "Should the U.S. reduce its military involvement around the world and focus more on problems at home?",
  "111": "Should transgender women and girls be allowed to compete on female sports teams?"
};
const CANDIDATES = [
  {
    "rep_id": 66,
    "name": "Brian Strickland",
    "party": "R",
    "office": "Attorney General candidate for Georgia (currently Georgia State Senator)"
  },
  {
    "rep_id": 142,
    "name": "Tanya F. Miller",
    "party": "D",
    "office": "Attorney General candidate for Georgia (currently Georgia State Representative; former federal prosecutor)"
  },
  {
    "rep_id": 51,
    "name": "Greg Dolezal",
    "party": "R",
    "office": "Lieutenant Governor candidate for Georgia (currently Georgia State Senator)"
  },
  {
    "rep_id": 38,
    "name": "Josh McLaurin",
    "party": "D",
    "office": "Lieutenant Governor candidate for Georgia (currently Georgia State Senator)"
  },
  {
    "rep_id": 278,
    "name": "Dana Barrett",
    "party": "D",
    "office": "Secretary of State candidate for Georgia (Democrat; businesswoman/broadcaster)"
  },
  {
    "rep_id": 194,
    "name": "Tim Fleming",
    "party": "R",
    "office": "Secretary of State candidate for Georgia (currently Georgia State Representative; former chief of staff to Gov. Kemp)"
  }
];

const RESEARCH_SCHEMA = { type:'object', properties:{ positions:{ type:'array', items:{ type:'object', properties:{
  issue_id:{type:'integer'}, predicted_vote:{type:'string', enum:['yes','no','unclear']},
  stance_strength:{type:['integer','null']}, confidence:{type:['number','null']},
  supporting_quote:{type:['string','null']}, source_url:{type:['string','null']}, source_type:{type:['string','null']},
  reasoning:{type:'string'},
}, required:['issue_id','predicted_vote','reasoning'] } } }, required:['positions'] };

const VERDICT_SCHEMA = { type:'object', properties:{ verdicts:{ type:'array', items:{ type:'object', properties:{
  issue_id:{type:'integer'}, citation_holds:{type:'boolean'}, predicted_vote:{type:'string', enum:['yes','no','unclear']},
  stance_strength:{type:['integer','null']}, confidence:{type:['number','null']},
  supporting_quote:{type:['string','null']}, source_url:{type:['string','null']}, source_type:{type:['string','null']}, notes:{type:'string'},
}, required:['issue_id','citation_holds','predicted_vote','notes'] } } }, required:['verdicts'] };

const researchPrompt = (c) => `You are a civic-data research analyst for "Of the People," a nonpartisan voter-alignment app. Determine, with CITABLE evidence, where a Georgia candidate stands on 10 policy issues.

CANDIDATE: ${c.name} — ${c.party}, ${c.office}.
SOURCES (best first): for an officeholder, their VOTING RECORD / sponsorships (Congress.gov for U.S. House/Senate; OpenStates / legis.ga.gov for GA legislators; official acts for executives); then their campaign site / issues page, questionnaires (Vote411/AJC/local press), interviews, speeches, social posts. Actions (votes/bills) outrank words.

CARDINAL RULE: a yes/no MUST trace to a SPECIFIC citable source — a recorded vote, a named bill, a questionnaire answer, or a verbatim public statement BY THEM. NEVER infer from party, donors, or endorsements. No citable source after a genuine multi-query search -> 'unclear'.

TIERS (capture cited leans, don't over-discard): confidence >=0.8 = explicit direct statement or clear vote record; 0.4-0.7 = one indirect/single cited signal; below 0.3 or no citable source -> 'unclear'. Every non-unclear position needs a real source_url + (verbatim quote OR a factual vote/bill citation).

WORDING-MATCH RULE: the evidence must match each issue's EXACT framing, including timeframe/scope. A statement about a different scope or a "current crisis" does NOT answer a timeless-principle question -> mark 'unclear', not a match.

Per issue: predicted_vote ('yes'|'no'|'unclear' relative to the issue AS FRAMED); stance_strength 1-5 or null; confidence 0-1 or null; supporting_quote (verbatim or factual vote cite, else null); source_url (real/reachable, else null); source_type (vote_record, bill_cosponsorship, questionnaire, official_page, speech, interview, social_post, news, other, or null); reasoning (1-2 sentences naming the evidence).

ISSUES (all national; one object per id):
${Object.keys(ONB).map(id => `[${id}] ${ONB[id]}`).join('\n')}

Return {positions:[...]}.`;

const verifyPrompt = (c, items) => `You are an adversarial fact-checker for "Of the People." A research analyst produced positions for ${c.name} (${c.party}, ${c.office}). TRY TO REFUTE each: independently confirm the citation exists, is BY/ABOUT this candidate, and genuinely supports the stance at the issue's exact framing. Default to downgrading to 'unclear' if you cannot positively confirm. Watch for party-inference dressed up with a tangential citation — that fails.

For each: fetch source_url and/or targeted search. Holds -> citation_holds=true (you may refine strength/confidence; if a quote was a paraphrase, replace with the true verbatim text). Fails (dead/wrong link, not them, off-framing, fabricated, party-only inference) -> citation_holds=false, predicted_vote='unclear', null strength/confidence/quote.

POSITIONS:
${items.map(f => `[issue ${f.issue_id}] "${ONB[String(f.issue_id)]}"
   claimed: vote=${f.predicted_vote}, strength=${f.stance_strength}, confidence=${f.confidence}
   quote: ${JSON.stringify(f.supporting_quote)}
   source: ${f.source_url} (${f.source_type})`).join('\n\n')}

Return {verdicts:[...]} (one per issue, final corrected fields + a one-line note).`;

phase('Research');
const results = await pipeline(
  CANDIDATES,
  (c) => agent(researchPrompt(c), { label:`research:${c.name.split(' ').slice(-1)[0]}`, phase:'Research', agentType:'general-purpose', schema:RESEARCH_SCHEMA })
           .then(r => ({ c, found: ((r && r.positions) || []).filter(p => p.predicted_vote !== 'unclear' && p.source_url) })),
  (res) => res.found.length
      ? agent(verifyPrompt(res.c, res.found), { label:`verify:${res.c.name.split(' ').slice(-1)[0]}`, phase:'Verify', model:'claude-sonnet-4-6', agentType:'general-purpose', schema:VERDICT_SCHEMA })
          .then(v => ({ repId: res.c.rep_id, name: res.c.name, verdicts: (v && v.verdicts) || [] }))
      : Promise.resolve({ repId: res.c.rep_id, name: res.c.name, verdicts: [] })
);

const confirmed = [];
const summary = {};
for (const r of results.filter(Boolean)) {
  let held = 0;
  for (const v of r.verdicts) {
    if (v.citation_holds === false || v.predicted_vote === 'unclear') continue;
    const conf = v.confidence ?? null;
    if (conf == null || conf < 0.3) continue;
    held++;
    confirmed.push({ repId: r.repId, issue_id: v.issue_id, predicted_vote: v.predicted_vote,
      stance_strength: v.stance_strength ?? 3, confidence: conf,
      supporting_quote: v.supporting_quote ?? null, source_url: v.source_url ?? null });
  }
  summary[r.name] = held;
}
log(`Onboarding inference: ${confirmed.length} confirmed across ${Object.keys(summary).length} candidates — ${JSON.stringify(summary)}`);

const esc = s => s == null ? null : String(s).replace(/'/g, "''");
const rows = confirmed.map(r =>
  `  (${r.repId}, ${r.issue_id}, '${r.predicted_vote}', ${r.stance_strength}::smallint, ${r.confidence}, ` +
  `${r.supporting_quote == null ? 'null' : `'${esc(r.supporting_quote)}'`}, ${r.source_url == null ? 'null' : `'${esc(r.source_url)}'`})`);
const seedSql = confirmed.length ? (
`-- ballot onboarding inference (batch) — ${confirmed.length} positions across ${Object.keys(summary).length} candidates
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised, onboarding)', now()
from (values
${rows.join(',\n')}
) as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,
  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at
where public.rep_positions.predicted_vote not in ('yes','no')
   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);`
) : '-- no positions cleared the floor';

return { summary, confirmed, seedSql };
