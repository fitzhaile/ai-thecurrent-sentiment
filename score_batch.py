#!/usr/bin/env python3
"""
Sentiment scoring via the Anthropic Batch API (50% cheaper, async).

INCREMENTAL: only scores articles not already in data/scores.json, then merges the
new scores in. So re-running after widening the scrape window pays only for the newly
added articles and keeps existing scores stable (no drift, no re-spend).

Uses the EXACT rubric/schema/model from score.py. Resumable via data/batch_id.txt.

Modes:
    python score_batch.py submit    # submit a batch of UNSCORED articles, save the id, exit
    python score_batch.py collect   # poll the saved batch, merge results into scores.json
    python score_batch.py           # submit then collect
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from score import RUBRIC, SCHEMA, MODEL, MIN_WORDS, PRICE_IN, PRICE_OUT, load_env, ROOT

IDFILE = ROOT / "data" / "batch_id.txt"
OUTFILE = ROOT / "data" / "scores.json"
ARTICLES_FILE = ROOT / "data" / "articles.json"
EXCLUDE_SECTIONS = set()       # sections to skip as non-journalism (e.g. photo galleries)
EXCLUDE_AUTHOR_PREFIXES = ()   # skip bylines starting with any of these


def load_articles():
    return json.loads(ARTICLES_FILE.read_text())["articles"]


def existing_scores():
    if OUTFILE.exists():
        return json.loads(OUTFILE.read_text()).get("scores", [])
    return []


def build_requests(articles, done_ids):
    """One request per scoreable article NOT already scored."""
    reqs = []
    for a in articles:
        if a["word_count"] < MIN_WORDS or a["id"] in done_ids:
            continue
        if a.get("section") in EXCLUDE_SECTIONS:
            continue
        if any((a.get("author") or "").startswith(p) for p in EXCLUDE_AUTHOR_PREFIXES):
            continue
        user = f"Headline: {a['title']}\n\nArticle:\n{a['text']}"
        reqs.append(Request(
            custom_id=str(a["id"]),
            params=MessageCreateParamsNonStreaming(
                model=MODEL, max_tokens=4000,
                thinking={"type": "adaptive"},
                system=RUBRIC,
                messages=[{"role": "user", "content": user}],
                output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
            ),
        ))
    return reqs


def parse_result(text):
    try:
        d = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError(f"unparseable: {text[:120]}")
        d = json.loads(m.group(0))
    d["valence"] = max(-1.0, min(1.0, float(d["valence"])))
    d["tone"] = max(-1.0, min(1.0, float(d["tone"])))
    return d


def submit(client, articles):
    if IDFILE.exists():
        bid = IDFILE.read_text().strip()
        print(f"batch already submitted: {bid}")
        return bid
    done = {s["id"] for s in existing_scores()}
    reqs = build_requests(articles, done)
    if not reqs:
        print(f"nothing new to score — all {len(done)} scoreable articles already scored.")
        return None
    print(f"submitting {len(reqs)} UNSCORED articles ({len(done)} already scored, kept as-is) ...", flush=True)
    batch = client.messages.batches.create(requests=reqs)
    IDFILE.write_text(batch.id)
    print(f"submitted: {batch.id}  (status={batch.processing_status}; id saved)")
    return batch.id


def collect(client, articles):
    if not IDFILE.exists():
        print("no batch to collect.")
        return
    batch_id = IDFILE.read_text().strip()
    t0 = time.time()
    while True:
        b = client.messages.batches.retrieve(batch_id)
        c = b.request_counts
        total = c.processing + c.succeeded + c.errored + c.canceled + c.expired
        print(f"[{time.time()-t0:5.0f}s] {b.processing_status}: "
              f"{c.succeeded+c.errored}/{total} done (ok {c.succeeded}, err {c.errored})", flush=True)
        if b.processing_status == "ended":
            break
        if time.time() - t0 > 5400:
            sys.exit("timed out after 90 min; re-run `collect` to resume")
        time.sleep(30)

    by_id = {a["id"]: a for a in articles}
    keep = ("id", "date", "section", "author", "title", "word_count", "url")
    new_scores, errors, in_tok, out_tok = [], [], 0, 0
    for res in client.messages.batches.results(batch_id):
        cid = int(res.custom_id)
        if res.result.type == "succeeded":
            msg = res.result.message
            in_tok += msg.usage.input_tokens
            out_tok += msg.usage.output_tokens
            text = next((bk.text for bk in msg.content if getattr(bk, "type", None) == "text"), None)
            try:
                new_scores.append({**{f: by_id[cid][f] for f in keep}, **parse_result(text)})
            except Exception as e:
                errors.append({"id": cid, "error": f"parse: {e}"})
        else:
            errors.append({"id": cid, "error": res.result.type})

    # Merge: existing scores stay; newly scored are added.
    merged = {s["id"]: s for s in existing_scores()}
    for s in new_scores:
        merged[s["id"]] = s
    allscores = sorted(merged.values(), key=lambda s: s["date"] or "")
    OUTFILE.write_text(json.dumps({
        "model": MODEL, "rubric_version": 1, "scored": len(allscores),
        "errors": errors, "scores": allscores}, ensure_ascii=False, indent=2))
    billed = (in_tok * PRICE_IN + out_tok * PRICE_OUT) * 0.5
    print(f"\nDONE: +{len(new_scores)} new, {len(errors)} errors -> {len(allscores)} total in {OUTFILE}")
    print(f"new tokens: {in_tok:,} in / {out_tok:,} out  |  this run's batch cost ~${billed:.2f}")
    if errors:
        print("first errors:", errors[:10])


def main():
    global ARTICLES_FILE, OUTFILE, IDFILE, EXCLUDE_SECTIONS, EXCLUDE_AUTHOR_PREFIXES
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", nargs="?", default="auto", choices=["submit", "collect", "auto"])
    ap.add_argument("--articles", default=str(ARTICLES_FILE))
    ap.add_argument("--out", default=str(OUTFILE))
    ap.add_argument("--idfile", default=str(IDFILE))
    ap.add_argument("--exclude-sections", default="", help="comma-separated sections to skip")
    ap.add_argument("--exclude-author-prefix", action="append", default=[],
                    help="skip bylines starting with this string (repeatable)")
    args = ap.parse_args()
    ARTICLES_FILE = Path(args.articles)
    OUTFILE = Path(args.out)
    IDFILE = Path(args.idfile)
    EXCLUDE_SECTIONS = {s.strip() for s in args.exclude_sections.split(",") if s.strip()}
    EXCLUDE_AUTHOR_PREFIXES = tuple(args.exclude_author_prefix)
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not found — aborting before any spend")
    client = anthropic.Anthropic()
    articles = load_articles()
    if args.mode in ("submit", "auto"):
        if submit(client, articles) is None and args.mode == "auto":
            return
    if args.mode in ("collect", "auto"):
        collect(client, articles)


if __name__ == "__main__":
    main()
