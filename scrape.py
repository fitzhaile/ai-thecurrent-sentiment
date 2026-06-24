#!/usr/bin/env python3
"""
Scrape The Current GA (thecurrentga.org) articles published in a date window,
via the WordPress REST API, and save them to data/articles.json for sentiment
scoring.

- Stdlib only (no third-party dependencies, no API key, no cost).
- Re-runnable: each run overwrites the output. Adjust the window with
  --after / --before for future one-off re-scrapes.
- Publication dates come from the WP `date` field (authoritative), not sitemap
  lastmod.
- Bylines come from Yoast metadata (`yoast_head_json.author`), which is the true
  byline even for wire/syndicated posts published under a shared desk account.
  The site's /users endpoint is locked (401), so this is the reliable source.

Usage:
    python3 scrape.py
    python3 scrape.py --after 2025-06-23T00:00:00 --before 2026-06-24T00:00:00
"""
import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

BASE = "https://thecurrentga.org/wp-json/wp/v2"
UA = "SentimentResearchBot/1.0 (one-time analysis)"

# Default window = trailing 12 months as of 2026-06-23 (inclusive of 06-23).
# `before` is exclusive in the WP API, so 06-24T00:00 captures all of 06-23.
DEFAULT_AFTER = "2025-06-23T00:00:00"
DEFAULT_BEFORE = "2026-06-24T00:00:00"


def get(url):
    """GET a URL and return (parsed_json, headers). Raises on HTTP error."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8")), dict(r.headers)


def strip_html(s):
    """Reduce rendered HTML to plain text for scoring."""
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def byline(post):
    """The real byline, from Yoast metadata — more accurate than the WP user
    account for wire/syndicated posts. Falls back to schema Person, then id."""
    yh = post.get("yoast_head_json") or {}
    name = (yh.get("author") or "").strip()
    if name:
        return name
    for node in (yh.get("schema", {}) or {}).get("@graph", []):
        if node.get("@type") == "Person" and node.get("name"):
            return node["name"].strip()
    return str(post.get("author"))


def fetch_posts(after, before):
    """Page through /posts in the window (100/page). ~8 requests for ~716 posts."""
    posts, page = [], 1
    fields = "id,date,link,title,content,excerpt,author,categories,yoast_head_json"
    while True:
        q = urllib.parse.urlencode({
            "after": after, "before": before, "per_page": 100, "page": page,
            "orderby": "date", "order": "desc", "_fields": fields,
        })
        try:
            data, headers = get(f"{BASE}/posts?{q}")
        except urllib.error.HTTPError as e:
            if e.code == 400:  # paged past the last page
                break
            raise
        if not data:
            break
        posts.extend(data)
        total_pages = int(headers.get("X-WP-TotalPages", "0") or 0)
        total = headers.get("X-WP-Total", "?")
        print(f"  page {page}/{total_pages or '?'}: +{len(data):3d}  (running {len(posts)}/{total})")
        if total_pages and page >= total_pages:
            break
        page += 1
        time.sleep(0.3)  # be polite
    return posts


def resolve_names(endpoint, ids):
    """Map WP object ids -> display names (used for categories). Best-effort."""
    names, ids = {}, [i for i in ids if i]
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        q = urllib.parse.urlencode(
            {"include": ",".join(map(str, chunk)), "per_page": 100, "_fields": "id,name"})
        try:
            data, _ = get(f"{BASE}/{endpoint}?{q}")
            for o in data:
                names[o["id"]] = html.unescape(o.get("name", ""))
        except urllib.error.HTTPError as e:
            print(f"  note: could not resolve {endpoint} (HTTP {e.code}); will fall back to ids")
        time.sleep(0.2)
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--after", default=DEFAULT_AFTER)
    ap.add_argument("--before", default=DEFAULT_BEFORE)
    ap.add_argument("--out", default="data/articles.json")
    args = ap.parse_args()

    print(f"Scraping The Current GA — published {args.after} .. {args.before}")
    posts = {p["id"]: p for p in fetch_posts(args.after, args.before)}  # dedup by id
    posts = list(posts.values())
    if not posts:
        print("No posts returned — check the window or the site. Nothing written.")
        return

    cat_ids = sorted({c for p in posts for c in (p.get("categories") or [])})
    print(f"Resolving {len(cat_ids)} categories; bylines come from Yoast metadata ...")
    cats = resolve_names("categories", cat_ids)

    articles = []
    for p in posts:
        body = strip_html((p.get("content") or {}).get("rendered", ""))
        cat_names = [cats.get(c, str(c)) for c in (p.get("categories") or [])]
        articles.append({
            "id": p["id"],
            "date": p.get("date"),
            "url": p.get("link"),
            "title": html.unescape((p.get("title") or {}).get("rendered", "")),
            "author": byline(p),
            "categories": cat_names,
            "section": cat_names[0] if cat_names else None,
            "word_count": len(body.split()),
            "text": body,  # full text lives here only; the dashboard's data.json won't include it
        })
    articles.sort(key=lambda a: a["date"] or "")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "source": "thecurrentga.org WordPress REST API",
        "window": {"after": args.after, "before": args.before},
        "note": "publication dates are the authoritative WP `date` field; bylines from Yoast metadata",
        "count": len(articles),
        "articles": articles,
    }, ensure_ascii=False, indent=2))

    # Human-readable summary (operator-facing).
    wc = sorted(a["word_count"] for a in articles)
    print("\n=== scrape complete ===")
    print(f"saved      : {len(articles)} articles -> {out}")
    print(f"date range : {articles[0]['date']}  ..  {articles[-1]['date']}")
    print(f"word count : min {wc[0]}, median {wc[len(wc)//2]}, max {wc[-1]}")
    empty = [a["id"] for a in articles if a["word_count"] == 0]
    if empty:
        print(f"WARNING    : {len(empty)} articles have empty body text (ids {empty[:10]})")
    print("top sections:")
    for name, n in Counter(a["section"] for a in articles).most_common(8):
        print(f"    {n:4d}  {name}")
    print("top bylines:")
    for name, n in Counter(a["author"] for a in articles).most_common(8):
        print(f"    {n:4d}  {name}")
    print("\nNext: sentiment scoring. No article text is sent anywhere until you OK the scoring run.")


if __name__ == "__main__":
    main()
