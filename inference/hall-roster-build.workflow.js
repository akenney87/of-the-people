export const meta = {
  name: 'hall-roster-build',
  description: 'Build the Hall County GA roster: the Nov 2026 general-election ballot (offices + candidates) and current county/Gainesville officeholders, from authoritative sources (Hall County Board of Elections, GA SoS, Ballotpedia). Roster/names only — NOT positions. Returns structured, cited offices for assembly into contests/candidacies/representatives.',
  phases: [ { title: 'Roster', detail: 'one agent per tier gathers offices + candidates + incumbents, cited' } ],
}

const PREAMBLE = `You are a civic-data researcher for "Of the People" building the official roster for HALL COUNTY, GEORGIA. Today is mid-June 2026: the May 19 primary and June 16 primary runoff are DECIDED, so report the candidates who will appear on the NOVEMBER 3, 2026 GENERAL ELECTION ballot — the party nominees plus any independent/third-party candidates. Also report the CURRENT officeholder for each office.

AUTHORITATIVE SOURCES (use real WebSearch/WebFetch): Hall County Board of Elections / Registrar (sample ballots, qualified-candidate lists), Georgia Secretary of State (qualifying & candidate lists, sos.ga.gov), Ballotpedia (Hall County and the specific races), Vote411, official campaign/government sites.

CARDINAL RULE: every candidate AND current officeholder must have a real, reachable source_url. NEVER invent a candidate or guess. If a race is uncontested, single-candidate, or you cannot confirm the field, say so honestly (empty candidates list + a note). Accuracy over completeness — this is a civic-trust product.

Use "Last, First" for candidate_name when possible. Mark is_incumbent true only if that person currently holds the seat.`

const OFFICE_PROPS = {
  office_name: { type: 'string' },
  level: { type: 'string', enum: ['federal', 'state', 'county', 'city'] },
  is_statewide: { type: 'boolean' },
  cong_district: { type: ['string', 'null'] },
  state_senate_district: { type: ['string', 'null'] },
  state_house_district: { type: ['string', 'null'] },
  county_commission_district: { type: ['string', 'null'] },
  school_board_district: { type: ['string', 'null'] },
  city_council_district: { type: ['string', 'null'] },
  county: { type: ['string', 'null'] },
  city: { type: ['string', 'null'] },
  on_2026_general_ballot: { type: 'boolean' },
  current_officeholder: { type: ['object', 'null'], properties: {
    name: { type: 'string' }, party: { type: ['string', 'null'] }, source_url: { type: ['string', 'null'] } } },
  candidates: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' }, party: { type: ['string', 'null'] }, is_incumbent: { type: 'boolean' },
    website: { type: ['string', 'null'] }, source_url: { type: 'string' } }, required: ['name', 'source_url'] } },
  notes: { type: 'string' },
}
const ROSTER_SCHEMA = { type: 'object', properties: { offices: { type: 'array', items: {
  type: 'object', properties: OFFICE_PROPS, required: ['office_name', 'level', 'on_2026_general_ballot', 'candidates'] } } }, required: ['offices'] }

const TIERS = [
  { key: 'statewide', task: `TIER: Georgia STATEWIDE constitutional offices on the 2026 general ballot BEYOND Governor / Lt. Governor / Attorney General / Secretary of State (those are already done). Cover: Agriculture Commissioner, Insurance Commissioner, Labor Commissioner, State School Superintendent, and any Public Service Commission seats up in 2026. For each: the general-election candidates (both nominees + others) and the current officeholder. Set level='state', is_statewide=true.` },
  { key: 'stateleg', task: `TIER: Hall County's GEORGIA STATE LEGISLATURE seats on the 2026 general ballot. First determine which GA Senate districts (49 and 50 are known) and which GA HOUSE districts cover Hall County (research the district map — likely several in the 026-031 range). For EACH such district: office_name 'State Senator' or 'State Representative', set state_senate_district or state_house_district (3-char zero-padded for house, e.g. '029'), level='state', and list the 2026 general candidates + current incumbent.` },
  { key: 'county', task: `TIER: HALL COUNTY offices. (a) Which county offices are on the 2026 general ballot (Board of Commissioners seats up this cycle, plus Sheriff / District Attorney / Tax Commissioner / Clerk of Superior Court / etc. IF their term is up in 2026) — list candidates. (b) CURRENT officeholders for the main county offices even if not up in 2026 (Commission chair + each district, Sheriff, DA, Tax Commissioner, Clerk of Superior Court, Probate Judge, Magistrate Chief Judge, Coroner). Set level='county', county='Hall', and county_commission_district where applicable.` },
  { key: 'schools_judicial', task: `TIER: Hall County BOARD OF EDUCATION races on the 2026 general ballot (which district seats are up + candidates + current members; set school_board_district) AND nonpartisan JUDICIAL races on Hall's 2026 ballot (Georgia Supreme Court / Court of Appeals seats up statewide [is_statewide=true], and Superior Court judges for the Northeastern Judicial Circuit which includes Hall). level='county' for school board (county='Hall'), level='state' for statewide judges.` },
]

phase('Roster')
const results = await parallel(TIERS.map(t => () =>
  agent(`${PREAMBLE}\n\n${t.task}\n\nReturn {offices:[...]} — one object per office, each with its candidates (cited) and current_officeholder.`,
    { label: `roster:${t.key}`, phase: 'Roster', agentType: 'general-purpose', schema: ROSTER_SCHEMA })
    .then(r => ({ tier: t.key, offices: (r && r.offices) || [] }))
))

const all = results.filter(Boolean)
const offices = all.flatMap(r => r.offices.map(o => ({ ...o, _tier: r.tier })))
const summary = {}
for (const r of all) summary[r.tier] = r.offices.length
const totalCandidates = offices.reduce((n, o) => n + (o.candidates ? o.candidates.length : 0), 0)
log(`Roster: ${offices.length} offices across ${all.length} tiers; ${totalCandidates} candidates — ${JSON.stringify(summary)}`)

return { summary, offices }
