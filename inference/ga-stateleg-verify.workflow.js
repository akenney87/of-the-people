export const meta = {
  name: 'ga-stateleg-verify',
  description: 'Adversarially verify the RECOVERED GA state-leg findings for Echols (SD49) & Dubnik (HD029) — batched one agent per candidate, on Sonnet, emits ready-to-apply seed SQL so output is never stranded',
  phases: [
    { title: 'Verify', detail: 'one Sonnet agent per candidate independently re-fetches every citation', model: 'claude-sonnet-4-6' },
  ],
}

// ---------------------------------------------------------------------------
// WHY THIS SCRIPT EXISTS
// The original ga-stateleg-inference run completed its 12 RESEARCH agents but hit
// the session limit before the adversarial verify + seed-write could finish. The
// research is already recovered (inference/stateleg_recovered.json) and Echols'
// 7 verifier-confirmed positions are shipped (seeds/12_stateleg_echols.sql).
// This continuation verifies ONLY the 16 still-unverified findings, so we do NOT
// re-spend on research, and applies the two efficiency levers we agreed on:
//   1. VERIFY ON SONNET (model: 'claude-sonnet-4-6') -- citation-checking is a
//      bounded task; Sonnet does it well at ~40% lower cost than Opus.
//   2. BATCHED -- one agent per CANDIDATE instead of one per cell (16 -> 2 agents).
// Output safety: the verified results AND ready-to-apply rep_positions SQL are
// returned (and journaled), so a limit-hit after completion can't strand them.
//
// To finish the dataset, run:  Workflow({ scriptPath: <this file> })
// (no args needed -- the recovered findings are embedded below). To reuse the
// pipeline for other candidates, pass args.findings with the same shape.
// ---------------------------------------------------------------------------

const ISSUES = {
  "102": "When making gun policy, should reducing gun violence generally take priority over protecting gun owners' rights?",
  "104": "Should the government do more to solve problems and help people, even if that means higher taxes?",
  "105": "Should the wealthiest Americans pay significantly higher taxes to reduce economic inequality?",
  "111": "Should transgender women and girls be allowed to compete on female sports teams?",
  "113": "Should minors be able to receive gender-affirming medical care when their parents consent?",
  "128": "Should parents be able to use public funds to send their children to private schools?",
  "130": "Should the U.S. tighten border security and reduce overall immigration levels?",
  "202": "Should Georgia eliminate its state income tax, even if that means raising sales taxes?",
  "203": "Should Georgia make registering and voting easier, even if that means looser verification requirements?",
  "205": "Should Georgia keep the limits on citizen's arrests it passed after the Ahmaud Arbery case?",
  "206": "Should Georgia require a permit and background check to carry a concealed handgun in public?",
  "208": "Should Georgia legalize casinos and sports betting?",
  "209": "Should Georgia pass a statewide law banning discrimination based on sexual orientation and gender identity?",
  "210": "Should Georgia keep its current law banning most abortions after about six weeks?"
};

// The 16 recovered-but-unverified yes/no findings (Echols 4, Dubnik 12).
const RECOVERED_FINDINGS = [
  {
    "candidate": "Echols",
    "repId": 73,
    "district": "SD49",
    "issue_id": 130,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.7,
    "supporting_quote": "Voted Yea on SB 21 (2025), waiving sovereign immunity for 'sanctuary' local governments (Senate passed 33-18).",
    "source_url": "https://open.pluralpolicy.com/vote/1207178c-d393-45b6-8a01-1ebf1e91acf0/",
    "source_type": "vote_record"
  },
  {
    "candidate": "Echols",
    "repId": 73,
    "district": "SD49",
    "issue_id": 202,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.6,
    "supporting_quote": "Voted Yea on HB 111 (2025), accelerating Georgia's income-tax-rate cut, and carried companion HB 112 ($1B tax refund) in the Senate.",
    "source_url": "https://gov.georgia.gov/press-releases/2025-04-15/gov-kemp-signs-legislation-delivering-more-1-billion-tax-cuts-and-relief",
    "source_type": "vote_record"
  },
  {
    "candidate": "Echols",
    "repId": 73,
    "district": "SD49",
    "issue_id": 208,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.7,
    "supporting_quote": "Chairman Drew Echols, R-Gainesville, on the tourism committee's final report recommending legalized mobile sports betting: 'It was a simple recommendation much like the rest of the list. The recommendations are just that.'",
    "source_url": "https://www.thecentersquare.com/georgia/article_d10e2e46-c06e-44c2-bb4d-730ff794ed86.html",
    "source_type": "official_page"
  },
  {
    "candidate": "Echols",
    "repId": 73,
    "district": "SD49",
    "issue_id": 209,
    "predicted_vote": "no",
    "stance_strength": 4,
    "confidence": 0.8,
    "supporting_quote": "Drew Echols signed on to and voted for the Riley Gaines Act (SB 1, 2025), which passed the Georgia Senate 35-17 on Feb. 6, 2025.",
    "source_url": "https://accesswdun.com/article/2025/3/1290007/riley-gaines-act-of-2025-passes-georgia-general-assembly",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 102,
    "predicted_vote": "no",
    "stance_strength": 4,
    "confidence": 0.85,
    "supporting_quote": "Passed multiple pieces of legislation to protect Second Amendment rights, including Constitutional Carry.",
    "source_url": "https://www.dubnikforhouse.com/scorecard/",
    "source_type": "official_page"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 104,
    "predicted_vote": "no",
    "stance_strength": 4,
    "confidence": 0.8,
    "supporting_quote": "passage of the two largest State income tax cuts in Georgia history ... sponsoring a bill to eliminate the homestead property tax statewide",
    "source_url": "https://www.dubnikforhouse.com/about/",
    "source_type": "official_page"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 105,
    "predicted_vote": "no",
    "stance_strength": 3,
    "confidence": 0.6,
    "supporting_quote": "passage of the two largest State income tax cuts in Georgia history",
    "source_url": "https://www.dubnikforhouse.com/about/",
    "source_type": "official_page"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 128,
    "predicted_vote": "yes",
    "stance_strength": 4,
    "confidence": 0.9,
    "supporting_quote": "Voted Yea on SB 233 (Georgia Promise Scholarship Act), House passage (passed 91-82, 2024; also Yea on 2023 House vote).",
    "source_url": "https://www.ajc.com/education/georgia-house-votes-for-wider-access-to-school-vouchers-amid-criticism/6UFBVHE6XBDV7NRAFDIZYDWEHI/",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 130,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.7,
    "supporting_quote": "I am in favor of construction of a wall and other necessary infrastructure on our border that gives complete control over entering and exiting the United States.",
    "source_url": "https://ivoterguide.com/candidate/46833/race/11804/election/796",
    "source_type": "official_page"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 202,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.62,
    "supporting_quote": "Voted Yea on HB 1015 (2024 income tax rate reduction; House passed 165-0, Feb 8, 2024); his campaign site states he backed 'passage of the two largest State income tax cuts in Georgia history.'",
    "source_url": "https://www.dubnikforhouse.com/about/",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 111,
    "predicted_vote": "no",
    "stance_strength": 5,
    "confidence": 0.95,
    "supporting_quote": "Voted Yea on HB 267 (Riley Gaines Act, House passage, Feb 27, 2025); also named co-sponsor of HB 1084 (2022) which authorized banning transgender girls from girls' teams.",
    "source_url": "https://fastdemocracy.com/bill-search/ga/2025_26/bills/GAB00028990/?report-bill-view=1",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 113,
    "predicted_vote": "no",
    "stance_strength": 4,
    "confidence": 0.9,
    "supporting_quote": "Voted Yea on SB 140 (House passage, March 16, 2023), banning hormone therapy and surgery for transgender minors.",
    "source_url": "https://fastdemocracy.com/bill-search/ga/2023_24/bills/GAB00024355/",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 203,
    "predicted_vote": "no",
    "stance_strength": 2,
    "confidence": 0.55,
    "supporting_quote": "SB 202 (Election Integrity Act of 2021) passed the Georgia House 100-75 on a party-line vote; the law tightened verification (e.g., absentee-ballot ID, drop-box limits).",
    "source_url": "https://www.ajc.com/politics/bill-changing-georgia-voting-rules-passes-state-house/EY2MATS6SRA77HTOBVEMTJLIT4/",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 205,
    "predicted_vote": "yes",
    "stance_strength": 3,
    "confidence": 0.8,
    "supporting_quote": "HB 479 (2021), which repealed/limited Georgia's Civil War-era citizen's-arrest statute after the Ahmaud Arbery killing, passed the Georgia House 173-0 (unanimous).",
    "source_url": "https://www.cbsnews.com/news/georgia-house-repeal-citizen-arrest-law-ahmaud-arbery-death",
    "source_type": "vote_record"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 206,
    "predicted_vote": "no",
    "stance_strength": 4,
    "confidence": 0.85,
    "supporting_quote": "\"Passed multiple pieces of legislation to protect Second Amendment rights, including Constitutional Carry.\"",
    "source_url": "https://www.dubnikforhouse.com/scorecard/",
    "source_type": "official_page"
  },
  {
    "candidate": "Dubnik",
    "repId": 109,
    "district": "HD029",
    "issue_id": 210,
    "predicted_vote": "yes",
    "stance_strength": 4,
    "confidence": 0.8,
    "supporting_quote": "HB 481 (2019, the six-week 'heartbeat'/LIFE Act) passed the Georgia House 92-78; the five Republicans who crossed party lines to vote NO were named (Silcox, Parrish, Martin, Cooper, Powell) and Dubnik was not among them.",
    "source_url": "https://www.wsbtv.com/news/politics/6-lawmakers-crossed-party-lines-on-final-ga-heartbeat-bill-vote/935466467/",
    "source_type": "vote_record"
  }
];

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    issue_id: { type: 'integer' },
    citation_holds: { type: 'boolean' },
    predicted_vote: { type: 'string', enum: ['yes', 'no', 'unclear'] },
    stance_strength: { type: ['integer', 'null'] },
    confidence: { type: ['number', 'null'] },
    supporting_quote: { type: ['string', 'null'] },
    source_url: { type: ['string', 'null'] },
    source_type: { type: ['string', 'null'] },
    notes: { type: 'string' },
  }, required: ['issue_id', 'citation_holds', 'predicted_vote', 'notes'] } } },
  required: ['verdicts'],
};

const verifyBatchPrompt = (cand, items) => `You are an adversarial fact-checker for "Of the People," a nonpartisan voter-alignment app. A research analyst produced the candidate positions below. Your job is to TRY TO REFUTE each one: independently confirm the citation truly exists and genuinely supports the stated stance. Default to downgrading to 'unclear' if you cannot positively confirm. A wrong or fabricated citation is far worse than an honest 'unclear'.

CANDIDATE: ${cand.name} (repId ${cand.repId}) -- Georgia state ${cand.office}.

For EACH position below, VERIFY with real WebFetch of the source_url and/or targeted WebSearch (Ballotpedia / LegiScan / OpenStates / legis.ga.gov / Georgia news):
1. Is the URL real, reachable, and about THIS candidate?
2. Bill/vote: does that bill number/title exist in the Georgia General Assembly, and did this legislator actually vote/sponsor that way?
3. Quote: does the verbatim text actually appear at the source? If the analyst's quote is a paraphrase, REPLACE it with the true verbatim source text (do not fail it just for wording -- fix it).
4. Direction: does the evidence support the stated yes/no for the issue AS FRAMED? Watch GA-analog direction mapping -- e.g. a vote FOR HB 481 (six-week ban) means 'no' on "abortion legal in most circumstances"; voting FOR permitless carry / against gun limits means 'no' on issue 102/206 as framed.

If everything checks (after fixing a non-verbatim quote): citation_holds=true, keep predicted_vote, you may refine stance_strength (1-5) / confidence (0-1).
If something genuinely fails (dead/wrong link, fabricated bill, not actually their vote, wrong direction): citation_holds=false, predicted_vote='unclear', null the strength/confidence/quote.

POSITIONS TO VERIFY for ${cand.name}:
${items.map(f => `[issue ${f.issue_id}] "${ISSUES[String(f.issue_id)]}"
   claimed: vote=${f.predicted_vote}, strength=${f.stance_strength}, confidence=${f.confidence}
   quote: ${JSON.stringify(f.supporting_quote)}
   source: ${f.source_url} (${f.source_type})`).join('\n\n')}

Return {verdicts: [...]} with one verdict object per issue above, including the final corrected fields and a one-line note each.`;

const CAND_META = {
  73:  { repId: 73,  name: 'Drew Echols',  office: 'Senator (District 49)',        district: 'SD49' },
  109: { repId: 109, name: 'Matt Dubnik',  office: 'Representative (District 029)', district: 'HD029' },
};

const sqlEsc = (s) => s == null ? null : String(s).replace(/'/g, "''");

phase('Verify');
const findings = (args && args.findings) ? args.findings : RECOVERED_FINDINGS;

const byRep = {};
for (const f of findings) (byRep[f.repId] ||= []).push(f);

// ONE Sonnet agent per candidate -- batched, not one-per-cell.
const results = await parallel(Object.entries(byRep).map(([repId, items]) => () => {
  const cand = CAND_META[repId] || { repId: Number(repId), name: `rep ${repId}`, office: 'legislator', district: `rep${repId}` };
  return agent(verifyBatchPrompt(cand, items), {
    label: `verify:${cand.name.split(' ').slice(-1)[0]}`,
    phase: 'Verify',
    model: 'claude-sonnet-4-6',
    agentType: 'general-purpose',
    schema: VERDICT_SCHEMA,
  }).then(r => ({ repId: Number(repId), verdicts: (r && r.verdicts) || [] }));
}));

// Apply the verifier's verdicts (downgrade on citation_holds === false).
const confirmed = [];
const summary = {};
for (const res of results.filter(Boolean)) {
  const cand = CAND_META[res.repId] || { name: `rep ${res.repId}` };
  let held = 0, downgraded = 0;
  for (const v of res.verdicts) {
    if (v.citation_holds === false || v.predicted_vote === 'unclear') { downgraded++; continue; }
    held++;
    confirmed.push({
      repId: res.repId, district: cand.district, issue_id: v.issue_id,
      predicted_vote: v.predicted_vote,
      stance_strength: v.stance_strength ?? null,
      confidence: v.confidence ?? null,
      supporting_quote: v.supporting_quote ?? null,
      source_url: v.source_url ?? null,
      source_type: v.source_type ?? null,
      notes: v.notes ?? '',
    });
  }
  summary[cand.name] = { held, downgraded };
}
log(`Verify done: ${JSON.stringify(summary)} -- ${confirmed.length} confirmed of ${findings.length}`);

// Build ready-to-apply rep_positions SQL, district-keyed (never hardcode serial ids).
const DISTRICT_PRED = {
  SD49:  "position = 'State Senator' and state = 'GA' and state_senate_district = '49'",
  HD029: "position = 'State Representative' and state = 'GA' and state_assembly_district = '029'",
};
const blocks = [];
for (const [repId, cand] of Object.entries(CAND_META)) {
  const rows = confirmed.filter(c => c.repId === Number(repId));
  if (!rows.length) continue;
  const pred = DISTRICT_PRED[cand.district];
  const values = rows.map(r =>
    `  (${r.issue_id}, '${r.predicted_vote}', ${r.stance_strength == null ? 'null' : r.stance_strength}::smallint, ` +
    `${r.confidence == null ? 'null' : r.confidence}, ` +
    `${r.supporting_quote == null ? 'null' : `'${sqlEsc(r.supporting_quote)}'`}, ` +
    `${r.source_url == null ? 'null' : `'${sqlEsc(r.source_url)}'`})`
  ).join(',\n');
  blocks.push(
`-- ${cand.name} (${cand.district}) -- ${rows.length} verified positions
with rep as (select id from public.representatives where ${pred})
insert into public.rep_positions
  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)
select rep.id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,
       'claude-opus-4-8 research + claude-sonnet-4-6 verify (supervised)', now()
from rep cross join (values
${values}
) as v(issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)
on conflict (rep_id, issue_id) do update set
  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength,
  confidence=excluded.confidence, supporting_quote=excluded.supporting_quote,
  source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at;`
  );
}
const seedSql = blocks.join('\n\n');

// Returned (and journaled) -- copy seedSql into seeds/13_stateleg_verified.sql and apply.
return { summary, confirmed, seedSql };
