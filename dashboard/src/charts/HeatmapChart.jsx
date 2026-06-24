import { useMemo } from 'react'
import EChart from './EChart'
import { monthSectionMatrix } from '../lib/aggregate'

export default function HeatmapChart({ articles }) {
  const { option, h } = useMemo(() => {
    const { months, sections, data } = monthSectionMatrix(articles, 20)
    const opt = {
      grid: { left: 124, right: 24, top: 10, bottom: 78 },
      tooltip: {
        position: 'top',
        formatter: (p) =>
          `${sections[p.value[1]]} · ${months[p.value[0]]}<br/>mean valence <b>${p.value[2].toFixed(2)}</b> (n=${p.value[3]})`,
      },
      xAxis: { type: 'category', data: months, axisLabel: { rotate: 45, fontSize: 10 }, splitArea: { show: true } },
      yAxis: { type: 'category', data: sections, axisLabel: { fontSize: 11 }, splitArea: { show: true } },
      visualMap: {
        min: -0.5, max: 0.5, calculable: true, orient: 'horizontal', left: 'center', bottom: 8,
        inRange: { color: ['#c1432e', '#f1efe9', '#2f7d5b'] }, text: ['positive', 'negative'],
        itemWidth: 14,
      },
      series: [{
        type: 'heatmap', data, label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,.2)' } },
      }],
    }
    return { option: opt, h: Math.max(280, sections.length * 30 + 130) }
  }, [articles])

  return <EChart option={option} height={h} />
}
