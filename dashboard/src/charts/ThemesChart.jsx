import { useMemo } from 'react'
import EChart from './EChart'

const POS = '#2f7d5b', NEG = '#c1432e'

// Horizontal bar of mean valence by discovered (BERTopic) theme, sorted most-
// negative first; the right-hand number is how many articles the theme holds.
export default function ThemesChart({ themes }) {
  const { option, h } = useMemo(() => {
    const t = [...themes].sort((a, b) => a.mean_valence - b.mean_valence)
    const opt = {
      grid: { left: 210, right: 54, top: 10, bottom: 34 },
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const th = t[p.dataIndex]
          return `<b>${th.keywords.slice(0, 5).join(', ')}</b><br/>${th.size} articles · `
            + `mean valence ${th.mean_valence.toFixed(2)} · tone ${th.mean_tone.toFixed(2)}<br/>`
            + `<span style="color:#888">${th.examples.slice(0, 2).join('<br/>')}</span>`
        },
      },
      xAxis: { type: 'value', min: -0.7, max: 0.7, name: 'mean valence', nameLocation: 'middle', nameGap: 24 },
      yAxis: {
        type: 'category', data: t.map((x) => x.label),
        axisLabel: { fontSize: 11, width: 196, overflow: 'truncate' },
      },
      series: [{
        type: 'bar',
        data: t.map((x) => ({ value: x.mean_valence, itemStyle: { color: x.mean_valence < 0 ? NEG : POS } })),
        label: { show: true, position: 'right', fontSize: 10, color: '#777', formatter: (p) => `${t[p.dataIndex].size}` },
      }],
    }
    return { option: opt, h: Math.max(260, t.length * 25 + 60) }
  }, [themes])

  return <EChart option={option} height={h} />
}
