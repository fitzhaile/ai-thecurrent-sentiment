#!/usr/bin/env python3
"""
Full-corpus sentiment scoring via the Anthropic Batch API (50% cheaper, async).

Uses the EXACT rubric/schema/model from score.py, so the full run behaves like the
approved calibration. Writes data/scores.json. Resumable via data/batch_id.txt.

Modes:
    python score_batch.py submit    # build + submit the batch, save the id, exit (fast)
    python score_batch.py collect   # poll the saved batch to completion, write scores.json
    python score_batch.py           # submit then collect in one process (good for background)
"""
import argparse
import json
import os
import re
import sys
import time

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

# Single source of truth for the rubric — imported, never duplicated.
from score import RUBRIC, SCHEMA, MODEL, MIN_WORDS, PRICE_IN, PRICE_OUT, load_env, ROOT

IDFILE = ROOT / "data" / "batch_id.txt"
OUTFILE = ROOT / "data" / "scores.json"


def load_articles():
    return json.loads((ROOT / "data" / "articles.json").read_text())["articles"]


def build_requests(articles):
    reqs = []
    for a in articles:
        if a["word_count"] < MIN_WORDS:
            continue  # skip non-substantive results/data stubs
        user = f"Headline: {a['title']}\n\nArticle:\n{a['text']}"
        reqs.append(Request(
            custom_id=str(a["id"]),
            params=MessageCreateParamsNonStreaming(
                model=MODEL,
                max_tokens=4000,
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
        print(f"batch already submitted: {IDFILE.read_text().strip()}")
        return IDFILE.read_text().strip()
    reqs = build_requests(articles)
    print(f"submitting batch of {len(reqs)} requests ...", flush=True)
    batch = client.messages.batches.create(requests=reqs)
    IDFILE.write_text(batch.id)
    print(f"submitted: {batch.id}  (status={batch.processing_status}; id saved to {IDFILE})")
    return batch.id


def collect(client, articles):
    if not IDFILE.exists():
        sys.exit("no batch_id.txt — run `submit` first")
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
    scores, errors, in_tok, out_tok = [], [], 0, 0
    for res in client.messages.batches.results(batch_id):
        cid = int(res.custom_id)
        if res.result.type == "succeeded":
            msg = res.result.message
            in_tok += msg.usage.input_tokens
            out_tok += msg.usage.output_tokens
            text = next((bk.text for bk in msg.content if getattr(bk, "type", None) == "text"), None)
            try:
                d = parse_result(text)
                scores.append({**{f: by_id[cid][f] for f in keep}, **d})
            except Exception as e:
                errors.append({"id": cid, "error": f"parse: {e}"})
        else:
            errors.append({"id": cid, "error": res.result.type})

    scores.sort(key=lambda s: s["date"] or "")
    OUTFILE.write_text(json.dumps({
        "model": MODEL, "rubric_version": 1, "scored": len(scores),
        "errors": errors, "scores": scores}, ensure_ascii=False, indent=2))
    billed = (in_tok * PRICE_IN + out_tok * PRICE_OUT) * 0.5  # 50% batch discount
    print(f"\nDONE: {len(scores)} scored, {len(errors)} errors -> {OUTFILE}")
    print(f"tokens: {in_tok:,} in / {out_tok:,} out  |  actual batch cost ~${billed:.2f}")
    if errors:
        print("first errors:", errors[:10])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", nargs="?", default="auto", choices=["submit", "collect", "auto"])
    args = ap.parse_args()
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not found — aborting before any spend")
    client = anthropic.Anthropic()
    articles = load_articles()
    if args.mode in ("submit", "auto"):
        submit(client, articles)
    if args.mode in ("collect", "auto"):
        collect(client, articles)


if __name__ == "__main__":
    main()
