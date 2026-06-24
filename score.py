#!/usr/bin/env python3
"""
Sentiment-score The Current GA articles with Claude (Opus 4.8).

Two numeric dimensions per article, kept deliberately separate:
  - valence: overall positive/negative a reader takes away (topic + framing)
  - tone   : the WRITING's own editorial slant, independent of how grim the topic is
Plus a short topic label, a confidence level, and a one-line rationale for audit.

Default mode = "calibration": scores a small stratified sample (default 20),
prints a readable table, saves data/calibration.json, and reports MEASURED token
cost + a projection for the full run. Nothing in this file runs the full corpus —
that's a separate, explicitly-approved step.

Reads ANTHROPIC_API_KEY from .env (stdlib loader; no python-dotenv dependency).
"""
import argparse
import json
import os
import pathlib
import re
import sys
import time
from collections import OrderedDict

import anthropic

ROOT = pathlib.Path(__file__).resolve().parent
MODEL = "claude-opus-4-8"
# Opus 4.8 pricing, $/token (from the claude-api skill catalog, cached 2026-06-04):
# input $5.00 / MTok, output $25.00 / MTok. Output tokens include adaptive-thinking tokens.
PRICE_IN = 5.0 / 1_000_000
PRICE_OUT = 25.0 / 1_000_000
MIN_WORDS = 50  # below this, articles are non-substantive (results/data stubs) and excluded

RUBRIC = """You are a careful media-analysis annotator scoring news articles from \
The Current, a nonprofit newsroom covering coastal Georgia and Georgia state \
government. For each article, output a structured sentiment assessment.

Score TWO numeric dimensions. They measure DIFFERENT things — keep them separate.

1) valence (-1.0 to +1.0): the overall emotional positivity or negativity a typical \
reader takes away, considering BOTH the subject matter and the framing.
   -1.0 = deeply negative (death, disaster, serious harm, grave wrongdoing)
   -0.5 = clearly negative (problems, conflict, decline, setbacks)
    0.0 = neutral or genuinely mixed (routine info, procedural, balanced)
   +0.5 = clearly positive (improvements, wins, recognition, progress)
   +1.0 = strongly positive (major achievement, relief, celebration)

2) tone (-1.0 to +1.0): the WRITING's own editorial slant toward its subject, \
SEPARATE from how grim or upbeat the events are. Straight, balanced, objective \
reporting is 0.0 NO MATTER how bad or good the news is.
   -1.0 = harshly critical / accusatory / loaded against its subject
    0.0 = neutral, balanced, objective journalism (the default for straight news)
   +1.0 = boosterish / promotional / one-sidedly favorable

CRITICAL: do NOT let a grim topic pull the tone negative. A sober, factual report of \
a fatal flood is strongly negative VALENCE but ~0.0 TONE. An opinion column praising \
an official is positive TONE. An investigation may be negative valence with ~0.0 tone \
if it lets facts speak, or negative tone if the framing is pointed.

Also provide:
3) topic: a concise 2-5 word label for the specific subject (e.g. "coastal erosion", \
"county budget vote", "school board election").
4) confidence: your confidence in the valence score — "low", "medium", or "high". \
Use "low" for ambiguous, mixed, or thin articles.
5) rationale: ONE sentence (<=30 words) explaining the valence and tone, for a human auditor.

Judge each article independently against these absolute anchors. Do not compare it to \
other articles. Base the assessment only on the article text provided."""

SCHEMA = {
    "type": "object",
    "properties": {
        "valence": {"type": "number"},
        "tone": {"type": "number"},
        "topic": {"type": "string"},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "rationale": {"type": "string"},
    },
    "required": ["valence", "tone", "topic", "confidence", "rationale"],
    "additionalProperties": False,
}


def load_env(path=ROOT / ".env"):
    p = pathlib.Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        s = line.strip()
        if s and not s.startswith("#") and "=" in s:
            k, v = s.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def score_one(client, art):
    """Score a single article. Returns (result_dict, input_tokens, output_tokens)."""
    user = f"Headline: {art['title']}\n\nArticle:\n{art['text']}"
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        thinking={"type": "adaptive"},
        system=RUBRIC,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("model refused this article")
    text = next((b.text for b in resp.content if getattr(b, "type", None) == "text"), None)
    if not text:
        raise RuntimeError(f"no text block (stop_reason={resp.stop_reason})")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise RuntimeError(f"unparseable output: {text[:160]}")
        data = json.loads(m.group(0))
    data["valence"] = max(-1.0, min(1.0, float(data["valence"])))
    data["tone"] = max(-1.0, min(1.0, float(data["tone"])))
    return data, resp.usage.input_tokens, resp.usage.output_tokens


def select_calibration(articles, n):
    """Stratified round-robin across sections; meatier articles first; deterministic."""
    pool = [a for a in articles if a["word_count"] >= MIN_WORDS]
    by_sec = OrderedDict()
    for a in sorted(pool, key=lambda a: (-a["word_count"], a["id"])):
        by_sec.setdefault(a["section"] or "(none)", []).append(a)
    secs, picked, i = list(by_sec.keys()), [], 0
    while len(picked) < n and any(by_sec.values()):
        bucket = by_sec[secs[i % len(secs)]]
        if bucket:
            picked.append(bucket.pop(0))
        i += 1
    return picked[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20, help="calibration sample size")
    ap.add_argument("--articles", default=str(ROOT / "data" / "articles.json"))
    ap.add_argument("--out", default=str(ROOT / "data" / "calibration.json"))
    args = ap.parse_args()

    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not found (.env). Aborting before any spend.")

    blob = json.loads(pathlib.Path(args.articles).read_text())
    articles = blob["articles"]
    scoreable = [a for a in articles if a["word_count"] >= MIN_WORDS]
    sample = select_calibration(articles, args.n)
    print(f"Corpus: {len(articles)} articles  |  scoreable (>= {MIN_WORDS} words): {len(scoreable)}"
          f"  |  excluded short stubs: {len(articles) - len(scoreable)}")
    print(f"Calibration sample: {len(sample)} articles (stratified by section), model {MODEL}, "
          f"adaptive thinking ON\n")

    client = anthropic.Anthropic()
    results, tot_in, tot_out, t0 = [], 0, 0, time.time()
    for k, a in enumerate(sample, 1):
        try:
            r, ti, to = score_one(client, a)
            tot_in += ti
            tot_out += to
            results.append({**{f: a[f] for f in ("id", "date", "section", "author", "title", "word_count")},
                            **r, "in_tokens": ti, "out_tokens": to})
            print(f"[{k:2d}/{len(sample)}] val {r['valence']:+.2f}  tone {r['tone']:+.2f}  "
                  f"{r['confidence']:>6}  {(a['section'] or '-'):<11.11} {a['title'][:52]}")
        except Exception as e:
            print(f"[{k:2d}/{len(sample)}] ERROR on id={a['id']}: {e}")
            results.append({"id": a["id"], "title": a["title"], "error": str(e)})

    ok = [r for r in results if "error" not in r]
    pathlib.Path(args.out).write_text(json.dumps(
        {"model": MODEL, "rubric_version": 1, "sample": results}, ensure_ascii=False, indent=2))

    # Readable detail + cost.
    print("\n=== calibration detail (audit the rationales) ===")
    for r in ok:
        print(f"\n  {r['title']}")
        print(f"    section={r['section']}  topic={r.get('topic')!r}  by {r['author']}")
        print(f"    valence {r['valence']:+.2f} | tone {r['tone']:+.2f} | confidence {r['confidence']}")
        print(f"    why: {r['rationale']}")

    cost = tot_in * PRICE_IN + tot_out * PRICE_OUT
    n_ok = max(1, len(ok))
    per = cost / n_ok
    full = len(scoreable)
    print("\n=== measured cost (this calibration) ===")
    print(f"scored {len(ok)}/{len(sample)} ok in {time.time()-t0:.0f}s")
    print(f"tokens: {tot_in:,} in / {tot_out:,} out (output incl. thinking)")
    print(f"avg per article: {tot_in/n_ok:,.0f} in / {tot_out/n_ok:,.0f} out")
    print(f"calibration cost: ${cost:.2f}  (~${per:.4f}/article)")
    print(f"\n=== projected FULL run ({full} scoreable articles) ===")
    print(f"standard API : ${per*full:.2f}")
    print(f"Batch API -50%: ${per*full*0.5:.2f}   <- recommended")
    print("\nCHECKPOINT: review the scores/rationales above. The full run does not start "
          "until you OK it.")


if __name__ == "__main__":
    main()
