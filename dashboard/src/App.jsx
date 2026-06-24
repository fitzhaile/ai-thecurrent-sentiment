import { useEffect, useMemo, useState } from 'react'
import TrendChart from './charts/TrendChart'
import DistributionChart from './charts/DistributionChart'
import VolumeChart from './charts/VolumeChart'
import SectionChart from './charts/SectionChart'
import ToneScatter from './charts/ToneScatter'
import HeatmapChart from './charts/HeatmapChart'
import { avg, sections } from './lib/aggregate'

export default function App() {
  const [data, setData] = useState(null)
  const [section, setSection] = useState('all')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error('failed to load data.json', e))
  }, [])

  const all = data?.articles ?? []
  const secList = useMemo(() => sections(all), [all])
  const arts = useMemo(
    () => (section === 'all' ? all : all.filter((a) => a.section === section)),
    [all, section],
  )

  if (!data) return <div className="loading">Loading…</div>

  const byVal = [...arts].sort((a, b) => a.valence - b.valence)
  const meanVal = avg(arts.map((a) => a.valence))
  const meanTone = avg(arts.map((a) => a.tone))
  const pctNeg = arts.length ? Math.round(arts.filter((a) => a.valence <= -0.15).length / arts.length * 100) : 0

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M4 19c3-5 6.5-5 9.5 0s6.5 5 9.5 0 6-4 5-4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h1>The Current — Sentiment of Coverage</h1>
            <p className="sub">A year of coverage, read and scored for sentiment by Claude.</p>
          </div>
        </div>
        <div className="masthead-meta">
          <div><b>{data.meta.n_scored}</b> articles scored</div>
          <div>{data.meta.window.after.slice(0, 10)} → {data.meta.window.before.slice(0, 10)}</div>
          <div>{data.meta.model}</div>
        </div>
      </header>

      <p className="intro">
        Every article <b>The Current</b> published in the past year was read by Claude and scored on two
        independent −1 to +1 scales: <b>valence</b> — how positive or negative the article feels overall
        (subject and framing together) — and <b>tone</b> — how slanted the <i>writing itself</i> is,
        separate from how grim the topic is. A straight report on a tragedy is strongly negative valence
        but roughly neutral tone. Scores near 0 are neutral; the shaded band on the time chart marks that
        neutral zone.
      </p>

      <div className="controls">
        <label>
          Section{' '}
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="all">All sections</option>
            {secList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <span className="muted">{arts.length} articles shown{section !== 'all' ? ` · ${section}` : ''}</span>
      </div>

      <section className="kpis">
        <Kpi label="Articles" value={arts.length} />
        <Kpi label="Mean valence" value={meanVal.toFixed(2)} sign={meanVal} />
        <Kpi label="Mean tone" value={meanTone.toFixed(2)} sign={meanTone} />
        <Kpi label="% negative" value={`${pctNeg}%`} />
      </section>
      <p className="kpi-note">
        Averages across the articles shown. <b>Valence/tone</b> run −1 (negative) to +1 (positive), 0 = neutral.
        A slightly-negative mean valence with a near-zero mean tone is typical of accountability-focused local
        news: the topics lean hard, but the reporting stays even.
      </p>

      <div className="card">
        <h3>Valence over time</h3>
        <p className="explain">
          Each dot is one article, placed on the day it ran; the dark line is a <b>7-day rolling average</b>
          {' '}that smooths out daily swings; the grey band is the neutral zone. Read the line, not individual
          dots — a sustained dip marks a stretch of heavier news. Drag the slider to zoom a period, and hover a
          dot to see which story it is.
        </p>
        <TrendChart articles={arts} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Valence distribution</h3>
          <p className="explain">
            How the {data.meta.n_scored} scores spread out. The pile-up near zero is mostly neutral civic and
            procedural coverage; the longer <b>negative tail</b> is the harder courts, public-safety, and
            accountability reporting.
          </p>
          <DistributionChart articles={arts} />
        </div>
        <div className="card">
          <h3>Articles per month</h3>
          <p className="explain">
            Publishing volume — context for the trend above. A month's average sentiment is more trustworthy
            when it sits on more articles, so check the count before reading much into a single month.
          </p>
          <VolumeChart articles={arts} />
        </div>
      </div>

      <div className="card">
        <h3>Valence vs. tone — why we score two numbers</h3>
        <p className="explain">
          Horizontal is <b>valence</b> (topic + feel); vertical is <b>tone</b> (the writing's slant). Each dot
          is an article. The cloud spreads <b>wide left-to-right but stays in a thin band vertically</b> —
          meaning grim topics are reported straight, not editorialized. That gap is the entire reason for
          scoring tone separately: it lets the trend reflect the news without mistaking sober coverage of bad
          events for bias.
        </p>
        <ToneScatter articles={arts} />
      </div>

      <div className="card">
        <h3>Mean valence by section</h3>
        <p className="explain">
          Which beats carry the heaviest news. <b>Courts and Public Safety</b> skew negative (crime, accidents,
          litigation); <b>Community and Education</b> skew positive (events, recognitions, openings). This is
          the subject matter, not a slant — tone stays near neutral across every beat.
        </p>
        <SectionChart articles={all} field="section" />
      </div>

      <div className="card">
        <h3>Mean valence by byline</h3>
        <p className="explain">
          Average valence per reporter and wire service (≥ 15 articles). Differences mostly track <b>what beat
          someone covers</b> — investigations and government vs. features and community — not any individual
          bias. Wire bylines (e.g. Capitol Beat, Georgia Recorder) are state-government coverage.
        </p>
        <SectionChart articles={all} field="author" minN={15} gridLeft={180} />
      </div>

      <div className="card">
        <h3>Valence heatmap — section × month</h3>
        <p className="explain">
          Section sentiment month by month (sections with ≥ 20 articles). A single <b>red cell</b> flags a beat
          that turned sharply negative that month — usually a specific cluster of stories worth a look. Blank
          cells are months a section didn't publish.
        </p>
        <HeatmapChart articles={all} />
      </div>

      <div className="tables">
        <ArticleTable
          title="Most negative valence"
          caption="The model's hardest-scoring articles. Hover a row for its one-line rationale — the quickest way to sanity-check a score."
          rows={byVal.slice(0, 8)}
        />
        <ArticleTable
          title="Most positive valence"
          caption="The most upbeat coverage — openings, awards, recognitions, community wins."
          rows={byVal.slice(-8).reverse()}
        />
      </div>

      <footer className="foot">
        {data.meta.n_total} articles published in the window · {data.meta.n_scored} scored ·{' '}
        {data.meta.n_excluded_short} excluded as non-substantive (results/data stubs under 50 words).
        Scores are a careful model read, not ground truth — they were stable across re-runs and validated, but
        treat them as an annotator's judgment.
      </footer>
    </div>
  )
}

function Kpi({ label, value, sign }) {
  const color = sign === undefined ? undefined
    : sign < -0.001 ? 'var(--neg)' : sign > 0.001 ? 'var(--pos)' : undefined
  return (
    <div className="kpi">
      <div className="kpi-val" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

function ArticleTable({ title, caption, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {caption && <p className="explain">{caption}</p>}
      <table>
        <thead>
          <tr><th>Val</th><th>Tone</th><th>Date</th><th>Headline</th></tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} title={a.rationale || ''}>
              <td className="num" style={{ color: a.valence < 0 ? 'var(--neg)' : 'var(--pos)' }}>{a.valence.toFixed(2)}</td>
              <td className="num">{a.tone.toFixed(2)}</td>
              <td className="date">{a.date?.slice(0, 10)}</td>
              <td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
