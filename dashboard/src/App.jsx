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
      <header>
        <h1>The Current — Sentiment of Coverage</h1>
        <p className="sub">
          {data.meta.n_scored} articles · {data.meta.window.after.slice(0, 10)} → {data.meta.window.before.slice(0, 10)} · scored by {data.meta.model}
        </p>
      </header>

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

      <div className="card">
        <h3>Valence over time <span className="hint">— each dot is an article · blue line = 28-day average · grey band = neutral · drag the slider to zoom dates</span></h3>
        <TrendChart articles={arts} />
      </div>

      <div className="grid2">
        <div className="card"><h3>Valence distribution</h3><DistributionChart articles={arts} /></div>
        <div className="card"><h3>Articles per month</h3><VolumeChart articles={arts} /></div>
      </div>

      <div className="card">
        <h3>Valence vs. tone <span className="hint">— wide horizontal spread, narrow vertical band: tone was measured independently of topic, not copied from valence</span></h3>
        <ToneScatter articles={arts} />
      </div>

      <div className="card">
        <h3>Mean valence by section <span className="hint">— full year, all sections</span></h3>
        <SectionChart articles={all} field="section" />
      </div>

      <div className="card">
        <h3>Mean valence by byline <span className="hint">— reporters &amp; wire services with ≥ 15 articles</span></h3>
        <SectionChart articles={all} field="author" minN={15} gridLeft={180} />
      </div>

      <div className="card">
        <h3>Valence heatmap <span className="hint">— section × month (sections with ≥ 20 articles)</span></h3>
        <HeatmapChart articles={all} />
      </div>

      <div className="tables">
        <ArticleTable title="Most negative valence" rows={byVal.slice(0, 8)} />
        <ArticleTable title="Most positive valence" rows={byVal.slice(-8).reverse()} />
      </div>

      <footer className="foot">
        {data.meta.n_total} articles published in the window · {data.meta.n_scored} scored ·{' '}
        {data.meta.n_excluded_short} excluded as non-substantive (results/data stubs under 50 words) ·
        hover any point for its title &amp; score; rows show the model's rationale on hover.
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

function ArticleTable({ title, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
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
