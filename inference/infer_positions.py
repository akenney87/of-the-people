"""For each (rep, issue) pair, retrieve relevant rep_sources via pgvector
similarity, ask Claude to predict a vote + confidence + supporting quote,
and upsert into rep_positions.

Phase 3.3 of the plan.

Two API keys required, both in env:
    OPENAI_API_KEY        — for text-embedding-3-small (1536 dim)
    ANTHROPIC_API_KEY     — for claude-sonnet-4-7

Plus Supabase connection info, also in env:
    SUPABASE_URL          — https://aeqncvlmgwdnnzhyeovs.supabase.co
    SUPABASE_SERVICE_KEY  — service-role key (NOT the anon key; required to
                            bypass RLS on rep_sources / write rep_positions)

Usage:
    # All onboarding issues for Andrew Clyde:
    python inference/infer_positions.py --rep-id 20

    # A single issue across all reps in a state:
    python inference/infer_positions.py --issue-id 102 --state GA

    # Dry-run — don't write to DB, just print what Claude says:
    python inference/infer_positions.py --rep-id 20 --dry-run
"""

import argparse
import json
import os
import sys
import time

import requests


SUPABASE_URL          = os.getenv("SUPABASE_URL", "https://aeqncvlmgwdnnzhyeovs.supabase.co")
SUPABASE_SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY")
OPENAI_API_KEY        = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY     = os.getenv("ANTHROPIC_API_KEY")

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM   = 1536
INFER_MODEL = "claude-sonnet-4-7"   # Anthropic API model id
TOP_K       = 4                      # how many source chunks to retrieve per issue


# ---------------------------------------------------------------------------
# Supabase REST helpers (no supabase-py dep — keep this single-file)
# ---------------------------------------------------------------------------
def _sb_headers():
    return {
        "apikey":         SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
    }


def sb_select(table, query=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    r = requests.get(url, headers=_sb_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def sb_rpc(fn, payload):
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn}"
    r = requests.post(url, headers=_sb_headers(), json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


def sb_upsert(table, row):
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=rep_id,issue_id"
    headers = _sb_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    r = requests.post(url, headers=headers, json=row, timeout=30)
    r.raise_for_status()


def sb_patch(table, query, patch):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    r = requests.patch(url, headers=_sb_headers(), json=patch, timeout=30)
    r.raise_for_status()


# ---------------------------------------------------------------------------
# OpenAI embeddings
# ---------------------------------------------------------------------------
def embed(text):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set")
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type":  "application/json",
        },
        json={"model": EMBED_MODEL, "input": text},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["data"][0]["embedding"]


def backfill_missing_embeddings():
    """Find rep_sources rows with NULL embedding and fill them."""
    rows = sb_select("rep_sources", "select=id,content&embedding=is.null&limit=200")
    print(f"[embed] {len(rows)} rows missing embeddings", file=sys.stderr)
    for row in rows:
        try:
            vec = embed(row["content"])
        except Exception as e:
            print(f"[warn] embed {row['id']}: {e}", file=sys.stderr); continue
        sb_patch("rep_sources",
                 f"id=eq.{row['id']}",
                 {"embedding": vec, "embed_model": f"openai/{EMBED_MODEL}"})
        time.sleep(0.05)


# ---------------------------------------------------------------------------
# Claude inference
# ---------------------------------------------------------------------------
INFER_SYSTEM = """You are a careful political analyst. You will be shown:

  1. An ISSUE phrased as a yes/no policy question.
  2. EXCERPTS from a representative's official statements, press releases,
     and policy pages.

Your job: predict how that representative would vote on the issue if asked
today, based solely on the excerpts.

Reply ONLY as compact JSON with this exact shape:

  {"predicted_vote": "yes" | "no" | "unclear",
   "confidence": 0.0-1.0,
   "supporting_quote": "<one verbatim sentence or phrase from the excerpts>",
   "rationale": "<one sentence explaining the inference>"}

Rules:
  - "unclear" is the right answer when the excerpts don't speak to the issue.
  - confidence 0.9+ should be rare — reserved for cases where the rep has
    explicitly stated this position.
  - supporting_quote must be a verbatim string actually present in the
    excerpts. If you can't find one, set predicted_vote to "unclear".
  - Do not invent or extrapolate beyond what's written.
"""


def infer_claude(issue_text, excerpts):
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    user = "ISSUE: " + issue_text + "\n\nEXCERPTS:\n\n"
    for i, e in enumerate(excerpts, 1):
        user += f"[{i}] ({e.get('title','source')})\n{e['content']}\n\n"

    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key":         ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type":      "application/json",
        },
        json={
            "model": INFER_MODEL,
            "max_tokens": 400,
            "system": INFER_SYSTEM,
            "messages": [{"role": "user", "content": user}],
        },
        timeout=60,
    )
    r.raise_for_status()
    text = r.json()["content"][0]["text"].strip()
    # Strip markdown code fences if Claude wrapped them
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"): text = text[:-3]
    return json.loads(text)


# ---------------------------------------------------------------------------
# Per-(rep, issue) pipeline
# ---------------------------------------------------------------------------
def retrieve_sources(rep_id, issue_text, k=TOP_K):
    """Top-K rep_sources by cosine similarity to the issue text."""
    vec = embed(issue_text)
    # Use a Postgres function to do pgvector similarity. We don't have one
    # yet — fall back to fetching all sources for this rep and ranking in
    # Python. For small per-rep source counts (~10) this is fine.
    rows = sb_select(
        "rep_sources",
        f"select=id,title,content,embedding,url&rep_id=eq.{rep_id}",
    )
    if not rows: return []

    def cos(a, b):
        import math
        dot = sum(x*y for x,y in zip(a,b))
        na  = math.sqrt(sum(x*x for x in a))
        nb  = math.sqrt(sum(y*y for y in b))
        if na == 0 or nb == 0: return 0.0
        return dot / (na*nb)

    scored = []
    for r in rows:
        e = r.get("embedding")
        if not e: continue
        if isinstance(e, str): e = json.loads(e)
        scored.append((cos(vec, e), r))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:k]]


def infer_one(rep_id, issue_id, issue_text, dry_run=False):
    excerpts = retrieve_sources(rep_id, issue_text)
    if not excerpts:
        print(f"[skip] rep {rep_id} issue {issue_id} — no embedded sources", file=sys.stderr)
        return None
    result = infer_claude(issue_text, excerpts)
    print(f"[ok] rep {rep_id} issue {issue_id}: {result.get('predicted_vote')} ({result.get('confidence')})")

    if dry_run:
        return result

    sb_upsert("rep_positions", {
        "rep_id":           rep_id,
        "issue_id":         issue_id,
        "predicted_vote":   result.get("predicted_vote"),
        "confidence":       result.get("confidence"),
        "supporting_quote": result.get("supporting_quote"),
        "source_url":       excerpts[0].get("url"),
        "source_id":        excerpts[0].get("id"),
        "model":            INFER_MODEL,
        "inferred_at":      time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rep-id",    type=int, help="single rep")
    ap.add_argument("--issue-id",  type=int, help="single issue")
    ap.add_argument("--state",     help="all reps in a given state")
    ap.add_argument("--onboarding-only", action="store_true", help="only issues flagged onboarding")
    ap.add_argument("--dry-run",   action="store_true")
    ap.add_argument("--no-embed",  action="store_true", help="skip embedding backfill")
    args = ap.parse_args()

    for var, val in [("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY),
                     ("OPENAI_API_KEY", OPENAI_API_KEY),
                     ("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY)]:
        if not val:
            print(f"[fatal] {var} not set in env", file=sys.stderr); sys.exit(2)

    if not args.no_embed:
        backfill_missing_embeddings()

    # Build the rep list
    if args.rep_id:
        reps = sb_select("representatives", f"select=id&id=eq.{args.rep_id}")
    elif args.state:
        reps = sb_select("representatives", f"select=id&state=eq.{args.state}")
    else:
        print("Provide --rep-id or --state", file=sys.stderr); sys.exit(2)

    # Build the issue list
    q = "select=id,text"
    if args.issue_id: q += f"&id=eq.{args.issue_id}"
    if args.onboarding_only: q += "&onboarding=eq.true"
    issues = sb_select("issues", q)

    print(f"[start] {len(reps)} reps × {len(issues)} issues = {len(reps)*len(issues)} inferences",
          file=sys.stderr)

    for rep in reps:
        for issue in issues:
            try:
                infer_one(rep["id"], issue["id"], issue["text"], dry_run=args.dry_run)
                time.sleep(0.4)
            except Exception as e:
                print(f"[err] rep {rep['id']} issue {issue['id']}: {e}", file=sys.stderr)

    print("[done]", file=sys.stderr)


if __name__ == "__main__":
    main()
