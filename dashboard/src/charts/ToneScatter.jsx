import { useMemo } from 'react'
import EChart from './EChart'

const POS = '#2f7d5b', NEG = '#c1432e', NEU = '#9fb0bb'

// Valence (x) vs tone (y). The point: a wide horizontal spread with a narrow
// vertical band means the two dimensions were measured independently — tone did
// not just copy valence.
export default function ToneScatter({ articles }) {
  const option = useMemo(() => ({
    grid: { left: 50, right: 24, top: 16, bottom: 46 },
    tooltip: {
      trigger: 'item',
      formatter: (p) =>
        `${p.data.title}<br/><b>valence ${p.value[0].toFixed(2)} · tone ${p.value[1].toFixed(2)}</b>`,
    },
    xAxis: {
      type: 'value', min: -1, max: 1, name: 'valence', nameLocation: 'middle', nameGap: 28,
      splitLine: { lineStyle: { color: '#eee' } },
    },
    yAxis: {
      type: 'value', min: -1, max: 1, name: 'tone', nameLocation: 'middle', nameGap: 36,
      splitLine: { lineStyle: { color: '#eee' } },
    },
    series: [{
      type: 'scatter', symbolSize: 6,
      data: articles.map((a) => ({ value: [a.valence, a.tone], title: a.title })),
      itemStyle: { opacity: 0.32, color: (p) => (p.value[0] > 0.15 ? POS : p.value[0] < -0.15 ? NEG : NEU) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ccc' }, data: [{ xAxis: 0 }, { yAxis: 0 }] },
    }],
  }), [articles])

  return <EChart option={option} height={340} />
}
