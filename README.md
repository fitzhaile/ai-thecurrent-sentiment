# The Current — Sentiment & Themes Dashboard

Sentiment analysis of every article [The Current](https://thecurrentga.org) — a
coastal‑Georgia nonprofit newsroom — published over the trailing **two years**, scored
by **Claude Opus 4.8** on two independent scales, clustered into themes with
**BERTopic**, and presented as an interactive static dashboard.

- **1,432** articles scored over the window **2024‑06‑23 → 2026‑06‑23**; sub‑50‑word
  stubs (results/data fragments) excluded.
- Each article gets a **valence** (overall positive/negative a reader takes away, −1…+1)
  and an *independent* **tone** (editorial slant of the writing, −1…+1), plus a topic
  label, a confidence level, and a one‑line rationale.
- Headline split (valence past ±0.15): **50% negative · 26% neutral · 24% positive**;
  mean valence −0.12, mean tone −0.02 (near‑neutral writing on hard topics).

## Project layout

```
scrape.py            WordPress REST API -> data/articles.json   (full text + metadata; any WP site via --base)
score.py             calibration scorer + THE RUBRIC (single source of truth for the scoring prompt)
score_batch.py       full-corpus scoring via the Batch API -> data/scores.json   (incremental, resumable)
build_data.py        scores.json -> dashboard/public/data.json      (metadata + scores; no full text)
build_topics.py      BERTopic theme discovery -> dashboard/public/themes.json
build_comparison.py  two outlets -> dashboard/public/comparison.json  (The Current vs another newsroom)
validate.py          QA: distributions, tone/valence separation, by-section/author, extremes, stability
requirements.txt     build-time Python deps (anthropic, bertopic); scrape.py is stdlib-only
render.yaml          Render Blueprint (static-site deploy)
data/                scores.json, connect_scores.json, calibration.json   (articles.json + *_articles.json gitignored)
dashboard/           Vite + React 19 + ECharts 6 app (the deployable artifact)
.env                 ANTHROPIC_API_KEY=...   (gitignored)
```

The build-time Python tools produce JSON that the dashboard reads; the deployed app is
a **static site with no backend and no ML at runtime**.

## Re-running the pipeline

Prereqs: Python 3.10+, Node 20+, and `ANTHROPIC_API_KEY` in `.env` (copy `.env.example`).

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt     # anthropic + bertopic (BERTopic pulls a large ML stack)

# 1. Scrape (stdlib, no API key, no cost). Default window = two years back:
python3 scrape.py
#    Any WordPress site:  --base https://site/wp-json/wp/v2 --source "Name" --out data/x_articles.json

# 2. (optional) Calibrate the rubric on ~20 stratified articles first (~$0.50):
.venv/bin/python score.py

# 3. Score the full corpus via the Batch API (incremental — only unscored articles).
#    The Current's two years cost ~$13 across two runs:
.venv/bin/python score_batch.py               # submit -> poll -> data/scores.json

# 4. QA the scores:
.venv/bin/python validate.py

# 5. Build the dashboard's data:
.venv/bin/python build_data.py                # -> dashboard/public/data.json
.venv/bin/python build_topics.py              # -> dashboard/public/themes.json (BERTopic)

# 6. Build the site:
npm --prefix dashboard install
npm --prefix dashboard run build              # -> dashboard/dist  (static; deploy anywhere)
```

**Scoring a second outlet** (for the comparison view):

```bash
python3 scrape.py --base https://www.example.com/wp-json/wp/v2 --source "Example" --out data/example_articles.json
.venv/bin/python score_batch.py --articles data/example_articles.json \
    --out data/example_scores.json --idfile data/example_batch_id.txt \
    --exclude-sections "Listings" --exclude-author-prefix "Photographer Name"   # optional non-journalism filters
.venv/bin/python build_comparison.py          # -> dashboard/public/comparison.json
```

## The dashboard

```bash
npm --prefix dashboard install
npm --prefix dashboard run dev      # local dev server
npm --prefix dashboard run build    # production build -> dashboard/dist
```

`dashboard/dist` is a self‑contained static site (relative asset paths via `base: './'`),
deployable to any static host. The React app just reads the prebuilt JSON.

**Two views, toggled in the masthead:**

- **The Current, in full** — KPIs (articles, mean valence/tone, and a **Negative ·
  Neutral · Positive** split that sums to 100%); **valence‑ and tone‑over‑time**
  (per‑article scatter + a **7 / 10 / 28‑day** moving average, switchable, + monthly
  mean, with a date‑zoom slider); valence and tone distributions; a valence‑vs‑tone
  scatter; mean valence by section and by byline; a **BERTopic "discovered themes"**
  breakdown; a section × month heatmap; and the most positive/negative articles. A
  Section filter scopes the per‑article views.
- **Comparison** — The Current's own reporting vs another newsroom on the same rubric,
  designed around **tone** (the topic‑independent axis): side‑by‑side stat cards, an
  overlaid valence‑vs‑tone scatter with per‑outlet centroids, a monthly trend, and
  normalized tone/valence distributions. *(The bundled comparison data is a placeholder
  — see "comparison outlet" below.)*

### Deploy to Render

A `render.yaml` blueprint is included. On Render: **New + → Blueprint**, connect this
repo, and apply — it builds `dashboard/` and publishes `dashboard/dist`. Or a manual
**Static Site**: Build Command `cd dashboard && npm install && npm run build`, Publish
Directory `dashboard/dist`, env var `NODE_VERSION=20.19.5`.

## Methodology

- **Sentiment — Claude Opus 4.8** (the rubric in `score.py`, adaptive thinking on,
  structured JSON output, one pass per article, run through the Batch API). It is *not*
  a lexicon or fine‑tuned classifier: a single LLM reads each full article against a
  fixed rubric and explains its score. **valence** weighs subject + framing together;
  **tone** is the writing's own editorial slant, deliberately independent of how grim
  the topic is — a sober report of a fatal flood is strongly negative valence but ~0 tone.
- **Themes — BERTopic** (`build_topics.py`): MiniLM sentence embeddings → seeded UMAP →
  HDBSCAN → stopword‑aware c‑TF‑IDF labels. Bottom‑up, unsupervised theme discovery
  (29 themes over the 1,432 articles), a data‑driven complement to the editor sections.
- **Validation** (`validate.py`): valence↔tone correlation **r ≈ 0.64** (the two axes
  are genuinely separate, not collapsed); section means track intuition (Courts / Health
  / Public Safety most negative, Education / Community positive); re‑scoring the same
  articles drifted only **Δ ≈ 0.04**.

## Known limitations / trade-offs

- Scores are **model‑derived**, not ground truth — a careful annotator's read. Stable
  run‑to‑run and validated, but treat them as judgment, not fact.
- **Tone** reads pointed *investigative* framing as mildly negative — a deliberate rubric
  choice (it's real framing). Tighten the rubric in `score.py` and re‑score to make tone
  capture only explicit opinion.
- **Comparison outlet:** the bundled comparison is **Connect Savannah**, whose online
  journalism turned out to concentrate in mid‑2024 and thin out afterward — usable for a
  cross‑sectional comparison but not a two‑year trend. A steadier replacement (a
  crawlable outlet with even coverage) is being selected; swap it by scoring the new
  outlet and re‑running `build_comparison.py`. Many candidates (savannahnow, Georgia
  Recorder, Decaturish, the Savannah TV stations …) **block Claude in `robots.txt`** and
  are not crawled.
- **Wire content:** roughly **44%** of The Current's feed is republished wire (Georgia
  Recorder, Capitol Beat, AP, GPB …). The single‑outlet dashboard includes it as
  published; the comparison **excludes** it (`build_comparison.py`) to weigh original
  reporting only. Bylines come from Yoast metadata, so wire pieces show their true byline
  (e.g. "Ty Tagami/Capitol Beat News Service").
- **Short stubs (< 50 words)** are excluded (`MIN_WORDS` in `score.py`); the count is in
  the dashboard footer.
- `data/articles.json` and any per‑outlet `*_articles.json` (full text) are **gitignored**
  — regenerable caches of copyrighted content. Run `scrape.py` to recreate them.
- The dashboard imports ECharts in full (~430 KB gzip). To shrink, register only the used
  charts/components from `echarts/core` in `dashboard/src/charts/EChart.jsx`.
