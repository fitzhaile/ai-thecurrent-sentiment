import { useEffect, useState } from 'react'
import ComparisonScatter from './charts/ComparisonScatter'
import ComparisonHist from './charts/ComparisonHist'
import { avg } from './lib/aggregate'

export default function ComparisonView() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}comparison.json`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error('failed to load comparison.json', e))
  }, [])

  if (!data) return <div className="loading">Loading…</div>

  const f = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`

  return (
    <main className="app">
      <p className="intro">
        Two newsrooms on the same coast, opposite missions — and it shows. Each article was scored by Claude on
        the same two −1‑to‑+1 scales: <b>valence</b> (how positive or negative it feels) and <b>tone</b> (how
        slanted the writing is, independent of topic). To keep it newsroom‑to‑newsroom, The Current here excludes
        the wire it republishes and Connect Savannah excludes its society photo galleries — each side is its own
        journalism.
      </p>

      <div className="cmp-grid">
        {data.meta.outlets.map((o) => {
          const rows = data[o.key]
          const mv = avg(rows.map((r) => r.valence))
          const mt = avg(rows.map((r) => r.tone))
          const pos = Math.round(rows.filter((r) => r.valence >= 0.15).length / rows.length * 100)
          return (
            <div className="cmp-card" key={o.key} style={{ '--oc': o.color }}>
              <div className="cmp-name">{o.name}</div>
              <div className="cmp-tag">{o.tagline}</div>
              <div className="cmp-stats">
                <div><b>{f(mv)}</b><span>valence</span></div>
                <div><b>{f(mt)}</b><span>tone</span></div>
                <div><b>{pos}%</b><span>positive</span></div>
              </div>
              <div className="cmp-n">{o.n} articles · 2 yrs</div>
            </div>
          )
        })}
      </div>

      <section className="group">
        <p className="eyebrow"><span className="num">01</span><span className="label">The two newsrooms, in one chart</span></p>
        <div className="card">
          <h3>Valence vs. tone — both outlets at once</h3>
          <p className="explain">
            Every article placed by <b>valence</b> (left–right) and <b>tone</b> (up–down); the big ringed dot is
            each outlet's average. The clouds sit in different corners — <b>The Current</b> lower‑left (negative
            topics, neutral writing), <b>Connect Savannah</b> upper‑right (positive topics, warm writing).
          </p>
          <ComparisonScatter data={data} />
        </div>
      </section>

      <section className="group">
        <p className="eyebrow"><span className="num">02</span><span className="label">Tone — the topic-independent axis</span></p>
        <div className="card">
          <h3>How slanted the writing is</h3>
          <p className="explain">
            The fairer cross‑outlet measure: tone rates only <i>how</i> a story is written, not <i>what</i> it's
            about. The Current piles up at <b>0</b> (straight reporting, even on grim news); Connect Savannah
            shifts <b>positive</b>. Their crime stories both score ~0 — so the gap is real editorial voice, not topic.
          </p>
          <ComparisonHist data={data} field="tone" />
        </div>
      </section>

      <section className="group">
        <p className="eyebrow"><span className="num">03</span><span className="label">Valence — overall positivity</span></p>
        <div className="card">
          <h3>How positive or negative the coverage feels</h3>
          <p className="explain">
            The full picture, topic included. The Current leans <b>negative</b> (courts, government, accountability);
            Connect Savannah leans strongly <b>positive</b> (food, music, arts, community).
          </p>
          <ComparisonHist data={data} field="valence" />
        </div>
      </section>

      <footer className="foot">
        The Current: {data.current.length} own‑reporting articles (republished wire excluded). Connect Savannah:{' '}
        {data.connect.length} journalism articles (society photo galleries excluded). Both scored by {data.meta.model}{' '}
        on identical rubrics. Scores are a careful model read — validated, but an annotator's judgment, not ground truth.
      </footer>
    </main>
  )
}
