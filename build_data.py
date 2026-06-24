#!/usr/bin/env python3
"""
Build the dashboard's data file (dashboard/public/data.json) from scored articles.

Includes only what the dashboard needs — metadata + scores + the short rationale.
Deliberately omits full article text (keeps the deployable app small and avoids
republishing copyrighted bodies).

Uses data/scores.json when present (the full run); otherwise falls back to
data/calibration.json so the dashboard is developable before the batch finishes.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
FIELDS = ("id", "date", "section", "author", "title", "url",
          "valence", "tone", "topic", "confidence", "rationale", "word_count")
MIN_WORDS = 50


def main():
    arts = json.loads((ROOT / "data" / "articles.json").read_text())
    total = arts["count"]
    scoreable = sum(1 for a in arts["articles"] if a["word_count"] >= MIN_WORDS)

    scores_path = ROOT / "data" / "scores.json"
    if scores_path.exists():
        blob = json.loads(scores_path.read_text())
        rows, src = blob["scores"], "full run"
        model = blob.get("model")
    else:
        blob = json.loads((ROOT / "data" / "calibration.json").read_text())
        rows = [r for r in blob["sample"] if "error" not in r]
        src, model = "calibration sample (dev)", blob.get("model")

    articles = [{k: r.get(k) for k in FIELDS} for r in rows]
    out = {
        "meta": {
            "generated_from": src,
            "model": model,
            "window": arts["window"],
            "n_total": total,
            "n_scored": len(articles),
            "n_excluded_short": total - scoreable,
        },
        "articles": articles,
    }
    dest = ROOT / "dashboard" / "public" / "data.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"wrote {len(articles)} articles ({src}) -> {dest}")


if __name__ == "__main__":
    main()
