import { useEffect, useMemo, useState } from 'react'
import TrendChart from './charts/TrendChart'
import DistributionChart from './charts/DistributionChart'
import VolumeChart from './charts/VolumeChart'
import SectionChart from './charts/SectionChart'
import ToneScatter from './charts/ToneScatter'
import HeatmapChart from './charts/HeatmapChart'
import { avg, sections } from './lib/aggregate'
import ComparisonView from './ComparisonView'

export default function App() {
  const [data, setData] = useState(null)
  const [section, setSection] = useState('all')
  const [view, setView] = useState('current')
  const [ma, setMa] = useState(7)

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
  const pctPos = arts.length ? Math.round(arts.filter((a) => a.valence >= 0.15).length / arts.length * 100) : 0

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <div className="brand">
              <span className="mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M4 19c3-5 6.5-5 9.5 0s6.5 5 9.5 0 6-4 5-4" stroke="#0b2439" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="brand-name">The Current</span>
            </div>
            <nav className="hero-nav">
              <button className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')}>vs Connect Savannah</button>
              <button className={view === 'current' ? 'on' : ''} onClick={() => setView('current')}>The Current, in full</button>
            </nav>
          </div>
          {view === 'compare' ? (
            <>
              <h1 className="hero-title">Two newsrooms,<br />one coast</h1>
              <p className="standfirst">
                The Current's accountability reporting vs. Connect Savannah's alt‑weekly coverage — both read and
                scored by Claude on the same two scales.
              </p>
            </>
          ) : (
            <>
              <h1 className="hero-title">Sentiment of Coverage</h1>
              <p className="standfirst">
                Two years of the newsroom's reporting, read and scored by Claude — every story rated for how positive
                or negative it feels, and how slanted the writing is.
              </p>
            </>
          )}
        </div>
      </header>

      {view === 'compare' && <ComparisonView />}
      {view === 'current' && (
      <main className="app">
        <div className="toolbar">
          <label>
            Section{' '}
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All sections</option>
              {secList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="muted">{arts.length.toLocaleString()} articles shown{section !== 'all' ? ` · ${section}` : ''}</span>
        </div>

        <div className="kpis">
          <Kpi label="Articles" value={arts.length.toLocaleString()} />
          <Kpi label="Mean valence" value={meanVal.toFixed(2)} sign={meanVal} />
          <Kpi label="Mean tone" value={meanTone.toFixed(2)} sign={meanTone} />
          <Kpi label="Negative" value={`${pctNeg}%`} sign={-1} />
          <Kpi label="Positive" value={`${pctPos}%`} sign={1} />
        </div>

        <p className="intro">
          Each article was scored by Claude on two independent −1‑to‑+1 scales: <b>valence</b> — how positive or
          negative it feels overall — and <b>tone</b> — how slanted the <i>writing</i> is, regardless of how grim
          the topic. Straight reporting of a tragedy is strongly negative valence but roughly neutral tone. The
          {' '}<b>Negative</b> and <b>Positive</b> tiles count articles past ±0.15 — they don't add to 100%, since
          the rest (often the largest share) sit in the <b>neutral</b> middle: routine, procedural coverage.
        </p>

        <Group n="01" label="Sentiment over time">
          <div className="ma-control">
            <span className="ma-label">Moving average</span>
            {[7, 10, 28].map((d) => (
              <button key={d} className={ma === d ? 'on' : ''} onClick={() => setMa(d)}>{d}-day</button>
            ))}
          </div>
          <div className="card">
            <h3>Valence over time</h3>
            <p className="explain">
              Each dot is one article on the day it ran; the dark line is a <b>{ma}-day rolling average</b> that
              smooths daily swings; the grey band is neutral. Read the line, not single dots. Drag the slider to
              zoom; hover a dot for the story.
            </p>
            <TrendChart articles={arts} field="valence" windowDays={ma} />
          </div>
          <div className="card">
            <h3>Tone over time</h3>
            <p className="explain">
              The same articles on <b>tone</b> — the writing's slant, independent of topic. It should hug <b>0</b>
              {' '}(straight reporting) even while valence dips; a sustained move off zero would mean the writing
              itself turning critical or boosterish, not just the news getting heavier.
            </p>
            <TrendChart articles={arts} field="tone" windowDays={ma} />
          </div>
          <div className="grid2">
            <div className="card">
              <h3>Valence distribution</h3>
              <p className="explain">
                How the {data.meta.n_scored.toLocaleString()} valence scores spread — a pile‑up near zero (neutral
                civic coverage) with a long <b>negative tail</b> (courts, public safety, accountability).
              </p>
              <DistributionChart articles={arts} field="valence" />
            </div>
            <div className="card">
              <h3>Tone distribution</h3>
              <p className="explain">
                Tone clusters tightly at <b>0</b> — most reporting is written straight. The thin tails are the
                occasional pointed investigation (left) or celebratory feature (right).
              </p>
              <DistributionChart articles={arts} field="tone" />
            </div>
          </div>
          <div className="card">
            <h3>Articles per month</h3>
            <p className="explain">
              Publishing volume — context for the trends above. A month's average is more trustworthy when it
              sits on more articles.
            </p>
            <VolumeChart articles={arts} />
          </div>
        </Group>

        <Group n="02" label="Tone vs. topic">
          <div className="card">
            <h3>Valence vs. tone — why we score two numbers</h3>
            <p className="explain">
              Horizontal is <b>valence</b> (topic + feel); vertical is <b>tone</b> (the writing's slant). The
              cloud spreads <b>wide across but stays in a thin band vertically</b> — grim topics reported
              straight, not editorialized. That gap is the whole reason tone is scored separately.
            </p>
            <ToneScatter articles={arts} />
          </div>
        </Group>

        <Group n="03" label="By section & byline">
          <div className="card">
            <h3>Mean valence by section</h3>
            <p className="explain">
              Which beats carry the heaviest news. <b>Courts and Public Safety</b> skew negative (crime,
              accidents, litigation); <b>Community and Education</b> skew positive. Subject matter, not slant —
              tone stays near neutral across every beat.
            </p>
            <SectionChart articles={all} field="section" />
          </div>
          <div className="card">
            <h3>Mean valence by byline</h3>
            <p className="explain">
              Average valence per reporter and wire service (≥ 15 articles). Differences mostly track <b>what
              beat someone covers</b> — investigations and government vs. features — not individual bias. Wire
              bylines (Capitol Beat, Georgia Recorder) are state‑government coverage.
            </p>
            <SectionChart articles={all} field="author" minN={15} gridLeft={180} />
          </div>
          <div className="card">
            <h3>Valence heatmap — section × month</h3>
            <p className="explain">
              <b>Red</b> cells are a beat that ran negative that month — usually a specific cluster of stories;
              <b>green</b> is an upbeat stretch. Blank cells are months a section didn't publish.
            </p>
            <HeatmapChart articles={all} />
          </div>
        </Group>

        <Group n="04" label="Notable coverage">
          <div className="tables">
            <ArticleTable
              title="Most negative valence"
              caption="The model's hardest‑scoring stories. Hover a row for its one‑line rationale."
              rows={byVal.slice(0, 8)}
            />
            <ArticleTable
              title="Most positive valence"
              caption="The most upbeat coverage — openings, awards, recognitions, community wins."
              rows={byVal.slice(-8).reverse()}
            />
          </div>
        </Group>

        <footer className="foot">
          {data.meta.n_total.toLocaleString()} articles published in the window · {data.meta.n_scored.toLocaleString()} scored ·{' '}
          {data.meta.n_excluded_short} excluded as non‑substantive (results stubs under 50 words). Scores are a
          careful model read — stable across re‑runs and validated, but an annotator's judgment, not ground truth.
        </footer>
      </main>
      )}
    </div>
  )
}

function Group({ n, label, children }) {
  return (
    <section className="group">
      <p className="eyebrow"><span className="num">{n}</span><span className="label">{label}</span></p>
      {children}
    </section>
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
