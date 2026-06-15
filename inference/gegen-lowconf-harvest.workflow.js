export const meta = {
  name: 'gegen-lowconf-harvest',
  description: 'PROTOTYPE the tiered/low-confidence model on Caitlyn Gegen (rep 279, GA-09 challenger) ONLY: re-research her 26 currently-unclear national issues with a LOWERED, lean-preserving threshold under the new wording rubric (Opus), then adversarially verify (Sonnet). Returns likely/confirmed-tier positions + ready-to-apply SQL.',
  phases: [
    { title: 'Research', detail: 'Opus agents mine her stated positions; capture weak-but-CITED leans (>=0.3), not just strong ones' },
    { title: 'Verify', detail: 'one Sonnet agent re-checks every citation + framing/timeframe match', model: 'claude-sonnet-4-6' },
  ],
}

const REP_ID = 279;
const ISSUES = {
  "110": "Should the U.S. reduce its military involvement around the world and focus more on problems at home?",
  "111": "Should transgender women and girls be allowed to compete on female sports teams?",
  "112": "Should same-sex marriage be protected by federal law?",
  "113": "Should minors be able to receive gender-affirming medical care when their parents consent?",
  "114": "Should public schools be allowed to teach students about gender identity and sexual orientation?",
  "115": "Should local school boards be able to remove books from school libraries because of their content?",
  "116": "Should business owners be allowed to refuse services for a same-sex wedding based on their religious beliefs?",
  "117": "Should the death penalty be abolished?",
  "118": "Should terminally ill adults be allowed to end their lives with a doctor's help?",
  "119": "Should marijuana be legal for recreational use nationwide?",
  "120": "Should certain psychedelics be allowed for mental-health treatment under medical supervision?",
  "121": "Should children be required to be vaccinated to attend public schools?",
  "123": "Should employers be required to provide paid family and medical leave?",
  "124": "Should the government provide universal, affordable childcare?",
  "125": "Should the government provide every adult a guaranteed basic income?",
  "126": "Should the federal minimum wage be raised substantially above $7.25 an hour?",
  "127": "Should the government cap how much landlords can raise rent?",
  "128": "Should parents be able to use public funds to send their children to private schools?",
  "129": "Should the U.S. expand nuclear power to help meet energy needs and reduce emissions?",
  "131": "Should police be restricted from using facial-recognition technology to identify people?",
  "132": "Should speech that many people consider hateful still be protected as free speech?",
  "133": "Should the government more tightly regulate what content social media companies are allowed to host or remove?",
  "135": "Should the U.S. limit free trade to protect American jobs and industries, even if it raises prices for consumers?",
  "136": "Should members of Congress face term limits?",
  "137": "Should voting district lines be drawn by an independent body rather than by politicians?",
  "138": "Should the President be elected by national popular vote instead of the Electoral College?"
};
const ALL = Object.keys(ISSUES).map(Number);
function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}

const RESEARCH_SCHEMA = {
  type:'object', properties:{ positions:{ type:'array', items:{ type:'object', properties:{
    issue_id:{type:'integer'},
    predicted_vote:{type:'string', enum:['yes','no','unclear']},
    stance_strength:{type:['integer','null']},
    confidence:{type:['number','null']},
    supporting_quote:{type:['string','null']},
    source_url:{type:['string','null']},
    source_type:{type:['string','null']},
    reasoning:{type:'string'},
  }, required:['issue_id','predicted_vote','reasoning'] } } },
  required:['positions'],
};
const VERDICT_SCHEMA = {
  type:'object', properties:{ verdicts:{ type:'array', items:{ type:'object', properties:{
    issue_id:{type:'integer'}, citation_holds:{type:'boolean'},
    predicted_vote:{type:'string', enum:['yes','no','unclear']},
    stance_strength:{type:['integer','null']}, confidence:{type:['number','null']},
    supporting_quote:{type:['string','null']}, source_url:{type:['string','null']}, source_type:{type:['string','null']},
    notes:{type:'string'},
  }, required:['issue_id','citation_holds','predicted_vote','notes'] } } },
  required:['verdicts'],
};

const researchPrompt = (grp) => `You are a civic-data research analyst for "Of the People," a nonpartisan voter-alignment app. Determine, with CITABLE evidence, where a CHALLENGER stands on specific policy issues.

CANDIDATE: Caitlyn Gegen — Democratic candidate for U.S. House, Georgia District 9 (challenger, no voting record).
SOURCES to mine (in order): her campaign website + issues page; the Main Street News candidate questionnaire (reachable — mine it deeply); candidate forums / interviews / local news (Gainesville Times, Now Habersham, AJC); her social posts; endorsement writeups that quote a stated position. She has NO legislative record, so evidence = her own statements.

CARDINAL RULE: a yes/no MUST trace to a SPECIFIC citable statement BY HER. NEVER infer from party, donors, or endorsements alone. No citable statement -> 'unclear'.

THIS IS A LOW-CONFIDENCE HARVEST — the key difference from a normal pass: do NOT discard weak leans. If you find a real but indirect/single-source signal of her position, RECORD it with an honest low confidence rather than dropping it to 'unclear'. Tiers:
- confidence >= 0.7: explicit, direct statement on this exact issue.
- confidence 0.3-0.6: a real but indirect/single/adjacent cited signal (e.g. a statement on a closely related policy, a questionnaire checkbox without elaboration, a clear thematic commitment). STILL requires a citable source + quote.
- below 0.3 OR no citable source -> predicted_vote 'unclear'.

WORDING-MATCH RULE (critical): her statement must match the issue's EXACT framing, including timeframe. A comment about "the current crisis" or "this administration" does NOT answer a timeless-principle question. If her stance is about a different scope/timeframe than the issue as framed, mark 'unclear', not a match.

For EACH issue output: predicted_vote ('yes'|'no'|'unclear' relative to the issue AS FRAMED); stance_strength 1-5 or null; confidence 0-1 or null; supporting_quote (verbatim, or null); source_url (real/reachable, or null); source_type (questionnaire, official_page, speech, interview, social_post, news, other, or null); reasoning (1-2 sentences naming the evidence and WHY the confidence is what it is).

ISSUES:
${grp.map(id => `[${id}] ${ISSUES[String(id)]}`).join('\n')}

Return {positions:[...]}.`;

const verifyPrompt = (items) => `You are an adversarial fact-checker for "Of the People." A research analyst produced LOW-CONFIDENCE candidate positions for Caitlyn Gegen (Democratic U.S. House challenger, GA-09). TRY TO REFUTE each: independently confirm the cited statement exists, is BY HER, and genuinely supports the stance at the issue's exact framing/timeframe. This is a low-confidence harvest, so the bar is: is there a REAL, reachable citation that a reasonable person would read as this lean? If yes, it may stand as 'likely' (keep confidence modest). If the cite is dead/not-her/off-framing/fabricated, downgrade to 'unclear'.

For each: fetch the source_url and/or search. If it holds -> citation_holds=true (refine confidence; cap at 0.7 unless it's an explicit direct statement). If it fails -> citation_holds=false, predicted_vote='unclear', null strength/confidence/quote.

POSITIONS:
${items.map(f => `[issue ${f.issue_id}] "${ISSUES[String(f.issue_id)]}"
   claimed: vote=${f.predicted_vote}, strength=${f.stance_strength}, confidence=${f.confidence}
   quote: ${JSON.stringify(f.supporting_quote)}
   source: ${f.source_url} (${f.source_type})`).join('\n\n')}

Return {verdicts:[...]} (one per issue, with final corrected fields + a one-line note).`;

phase('Research');
const batches = chunk(ALL, 9);
const researched = await parallel(batches.map((grp,i) => () =>
  agent(researchPrompt(grp), { label:`research:gegen:${grp[0]}-${grp[grp.length-1]}`, phase:'Research', agentType:'general-purpose', schema:RESEARCH_SCHEMA })
    .then(r => (r && r.positions || []))
));
const found = researched.filter(Boolean).flat().filter(p => p.predicted_vote !== 'unclear' && p.source_url);
log(`Research: ${found.length} cited leans found of ${ALL.length} unclear issues`);

phase('Verify');
let verdicts = [];
if (found.length) {
  const r = await agent(verifyPrompt(found), { label:'verify:gegen', phase:'Verify', model:'claude-sonnet-4-6', agentType:'general-purpose', schema:VERDICT_SCHEMA });
  verdicts = (r && r.verdicts) || [];
}

const confirmed = [];
for (const v of verdicts) {
  if (v.citation_holds === false || v.predicted_vote === 'unclear') continue;
  const conf = v.confidence ?? null;
  if (conf == null || conf < 0.3) continue;  // floor
  confirmed.push({
    issue_id: v.issue_id, predicted_vote: v.predicted_vote,
    stance_strength: v.stance_strength ?? null, confidence: conf,
    supporting_quote: v.supporting_quote ?? null, source_url: v.source_url ?? null,
    source_type: v.source_type ?? null,
    tier: conf >= 0.7 ? 'confirmed' : 'likely', notes: v.notes ?? '',
  });
}
const tiers = { confirmed: confirmed.filter(c=>c.tier==='confirmed').length, likely: confirmed.filter(c=>c.tier==='likely').length };
log(`Verify: ${confirmed.length} held (${tiers.confirmed} confirmed, ${tiers.likely} likely) of ${found.length} candidates`);

const sqlEsc = s => s==null ? null : String(s).replace(/'/g, "''");
const values = confirmed.map(r =>
  `  (${r.issue_id}, '${r.predicted_vote}', ${r.stance_strength==null?'null':r.stance_strength}::smallint, ${r.confidence}, ` +
  `${r.supporting_quote==null?'null':`'${sqlEsc(r.supporting_quote)}'`}, ${r.source_url==null?'null':`'${sqlEsc(r.source_url)}'`})`
).join(',\n');
const seedSql = confirmed.length ? (
`-- Caitlyn Gegen (rep 279) — ${confirmed.length} low-confidence-harvest positions (tiered, verified)
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select ${REP_ID}, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised, low-conf harvest)', now()
from (values
${values}
) as v(issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength,
  confidence=excluded.confidence, supporting_quote=excluded.supporting_quote,
  source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at;`
) : '-- no positions cleared the floor';

return { tiers, confirmed, seedSql };
