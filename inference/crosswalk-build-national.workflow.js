export const meta = {
  name: 'crosswalk-build-national',
  description: 'Phase A: build the issue->vote crosswalk for the 38 NATIONAL issues. Opus research agents find canonical recent (118th-119th Congress) recorded votes per issue with a direction mapping (yea_means); Sonnet adversarially verifies every direction. Returns curated entries + ready-to-apply seed SQL. (Builds the MAP only — applying it to a member is Phase B.)',
  phases: [
    { title: 'Research', detail: 'Opus: find canonical roll-call votes per issue + propose yea_means direction' },
    { title: 'Verify', detail: 'Sonnet: confirm each measure exists and the direction is correct vs the issue framing', model: 'claude-sonnet-4-6' },
  ],
}

const ISSUES = {
  "101": "Should there be strict limits on money in politics, even if that restricts how much individuals and groups can spend to support causes they believe in?",
  "102": "When making gun policy, should reducing gun violence generally take priority over protecting gun owners' rights?",
  "103": "Should abortion be legal in most circumstances?",
  "104": "Should the government do more to solve problems and help people, even if that means higher taxes?",
  "105": "Should the wealthiest Americans pay significantly higher taxes to reduce economic inequality?",
  "106": "Should the government guarantee health coverage for everyone, even if it means higher taxes and a larger government role in healthcare?",
  "107": "When environmental protection and economic growth conflict, should protecting the environment generally come first?",
  "108": "Should most undocumented immigrants already living in the U.S. have a path to legal status and eventual citizenship?",
  "109": "Should the criminal justice system focus more on rehabilitation than on tougher sentencing and policing?",
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
  "122": "Should public college be tuition-free for in-state students?",
  "123": "Should employers be required to provide paid family and medical leave?",
  "124": "Should the government provide universal, affordable childcare?",
  "125": "Should the government provide every adult a guaranteed basic income?",
  "126": "Should the federal minimum wage be raised substantially above $7.25 an hour?",
  "127": "Should the government cap how much landlords can raise rent?",
  "128": "Should parents be able to use public funds to send their children to private schools?",
  "129": "Should the U.S. expand nuclear power to help meet energy needs and reduce emissions?",
  "130": "Should the U.S. tighten security at the border to reduce illegal crossings?",
  "131": "Should police be restricted from using facial-recognition technology to identify people?",
  "132": "Should speech that many people consider hateful still be protected as free speech?",
  "133": "Should the government more tightly regulate what content social media companies are allowed to host or remove?",
  "134": "Should the government be more willing to break up very large corporations?",
  "135": "Should the U.S. limit free trade to protect American jobs and industries, even if it raises prices for consumers?",
  "136": "Should members of Congress face term limits?",
  "137": "Should voting district lines be drawn by an independent body rather than by politicians?",
  "138": "Should the President be elected by national popular vote instead of the Electoral College?"
};
const ALL = Object.keys(ISSUES).map(Number);
function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}

const ENTRY_PROPS = {
  issue_id:{type:'integer'},
  congress:{type:'integer'},
  chamber:{type:'string', enum:['house','senate']},
  measure:{type:'string'},
  measure_url:{type:['string','null']},
  description:{type:'string'},
  yea_means:{type:'string', enum:['yes','no']},
  evidence_kind:{type:'string', enum:['roll_call','sponsorship']},
  base_strength:{type:['integer','null']},
  base_confidence:{type:['number','null']},
  reasoning:{type:'string'},
};
const RESEARCH_SCHEMA = { type:'object', properties:{ entries:{ type:'array', items:{
  type:'object', properties:ENTRY_PROPS,
  required:['issue_id','congress','chamber','measure','description','yea_means','evidence_kind','reasoning'] } } }, required:['entries'] };
const VERDICT_SCHEMA = { type:'object', properties:{ verdicts:{ type:'array', items:{
  type:'object', properties:Object.assign({}, ENTRY_PROPS, { direction_holds:{type:'boolean'}, notes:{type:'string'} }),
  required:['issue_id','measure','direction_holds','yea_means','notes'] } } }, required:['verdicts'] };

const researchPrompt = (grp) => `You are a congressional-data analyst building a REUSABLE evidence map for "Of the People," a nonpartisan voter-alignment app. For each issue below, find the CANONICAL recorded congressional votes that reveal where a member stands — this map will be applied to MANY members, so pick the votes a fair analyst would use to judge anyone.

For each issue, return 1-3 entries (fewer if no clean vote exists). Strongly prefer:
- HOUSE final-passage roll-call votes from the 118th or 119th Congress (recent, and most GA-09 members are in the House).
- Votes with a clear substantive/partisan split. EXCLUDE procedural votes (motion to recommit, previous question, motion to table) — they don't reveal a policy stance.
- Real, citable measures: give the bill number (e.g. "H.R.2"), a short roll-call identifier if known (e.g. "House Roll Call 2023-145"), and a congress.gov or clerk.house.gov URL.

The CRUCIAL field is yea_means: what a YEA vote on that measure implies for the issue AS FRAMED (relative to the exact wording given). Get the direction right — e.g. a YEA on a national abortion-ban bill => "no" on "abortion should be legal"; a YEA on the Secure the Border Act => "yes" on "tighten security at the border." Re-read each issue's wording.

Fields per entry: issue_id; congress (118 or 119); chamber; measure; measure_url; description (one line: what it does); yea_means ('yes'|'no'); evidence_kind ('roll_call', or 'sponsorship' only if no floor vote exists and a named bill cosponsorship is the best signal); base_strength (1-5 intensity a single such vote implies; final passage of a flagship bill = 4-5); base_confidence (roll_call 0.80-0.95; sponsorship 0.55-0.75); reasoning (1-2 sentences).

Some issues rarely get a floor vote (e.g. term limits, national popular vote, independent redistricting). If so, return at most one 'sponsorship' entry (a constitutional-amendment / reform bill) or an empty list for that issue — do NOT invent a vote.

ISSUES:
${grp.map(id => `[${id}] ${ISSUES[String(id)]}`).join('\n')}

Return {entries:[...]}.`;

const verifyPrompt = (items) => `You are an adversarial fact-checker validating a REUSABLE issue->vote crosswalk for "Of the People." Because each entry will score MANY members, a wrong direction mapping is high-blast-radius. For each proposed entry, TRY TO REFUTE it:
1. Does the measure actually exist (real bill number, real Congress, real roll-call)? Fetch/search to confirm.
2. Is the description accurate to what the bill does?
3. Is it a substantive vote, not procedural?
4. **Direction:** is yea_means correct relative to the issue AS FRAMED? This is the key check — re-read the issue wording and confirm a YEA truly implies that yes/no.

If all hold: direction_holds=true (you may refine base_strength/base_confidence). If anything fails: direction_holds=false (and if only the direction is backwards, set the corrected yea_means and explain).

ENTRIES:
${items.map(e => `[issue ${e.issue_id}] "${ISSUES[String(e.issue_id)]}"
   measure: ${e.measure} (${e.congress}, ${e.chamber}) — ${e.description}
   url: ${e.measure_url}
   yea_means: ${e.yea_means} | kind: ${e.evidence_kind} | strength ${e.base_strength} conf ${e.base_confidence}`).join('\n\n')}

Return {verdicts:[...]} (one per entry above, with final corrected fields + a one-line note).`;

phase('Research');
const batches = chunk(ALL, 8);  // 5 batches of ~8 issues
const results = await pipeline(
  batches,
  (grp) => agent(researchPrompt(grp), { label:`research:${grp[0]}-${grp[grp.length-1]}`, phase:'Research', agentType:'general-purpose', schema:RESEARCH_SCHEMA })
             .then(r => (r && r.entries || [])),
  (entries, grp) => entries.length
      ? agent(verifyPrompt(entries), { label:`verify:${grp[0]}-${grp[grp.length-1]}`, phase:'Verify', model:'claude-sonnet-4-6', agentType:'general-purpose', schema:VERDICT_SCHEMA })
          .then(r => (r && r.verdicts || []))
      : Promise.resolve([])
);

const verified = results.filter(Boolean).flat().filter(v => v.direction_holds !== false);
const summary = {};
for (const v of verified) summary[v.issue_id] = (summary[v.issue_id]||0) + 1;
log(`Crosswalk: ${verified.length} verified entries across ${Object.keys(summary).length} of ${ALL.length} issues`);

const esc = s => s==null ? null : String(s).replace(/'/g, "''");
const val = (e) => `  (${e.issue_id}, ${e.congress}, '${e.chamber}', '${esc(e.measure)}', ` +
  `${e.measure_url==null?'null':`'${esc(e.measure_url)}'`}, ${e.description==null?'null':`'${esc(e.description)}'`}, ` +
  `'${e.yea_means}', '${e.evidence_kind||'roll_call'}', ${e.base_strength==null?'null':e.base_strength}::smallint, ` +
  `${e.base_confidence==null?'null':e.base_confidence}, true, ${e.notes==null?'null':`'${esc(e.notes)}'`})`;
const seedSql = verified.length ? (
`-- issue_vote_crosswalk (national) — ${verified.length} verified entries
insert into public.issue_vote_crosswalk
  (issue_id, congress, chamber, measure, measure_url, description, yea_means, evidence_kind, base_strength, base_confidence, verified, notes)
values
${verified.map(val).join(',\n')}
on conflict (issue_id, congress, chamber, measure) do update set
  measure_url=excluded.measure_url, description=excluded.description, yea_means=excluded.yea_means,
  evidence_kind=excluded.evidence_kind, base_strength=excluded.base_strength,
  base_confidence=excluded.base_confidence, verified=excluded.verified, notes=excluded.notes;`
) : '-- no verified entries';

return { count: verified.length, issues_covered: Object.keys(summary).length, byIssue: summary, entries: verified, seedSql };
