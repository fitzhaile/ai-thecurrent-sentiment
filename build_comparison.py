#!/usr/bin/env python3
"""
Build the two-outlet comparison data file (dashboard/public/comparison.json).

Compares The Current's OWN reporting (wire/syndicated bylines excluded) against
Connect Savannah's journalism (society photo galleries already excluded at scoring
time). Both sides are an outlet's actual journalism, which is the fair matchup.

Slim by design: only the fields the comparison charts need (date, valence, tone,
section, title) — no full article text.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
FIELDS = ("date", "valence", "tone", "section", "title")

# Bylines that mark republished/wire content in The Current's feed (not its own reporting).
WIRE = ["georgia recorder", "capitol beat", "associated press", "gpb news",
        "wabe", "grist", "healthbeat", "chalkbeat", "kff"]


def is_wire(row):
    a = (row.get("author") or "").lower()
    return any(w in a for w in WIRE)


def load(name):
    return json.loads((ROOT / "data" / name).read_text())


def main():
    cur = load("scores.json")
    conn = load("connect_scores.json")

    cur_rows = [s for s in cur["scores"] if not is_wire(s)]
    conn_rows = conn["scores"]
    slim = lambda rows: [{k: r.get(k) for k in FIELDS} for r in rows]

    out = {
        "meta": {
            "model": cur.get("model"),
            "outlets": [
                {"key": "current", "name": "The Current",
                 "tagline": "Investigative / accountability nonprofit",
                 "n": len(cur_rows), "color": "#294257"},
                {"key": "connect", "name": "Connect Savannah",
                 "tagline": "Alt-weekly — arts, food, music, culture",
                 "n": len(conn_rows), "color": "#c2683a"},
            ],
            "note": "The Current = own reporting (wire bylines excluded); "
                    "Connect Savannah = journalism (society photo galleries excluded).",
        },
        "current": slim(cur_rows),
        "connect": slim(conn_rows),
    }
    dest = ROOT / "dashboard" / "public" / "comparison.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"wrote comparison.json: The Current {len(cur_rows)} (wire excluded) "
          f"+ Connect Savannah {len(conn_rows)} -> {dest}")


if __name__ == "__main__":
    main()
