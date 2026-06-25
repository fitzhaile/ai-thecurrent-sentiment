import { useEffect, useState } from 'react'
import ThemesChart from './charts/ThemesChart'

// Renders only once build_topics.py has produced themes.json (otherwise null), so
// the dashboard works with or without the BERTopic step having been run.
export default function ThemesSection({ n = '04' }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}themes.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data || !data.themes?.length) return null

  return (
    <section className="group">
      <p className="eyebrow"><span className="num">{n}</span><span className="label">Discovered themes</span></p>
      <div className="card">
        <h3>Themes the model found on its own</h3>
        <p className="explain">
          Unlike the editor‑assigned sections above, these <b>{data.n_themes} themes</b> were found bottom‑up by
          clustering the articles' meaning (<b>BERTopic</b> over sentence embeddings — no labels given). Each bar
          is a theme's mean valence; the number on the right is how many articles it holds. It's a data‑driven
          cross‑check on what the coverage is actually about, and which subjects run negative.
          {data.n_unclustered ? ` (${data.n_unclustered} articles didn't fit a theme.)` : ''}
        </p>
        <ThemesChart themes={data.themes} />
      </div>
    </section>
  )
}
