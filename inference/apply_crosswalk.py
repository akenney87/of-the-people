#!/usr/bin/env python3
"""Phase B applier: map a member's votes/cosponsorships through the issue->vote
crosswalk to produce rep_positions. Resolves the ACTUAL final-passage roll call
(and member vote) from each bill via the Congress.gov API + House Clerk XML, so we
never trust a stored roll-call number. Emits a report + a rep_positions upsert SQL
(reviewed by a human, then applied).

Usage: python inference/apply_crosswalk.py            # defaults to Clyde
       python inference/apply_crosswalk.py C001116 20 "Clyde, Andrew"
"""
import os, sys, re, json, time, urllib.request, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIOGUIDE = sys.argv[1] if len(sys.argv) > 1 else "C001116"
REP_ID   = int(sys.argv[2]) if len(sys.argv) > 2 else 20
NAME     = sys.argv[3] if len(sys.argv) > 3 else "Clyde, Andrew"

KEY = None
for line in open(os.path.join(ROOT, '.env'), encoding='utf-8'):
    if line.startswith('CONGRESS_API_KEY='):
        KEY = line.split('=', 1)[1].strip().strip('"').strip("'")
assert KEY, "CONGRESS_API_KEY not found in .env"

BTYPE = {'H.R.': 'hr', 'H.J.Res.': 'hjres', 'H.Con.Res.': 'hconres', 'S.': 's'}
INC = re.compile(r'on passage|agree to the senate amendment|suspend the rules and pass|passed/agreed to|on motion to concur', re.I)
EXC = re.compile(r'motion to table|reconsider|previous question|recommit|ordered|quorum|adjourn', re.I)

def api(path):
    url = f"https://api.congress.gov/v3/{path}" + ('&' if '?' in path else '?') + 'api_key=' + KEY
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'otp-crosswalk'}), timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 2: raise
            time.sleep(1.5)

def billparts(bill, congress):
    m = re.match(r'(H\.R\.|H\.J\.Res\.|H\.Con\.Res\.|S\.)\s*(\d+)', bill)
    return BTYPE[m.group(1)], m.group(2)

def resolve_vote(congress, bt, num):
    """Return (vote, roll, url) for the member on the bill's final House passage, or None."""
    d = api(f"bill/{congress}/{bt}/{num}/actions?format=json&limit=250")
    cands = []
    for a in d.get('actions', []):
        text, date = a.get('text', ''), a.get('actionDate', '')
        for rv in a.get('recordedVotes', []):
            if rv.get('chamber') == 'House':
                cands.append({'date': date, 'text': text, 'roll': rv.get('rollNumber'), 'url': rv.get('url')})
    passage = [c for c in cands if INC.search(c['text']) and not EXC.search(c['text'])]
    pool = passage or [c for c in cands if not EXC.search(c['text'])] or cands
    if not pool:
        return None
    pool.sort(key=lambda c: (c['date'], c['roll'] or 0))
    chosen = pool[-1]
    try:
        with urllib.request.urlopen(urllib.request.Request(chosen['url'], headers={'User-Agent': 'otp-crosswalk'}), timeout=30) as r:
            root = ET.fromstring(r.read())
    except Exception:
        return None
    for rv in root.iter('recorded-vote'):
        leg = rv.find('legislator')
        if leg is not None and leg.get('name-id') == BIOGUIDE:
            return (rv.find('vote').text, chosen['roll'], chosen['url'])
    return None  # member not in this vote (not in office / didn't vote)

def is_sponsor(congress, bt, num):
    d = api(f"bill/{congress}/{bt}/{num}?format=json")
    for s in d.get('bill', {}).get('sponsors', []) or []:
        if s.get('bioguideId') == BIOGUIDE: return True
    c = api(f"bill/{congress}/{bt}/{num}/cosponsors?format=json&limit=250")
    for s in c.get('cosponsors', []) or []:
        if s.get('bioguideId') == BIOGUIDE: return True
    return False

xwalk = json.load(open(os.path.join(ROOT, 'inference', 'crosswalk_national.json'), encoding='utf-8'))
by_issue = {}
report = []
for e in xwalk:
    bt, num = billparts(e['bill'], e['congress'])
    res = None
    if e['evidence_kind'] == 'roll_call':
        rv = resolve_vote(e['congress'], bt, num)
        if rv:
            vote, roll, url = rv
            v = vote.strip().lower()
            if v in ('yea', 'aye', 'yes'):
                pv = e['yea_means']
            elif v in ('nay', 'no'):
                pv = 'no' if e['yea_means'] == 'yes' else 'yes'
            else:
                pv = None  # Present / Not Voting
            if pv:
                res = {'pv': pv, 'conf': e['base_confidence'], 'str': e['base_strength'],
                       'quote': f"Voted {vote} on {e['bill']} ({e['name']}), House roll call {roll} ({e['congress']}th Congress).",
                       'url': url, 'kind': 'roll_call'}
            status = f"voted {vote} -> {pv or 'skip(present/NV)'}"
        else:
            status = "no recorded vote / not in office"
    else:  # sponsorship
        if is_sponsor(e['congress'], bt, num):
            res = {'pv': e['yea_means'], 'conf': e['base_confidence'], 'str': e['base_strength'],
                   'quote': f"Cosponsored {e['bill']} ({e['name']}) ({e['congress']}th Congress).",
                   'url': f"https://www.congress.gov/bill/{e['congress']}th-congress/{ {'hr':'house-bill','hjres':'house-joint-resolution','hconres':'house-concurrent-resolution','s':'senate-bill'}[bt] }/{num}",
                   'kind': 'sponsorship'}
            status = f"cosponsored -> {e['yea_means']}"
        else:
            status = "not a (co)sponsor -> skip"
    report.append({'issue': e['issue_id'], 'bill': e['bill'], 'kind': e['evidence_kind'], 'status': status})
    if res:
        cur = by_issue.get(e['issue_id'])
        # prefer roll_call over sponsorship, then higher confidence
        rank = lambda r: (1 if r['kind'] == 'roll_call' else 0, r['conf'])
        if cur is None or rank(res) > rank(cur):
            by_issue[e['issue_id']] = res
    time.sleep(0.3)

# emit SQL
esc = lambda s: s.replace("'", "''")
rows = []
for iid, r in sorted(by_issue.items()):
    rows.append(f"  ({REP_ID}, {iid}, '{r['pv']}', {r['str']}::smallint, {r['conf']}, "
                f"'{esc(r['quote'])}', '{esc(r['url'])}')")
sql = (f"-- Clyde ({NAME}, rep {REP_ID}) — crosswalk-applied positions ({len(rows)} issues)\n"
       "-- Reconciliation: fill gaps + overwrite existing ONLY when the crosswalk is stronger\n"
       "-- (or the existing row is not a clear yes/no). Never downgrades a solid prior position.\n"
       "insert into public.rep_positions\n"
       "  (rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url, model, inferred_at)\n"
       "select v.rep_id, v.issue_id, v.predicted_vote, v.stance_strength, v.confidence, v.supporting_quote, v.source_url,\n"
       "       'crosswalk: congress.gov vote/cosponsorship (supervised)', now()\n"
       "from (values\n" + ",\n".join(rows) + "\n"
       ") as v(rep_id, issue_id, predicted_vote, stance_strength, confidence, supporting_quote, source_url)\n"
       "on conflict (rep_id, issue_id) do update set\n"
       "  predicted_vote=excluded.predicted_vote, stance_strength=excluded.stance_strength, confidence=excluded.confidence,\n"
       "  supporting_quote=excluded.supporting_quote, source_url=excluded.source_url, model=excluded.model, inferred_at=excluded.inferred_at\n"
       "where public.rep_positions.predicted_vote not in ('yes','no')\n"
       "   or coalesce(excluded.confidence,0) > coalesce(public.rep_positions.confidence,0);\n")
open(os.path.join(ROOT, 'inference', '_clyde_crosswalk.sql'), 'w', encoding='utf-8', newline='\n').write(sql)

print(f"=== {NAME} ({BIOGUIDE}) crosswalk resolution ===")
for r in report:
    print(f"  [{r['issue']:3}] {r['bill']:13} {r['kind']:11} {r['status']}")
print(f"\nResolved positions: {len(by_issue)} issues -> {sorted(by_issue)}")
print("SQL written to inference/_clyde_crosswalk.sql")
