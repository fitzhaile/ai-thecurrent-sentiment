#!/usr/bin/env python3
"""
Discover themes in the corpus with BERTopic (a build-time analysis), and join each
theme to the sentiment scores it was already given.

Output: dashboard/public/themes.json — for each discovered theme, its keyword label,
size, mean valence/tone, and a few example headlines. This is bottom-up theme
discovery (unsupervised clustering of article embeddings), a complement to the
top-down WP section taxonomy already in the dashboard. No article text is emitted.

Deterministic: UMAP is seeded so re-runs reproduce the same themes.

    python build_topics.py            # all scored articles
    python build_topics.py --min 12   # smaller minimum theme size
"""
import argparse
import json
import pathlib
from collections import defaultdict

from bertopic import BERTopic
from sklearn.feature_extraction.text import CountVectorizer
from umap import UMAP

ROOT = pathlib.Path(__file__).resolve().parent
MIN_WORDS = 50


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--articles", default=str(ROOT / "data" / "articles.json"))
    ap.add_argument("--scores", default=str(ROOT / "data" / "scores.json"))
    ap.add_argument("--out", default=str(ROOT / "dashboard" / "public" / "themes.json"))
    ap.add_argument("--min", type=int, default=15, help="minimum articles per theme")
    args = ap.parse_args()

    arts = json.loads(pathlib.Path(args.articles).read_text())["articles"]
    scores = {s["id"]: s for s in json.loads(pathlib.Path(args.scores).read_text())["scores"]}

    docs, ids = [], []
    for a in arts:
        if a["word_count"] >= MIN_WORDS and a["id"] in scores:
            docs.append((a["title"] + ". " + a["text"])[:3000])  # lead-weighted
            ids.append(a["id"])
    print(f"clustering {len(docs)} scored articles into themes (min size {args.min}) ...")

    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric="cosine", random_state=42)
    # Stopword-aware representation so theme labels are real keywords, not "the / and / in".
    vectorizer = CountVectorizer(stop_words="english", min_df=2, ngram_range=(1, 2))
    model = BERTopic(umap_model=umap_model, vectorizer_model=vectorizer, min_topic_size=args.min, verbose=True)
    topics, _ = model.fit_transform(docs)

    agg = defaultdict(lambda: {"v": [], "t": [], "titles": []})
    for tid, aid in zip(topics, ids):
        s = scores[aid]
        agg[tid]["v"].append(s["valence"])
        agg[tid]["t"].append(s["tone"])
        agg[tid]["titles"].append(s["title"])

    out = []
    for tid in agg:
        if tid == -1:  # BERTopic's outlier/unclustered bucket
            continue
        kw = [w for w, _ in model.get_topic(tid)][:6]
        a = agg[tid]
        n = len(a["v"])
        out.append({
            "id": int(tid),
            "label": " · ".join(kw[:3]),
            "keywords": kw,
            "size": n,
            "mean_valence": round(sum(a["v"]) / n, 3),
            "mean_tone": round(sum(a["t"]) / n, 3),
            "examples": a["titles"][:3],
        })
    out.sort(key=lambda x: -x["size"])

    n_outlier = sum(1 for t in topics if t == -1)
    dest = pathlib.Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({
        "method": "BERTopic (all-MiniLM-L6-v2 embeddings, UMAP+HDBSCAN, seeded)",
        "n_docs": len(docs),
        "n_themes": len(out),
        "n_unclustered": n_outlier,
        "themes": out,
    }, ensure_ascii=False, indent=2))
    print(f"\nwrote {len(out)} themes ({n_outlier} articles unclustered) -> {dest}")
    for t in out[:12]:
        print(f"  {t['size']:4d}  val {t['mean_valence']:+.2f} tone {t['mean_tone']:+.2f}  {t['label']}")


if __name__ == "__main__":
    main()
