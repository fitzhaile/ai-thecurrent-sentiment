// Aggregation helpers for the sentiment dashboard. Pure functions over the
// articles array ({date, valence, tone, section, author, ...}).

export const DAY = 86400000

export const toTime = (iso) => new Date(iso).getTime()
export const monthKey = (iso) => iso.slice(0, 7) // YYYY-MM
export const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

export function monthlyMean(arts, key = 'valence') {
  const m = new Map()
  for (const a of arts) {
    if (!a.date) continue
    const k = monthKey(a.date)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(a[key])
  }
  return [...m.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([month, vs]) => ({ month, mean: avg(vs), n: vs.length }))
}

// Trailing N-day rolling average, one point per article (time-sorted).
export function rolling(arts, key = 'valence', windowDays = 28) {
  const s = arts.filter((a) => a.date).sort((a, b) => toTime(a.date) - toTime(b.date))
  const w = windowDays * DAY
  const out = []
  let lo = 0
  for (let i = 0; i < s.length; i++) {
    const t = toTime(s[i].date)
    while (toTime(s[lo].date) < t - w) lo++
    let sum = 0
    for (let j = lo; j <= i; j++) sum += s[j][key]
    out.push([t, sum / (i - lo + 1)])
  }
  return out
}

export function groupMean(arts, field, key = 'valence') {
  const m = new Map()
  for (const a of arts) {
    const g = a[field] || '(none)'
    if (!m.has(g)) m.set(g, [])
    m.get(g).push(a[key])
  }
  return [...m.entries()].map(([group, vs]) => ({ group, mean: avg(vs), n: vs.length }))
}

export function histogram(arts, key = 'valence', binSize = 0.2) {
  const bins = []
  for (let lo = -1; lo < 1 - 1e-9; lo += binSize) bins.push({ lo, hi: lo + binSize, count: 0 })
  for (const a of arts) {
    let idx = Math.floor((a[key] + 1) / binSize)
    idx = Math.max(0, Math.min(bins.length - 1, idx))
    bins[idx].count++
  }
  return bins
}

export const sections = (arts) =>
  [...new Set(arts.map((a) => a.section).filter(Boolean))].sort()

// month (x) x section (y) mean-valence matrix for the heatmap.
// Only sections with >= minSectionN articles, ordered most-negative first.
export function monthSectionMatrix(arts, minSectionN = 20) {
  const months = [...new Set(arts.filter((a) => a.date).map((a) => monthKey(a.date)))].sort()
  const secs = groupMean(arts, 'section')
    .filter((s) => s.n >= minSectionN)
    .sort((a, b) => a.mean - b.mean)
    .map((s) => s.group)
  const secSet = new Set(secs)
  const cell = new Map()
  for (const a of arts) {
    if (!a.date || !secSet.has(a.section)) continue
    const k = `${monthKey(a.date)}|${a.section}`
    if (!cell.has(k)) cell.set(k, [])
    cell.get(k).push(a.valence)
  }
  const data = []
  months.forEach((m, xi) =>
    secs.forEach((s, yi) => {
      const arr = cell.get(`${m}|${s}`)
      if (arr && arr.length) data.push([xi, yi, +avg(arr).toFixed(2), arr.length])
    }),
  )
  return { months, sections: secs, data }
}
