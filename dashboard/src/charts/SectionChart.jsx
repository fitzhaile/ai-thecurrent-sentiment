import { useMemo } from 'react'
import EChart from './EChart'
import { groupMean } from '../lib/aggregate'

const POS = '#2f7d5b', NEG = '#c1432e'

// Horizontal bar of mean valence by a grouping field (section or author).
export default function SectionChart({ articles, field = 'section', minN = 8, gridLeft = 130 }) {
  const { option, h } = useMemo(() => {
    const g = groupMean(articles, field)
      .filter((x) => x.n >= minN)
      .sort((a, b) => a.mean - b.mean)
    const opt = {
      grid: { left: gridLeft, right: 48, top: 12, bottom: 34 },
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}<br/>mean valence <b>${p.value.toFixed(2)}</b> (n=${g[p.dataIndex].n})`,
      },
      xAxis: { type: 'value', min: -0.6, max: 0.6, name: 'mean valence', nameLocation: 'middle', nameGap: 24 },
      yAxis: { type: 'category', data: g.map((x) => x.group), axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar',
        data: g.map((x) => ({ value: x.mean, itemStyle: { color: x.mean < 0 ? NEG : POS } })),
        label: { show: true, position: 'right', fontSize: 10, formatter: (p) => p.value.toFixed(2) },
      }],
    }
    return { option: opt, h: Math.max(220, g.length * 26 + 60) }
  }, [articles, field, minN, gridLeft])

  return <EChart option={option} height={h} />
}
