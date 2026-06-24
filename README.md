# The Current — Sentiment Dashboard

Sentiment analysis of every article [The Current](https://thecurrentga.org) (a
coastal-Georgia nonprofit newsroom) published over the trailing 12 months, scored by
Claude Opus 4.8 and presented as an interactive dashboard.

- **716** articles in the window (2025‑06‑23 → 2026‑06‑23); **707** scored, **9**
  excluded as non-substantive (election-results stubs under 50 words).
- Each article gets a **valence** (overall positive/negative, −1…+1) and an
  *independent* **tone** (editorial slant of the writing, −1…+1), plus a topic label,
  a confidence level, and a one-line rationale.

## Project layout

```
scrape.py          WordPress REST API  ->  data/articles.json  (full text + metadata)
score.py           calibration scorer + THE RUBRIC (single source of truth)
score_batch.py     full-corpus scoring via the Batch API  ->  data/scores.json
validate.py        QA: distributions, tone/valence separation, by-section/author, extremes, stability
build_data.py      scores.json  ->  dashboard/public/data.json  (metadata + scores; no full text)
data/              articles.json (gitignored), scores.json, calibration.json
dashboard/         Vite + React + ECharts app (the deployable artifact)
.env               ANTHROPIC_API_KEY=...   (gitignored AND Dropbox-ignored)
```

## Re-running the pipeline

Prereqs: Python 3, Node 20+, and `ANTHROPIC_API_KEY` in `.env` (copy from `.env.example`).
The Python venv lives at `.venv` — create with
`python3 -m venv .venv && .venv/bin/pip install anthropic`.

```bash
# 1. Scrape (no API key, no cost). Change the window for a different period:
python3 scrape.py
python3 scrape.py --after 2025-01-01T00:00:00 --before 2026-01-01T00:00:00

# 2. (optional) Calibrate the rubric on ~20 articles first (~$0.50):
.venv/bin/python score.py

# 3. Score the full corpus via the Batch API (~$6 for ~700 articles):
.venv/bin/python score_batch.py        # submit -> wait -> data/scores.json  (resumable)

# 4. QA the scores:
.venv/bin/python validate.py

# 5. Rebuild the dashboard's data + site:
.venv/bin/python build_data.py
npm --prefix dashboard run build       # -> dashboard/dist (static; deploy anywhere)
```

## The dashboard

```bash
npm --prefix dashboard install
npm --prefix dashboard run dev         # local dev server
npm --prefix dashboard run build       # production build -> dashboard/dist
```

`dashboard/dist` is a self-contained static site (relative asset paths via
`base: './'`), deployable to any static host — Netlify, Vercel, Cloudflare Pages,
GitHub Pages, or a plain web server. No backend.

### Deploy to Render

A `render.yaml` blueprint is included. On Render: **New + → Blueprint**, connect this
repo, and apply — it builds `dashboard/` and publishes `dashboard/dist`. Or create a
**Static Site** manually: Build Command `cd dashboard && npm install && npm run build`,
Publish Directory `dashboard/dist`, env var `NODE_VERSION=20.19.5`.

**Views:** valence trend (per-article scatter + 28‑day rolling average + monthly mean,
with a date-zoom slider), distribution, monthly volume, valence‑vs‑tone scatter, mean
valence by section and by byline, a section × month heatmap, and the most
positive/negative articles. A Section filter scopes the per-article views.

## Methodology

- **Model:** Claude Opus 4.8, adaptive thinking on, structured JSON output, a fixed
  rubric (in `score.py`). One pass per article.
- **valence** (−1…+1): overall positivity/negativity a reader takes away (topic +
  framing). **tone** (−1…+1): the writing's *own editorial slant*, independent of how
  grim the topic is — straight reporting of a tragedy is negative valence but ~0 tone.
- **Validation** (`validate.py`): valence↔tone correlation **r = 0.64** (separated, not
  collapsed); section means track intuition (Courts/Public Safety most negative,
  Community/Education most positive); the same 20 articles scored in two independent
  runs differed by only **Δ0.04** (stable). Actual full-run cost: **$6.11**.

## Known limitations / trade-offs

- Scores are **model-derived**, not ground truth. They're stable run-to-run (Δ0.04) and
  validate well, but treat them as a careful annotator's read, not fact.
- **Tone** reads pointed *investigative* framing as mildly negative (−0.1…−0.3) — a
  deliberate rubric choice (it's real framing). To make tone capture only explicit
  opinion, tighten the rubric in `score.py` and re-score.
- **9 short articles excluded** (results/data stubs < 50 words; no prose to score).
  Threshold is `MIN_WORDS` in `score.py`; the count is shown in the dashboard footer.
- **Bylines** come from Yoast metadata, so wire pieces show their true byline
  (e.g. "Ty Tagami/Capitol Beat News Service") rather than the posting desk account.
- `data/articles.json` (full article text) is **gitignored** — a regenerable cache of
  copyrighted content. Run `scrape.py` to recreate it.
- Dashboard JS is ~434 KB gzip (full ECharts import). Fine for most uses; to shrink,
  switch `dashboard/src/charts/EChart.jsx` to `echarts/core` with only the used
  charts/components registered.
