#!/usr/bin/env python3
"""
Validate the full sentiment scores (data/scores.json). Read-only, no API calls.

Checks:
  - valence / tone distributions (ranges sane, not collapsed to one value)
  - valence-vs-tone correlation  -> did the model keep them separate, or copy?
  - valence buckets + confidence breakdown
  - mean valence by section and by author (do they read intuitively?)
  - the 10 most negative / positive (eyeball for mis-scores)
  - run-to-run stability: same articles, calibration vs full run
"""
import json
import math
import pathlib
import statistics
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parent


def pearson(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    return cov / math.sqrt(vx * vy) if vx and vy else float("nan")


def pct(xs, p):
    xs = sorted(xs)
    k = (len(xs) - 1) * p / 100
    f, c = math.floor(k), math.ceil(k)
    return xs[int(k)] if f == c else xs[f] * (c - k) + xs[c] * (k - f)


def main():
    S = json.loads((ROOT / "data" / "scores.json").read_text())["scores"]
    val = [s["valence"] for s in S]
    tone = [s["tone"] for s in S]

    print(f"=== {len(S)} scored articles ===")
    print(f"valence: mean {statistics.mean(val):+.3f}  median {statistics.median(val):+.2f}  "
          f"p10 {pct(val,10):+.2f}  p90 {pct(val,90):+.2f}  range [{min(val):+.2f}, {max(val):+.2f}]")
    print(f"tone   : mean {statistics.mean(tone):+.3f}  median {statistics.median(tone):+.2f}  "
          f"p10 {pct(tone,10):+.2f}  p90 {pct(tone,90):+.2f}  range [{min(tone):+.2f}, {max(tone):+.2f}]")

    r = pearson(val, tone)
    verdict = "separated (good)" if r < 0.8 else "WARNING: tone may be tracking valence"
    print(f"\nvalence-vs-tone correlation: r = {r:.2f}  -> {verdict}")

    def bucket(v):
        return "neg" if v <= -0.15 else ("pos" if v >= 0.15 else "neu")
    bc = Counter(bucket(v) for v in val)
    n = len(S)
    print(f"valence mix: neg {bc['neg']} ({bc['neg']/n*100:.0f}%) | "
          f"neu {bc['neu']} ({bc['neu']/n*100:.0f}%) | pos {bc['pos']} ({bc['pos']/n*100:.0f}%)")
    print(f"confidence : {dict(Counter(s['confidence'] for s in S))}")

    sec = defaultdict(list)
    for s in S:
        sec[s["section"]].append(s["valence"])
    print("\nmean valence by section (n>=10), most negative first:")
    for name, vs in sorted(sec.items(), key=lambda kv: statistics.mean(kv[1])):
        if len(vs) >= 10:
            print(f"  {statistics.mean(vs):+.2f}  (n={len(vs):3d})  {name}")

    au = defaultdict(list)
    for s in S:
        au[s["author"]].append(s["valence"])
    print("\nmean valence by author (n>=15):")
    for name, vs in sorted(au.items(), key=lambda kv: statistics.mean(kv[1])):
        if len(vs) >= 15:
            print(f"  {statistics.mean(vs):+.2f}  (n={len(vs):3d})  {name}")

    print("\n--- 10 most NEGATIVE valence (eyeball: are these really negative?) ---")
    for s in sorted(S, key=lambda s: s["valence"])[:10]:
        print(f"  v{s['valence']:+.2f} t{s['tone']:+.2f} {s['confidence'][0]} | {s['title'][:66]}")
    print("--- 10 most POSITIVE valence ---")
    for s in sorted(S, key=lambda s: -s["valence"])[:10]:
        print(f"  v{s['valence']:+.2f} t{s['tone']:+.2f} {s['confidence'][0]} | {s['title'][:66]}")

    cal = {r["id"]: r for r in json.loads((ROOT / "data" / "calibration.json").read_text())["sample"]
           if "error" not in r}
    sd = {s["id"]: s for s in S}
    common = [i for i in cal if i in sd]
    if common:
        dv = statistics.mean(abs(cal[i]["valence"] - sd[i]["valence"]) for i in common)
        dt = statistics.mean(abs(cal[i]["tone"] - sd[i]["tone"]) for i in common)
        print(f"\nrun-to-run stability ({len(common)} articles scored twice): "
              f"mean |Δvalence| = {dv:.3f}, mean |Δtone| = {dt:.3f}  (lower = more stable)")


if __name__ == "__main__":
    main()
