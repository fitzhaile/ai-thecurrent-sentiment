import { useMemo } from 'react'
import EChart from './EChart'

// Both outlets' articles on valence (x) vs tone (y), each in its outlet colour,
// with a large ringed marker at each outlet's centroid. The two clouds sit in
// different quadrants — the whole story in one chart.
export default function ComparisonScatter({ data }) {
  const option = useMemo(() => {
    const series = data.meta.outlets.map((o) => {
      const rows = data[o.key]
      const mv = rows.reduce((s, r) => s + r.valence, 0) / rows.length
      const mt = rows.reduce((s, r) => s + r.tone, 0) / rows.length
      return {
        name: o.name, type: 'scatter', symbolSize: 7,
        data: rows.map((r) => ({ value: [r.valence, r.tone], title: r.title })),
        itemStyle: { color: o.color, opacity: 0.34 },
        emphasis: { focus: 'series', scale: 1.8, itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 1 } },
        markPoint: {
          symbol: 'circle', symbolSize: 26, silent: true,
          itemStyle: { color: o.color, borderColor: '#fff', borderWidth: 2.5,
            shadowBlur: 6, shadowColor: 'rgba(0,0,0,.25)' },
          data: [{ coord: [mv, mt] }],
        },
      }
    })
    return {
      grid: { left: 54, right: 22, top: 38, bottom: 52 },
      legend: { top: 4, data: data.meta.outlets.map((o) => o.name), icon: 'circle' },
      tooltip: {
        trigger: 'item', confine: true,
        formatter: (p) => p.data && p.data.title
          ? `${p.data.title}<br/><span style="color:${p.color}">●</span> ${p.seriesName} · <b>valence ${p.value[0].toFixed(2)} / tone ${p.value[1].toFixed(2)}</b>`
          : '',
      },
      xAxis: {
        type: 'value', min: -1, max: 1, name: 'valence  (negative ◂—▸ positive)',
        nameLocation: 'middle', nameGap: 30, splitLine: { lineStyle: { color: '#eef0f2' } },
        axisLine: { lineStyle: { color: '#ccc' } },
      },
      yAxis: {
        type: 'value', min: -1, max: 1, name: "tone  (straight ◂—▸ warm)",
        nameLocation: 'middle', nameGap: 38, splitLine: { lineStyle: { color: '#eef0f2' } },
      },
      series,
    }
  }, [data])
  return <EChart option={option} height={440} />
}
