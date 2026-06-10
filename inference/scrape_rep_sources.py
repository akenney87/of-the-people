"""Scrape a representative's official site for content the LLM inference
pipeline can later reason over.

Phase 3.2: source collection only — no embeddings, no LLM calls. Outputs
both a local JSON snapshot (under inference/snapshots/) and a SQL file
ready to apply via Supabase MCP.

Usage:
    python inference/scrape_rep_sources.py --rep-id 11 --website https://clyde.house.gov

If --rep-id is omitted, the script prints to stdout instead of writing
SQL — useful for sanity-checking what gets extracted.

Embeddings get filled in by a later pass (Phase 3.3) once an embedding
model key is in env.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


UA = {
    "User-Agent": "OtP civic-tech bot (https://github.com/akenney87/of-the-people)",
    "Accept": "text/html,application/xhtml+xml",
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(SCRIPT_DIR, "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)


def _fetch(url, timeout=20):
    r = requests.get(url, headers=UA, timeout=timeout)
    r.raise_for_status()
    return r.text


def _clean_text(html):
    """Strip nav / header / footer / scripts and return readable plain text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["nav", "header", "footer", "script", "style", "form"]):
        tag.decompose()
    main = (
        soup.find("main")
        or soup.find("div", id=re.compile(r"(content|main|primary)", re.I))
        or soup.find("article")
        or soup.body
        or soup
    )
    text = main.get_text(separator="\n", strip=True)
    # Squeeze runs of blank lines, drop boilerplate footers.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _hash(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _discover_house_gov_pages(homepage_url, html):
    """For a typical .house.gov site, find issue pages + press release index."""
    soup = BeautifulSoup(html, "html.parser")
    pages = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#"): continue
        full = urljoin(homepage_url, href)
        # We only want links inside this rep's domain.
        if urlparse(full).netloc != urlparse(homepage_url).netloc:
            continue
        text = a.get_text(strip=True)
        # Issue pages
        if "/issues/issue/" in full or re.match(r".*/issues/?$", full):
            pages.append({"url": full, "title": text or "Issues", "source_type": "official_page"})
        # Press release index
        if "DocumentTypeID=27" in full or re.search(r"/news/.*press", full, re.I):
            pages.append({"url": full, "title": text or "Press Releases", "source_type": "press_release"})
    # Dedup by URL.
    seen, dedup = set(), []
    for p in pages:
        if p["url"] in seen: continue
        seen.add(p["url"]); dedup.append(p)
    return dedup


def _expand_press_index(index_url, html, limit=8):
    """Press release indexes list dozens of items. Pull the first N detail pages."""
    soup = BeautifulSoup(html, "html.parser")
    items = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#"): continue
        full = urljoin(index_url, href)
        if "documentsingle.aspx" not in full.lower():
            continue
        title = a.get_text(strip=True)
        if not title:
            continue
        items.append({"url": full, "title": title, "source_type": "press_release"})
        if len(items) >= limit:
            break
    return items


def scrape_rep(homepage_url, rep_id=None, limit_press=6):
    """Top-level: scrape a rep, return a list of source-record dicts."""
    print(f"[fetch] {homepage_url}", file=sys.stderr)
    homepage_html = _fetch(homepage_url)
    discovered = _discover_house_gov_pages(homepage_url, homepage_html)
    print(f"[discover] {len(discovered)} top-level pages", file=sys.stderr)

    # Expand the press release index into individual articles.
    expanded = []
    for d in discovered:
        if d["source_type"] == "press_release" and "DocumentTypeID" in d["url"]:
            try:
                html = _fetch(d["url"])
                expanded += _expand_press_index(d["url"], html, limit=limit_press)
                time.sleep(0.3)
            except Exception as e:
                print(f"[warn] index expand failed: {e}", file=sys.stderr)
        else:
            expanded.append(d)

    print(f"[expand] {len(expanded)} total pages to fetch", file=sys.stderr)

    records = []
    seen_hashes = set()
    for p in expanded:
        try:
            html = _fetch(p["url"])
            content = _clean_text(html)
            if len(content) < 200:
                continue                                # too thin to be useful
            h = _hash(content)
            if h in seen_hashes:
                continue                                # dedupe within this run
            seen_hashes.add(h)
            records.append({
                "rep_id":       rep_id,
                "url":          p["url"],
                "source_type":  p["source_type"],
                "title":        p["title"][:300],
                "content":      content,
                "content_hash": h,
            })
            time.sleep(0.4)
        except Exception as e:
            print(f"[warn] fetch failed {p['url']}: {e}", file=sys.stderr)

    return records


def _emit_sql(records, fp):
    """Write idempotent INSERT statements; sources are uniquely keyed on (rep_id, content_hash)."""
    def esc(s):
        if s is None: return "NULL"
        return "'" + str(s).replace("'", "''") + "'"

    fp.write("-- Auto-generated by inference/scrape_rep_sources.py\n")
    fp.write("-- Embedding column intentionally left NULL; Phase 3.3 fills it.\n\n")
    for r in records:
        fp.write(
            "INSERT INTO public.rep_sources (rep_id, source_type, url, title, content, content_hash) VALUES\n  ("
            f"{r['rep_id']}, {esc(r['source_type'])}, {esc(r['url'])}, {esc(r['title'])}, "
            f"{esc(r['content'])}, {esc(r['content_hash'])})\n"
            "ON CONFLICT (rep_id, content_hash) DO NOTHING;\n\n"
        )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--website", required=True, help="rep's homepage URL")
    ap.add_argument("--rep-id", type=int, help="public.representatives.id; required for SQL output")
    ap.add_argument("--name-slug", help="slug for the snapshot file (e.g. 'clyde')")
    ap.add_argument("--limit-press", type=int, default=6)
    args = ap.parse_args()

    records = scrape_rep(args.website, rep_id=args.rep_id, limit_press=args.limit_press)
    print(f"[done] {len(records)} sources captured", file=sys.stderr)

    slug = args.name_slug or urlparse(args.website).netloc.replace(".", "_")

    # Always save a JSON snapshot for inspection / reproducibility.
    json_path = os.path.join(SNAPSHOT_DIR, f"{slug}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"[snapshot] {json_path}", file=sys.stderr)

    # SQL only if we have a rep_id to bind to.
    if args.rep_id:
        sql_path = os.path.join(SNAPSHOT_DIR, f"{slug}.sql")
        with open(sql_path, "w", encoding="utf-8") as f:
            _emit_sql(records, f)
        print(f"[sql] {sql_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
