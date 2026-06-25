import { useMemo } from 'react'
import EChart from './EChart'
import { histogram } from '../lib/aggregate'

// Overlaid distribution of valence or tone for both outlets, normalised to % of
// each outlet's own articles so the different sample sizes stay comparable.
export default function ComparisonHist({ data, field }) {
  const option = useMemo(() => {
    const labels = histogram(data.current, field, 0.2).map((b) => b.lo.toFixed(1))
    const series = data.meta.outlets.map((o) => {
      const n = data[o.key].length
      const pct = histogram(data[o.key], field, 0.2).map((b) => +(b.count / n * 100).toFixed(1))
      return {
        name: o.name, type: 'bar', data: pct,
        itemStyle: { color: o.color, opacity: 0.85, borderRadius: [3, 3, 0, 0] },
        barGap: '-35%', barCategoryGap: '32%',
      }
    })
    return {
      grid: { left: 46, right: 16, top: 32, bottom: 38 },
      legend: { top: 2, data: data.meta.outlets.map((o) => o.name), icon: 'roundRect' },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
      xAxis: {
        type: 'category', data: labels, name: field, nameLocation: 'middle', nameGap: 24,
        axisLabel: { fontSize: 10 },
      },
      yAxis: { type: 'value', name: '% of articles', axisLabel: { formatter: '{value}%' } },
      series,
    }
  }, [data, field])
  return <EChart option={option} height={300} />
}
