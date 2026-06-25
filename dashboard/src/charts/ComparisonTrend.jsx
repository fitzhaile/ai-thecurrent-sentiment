import { useMemo } from 'react'
import EChart from './EChart'
import { monthlyMean, toTime } from '../lib/aggregate'

// Monthly-mean valence (or tone) over the two years, one line per outlet.
// Monthly buckets — not a short rolling window — keep it stable for Connect
// Savannah's lighter volume. A dashed line marks neutral (0).
export default function ComparisonTrend({ data, field = 'valence' }) {
  const option = useMemo(() => {
    const series = data.meta.outlets.map((o, i) => {
      const m = monthlyMean(data[o.key], field)
      return {
        name: o.name, type: 'line', smooth: true, showSymbol: true, symbolSize: 5,
        connectNulls: true,
        data: m.map((x) => [toTime(x.month + '-15T00:00:00'), +x.mean.toFixed(3)]),
        lineStyle: { width: 2.5, color: o.color }, itemStyle: { color: o.color },
        emphasis: { focus: 'series' },
        ...(i === 0 ? {
          markLine: {
            silent: true, symbol: 'none', lineStyle: { color: '#bbb', type: 'dashed' },
            data: [{ yAxis: 0, label: { formatter: 'neutral', position: 'insideEndTop', color: '#999', fontSize: 10 } }],
          },
        } : {}),
      }
    })
    return {
      grid: { left: 48, right: 22, top: 34, bottom: 64 },
      legend: { top: 2, data: data.meta.outlets.map((o) => o.name), icon: 'circle' },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`),
      },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#ccc' } } },
      yAxis: {
        type: 'value', min: -1, max: 1, name: `mean ${field}`, nameGap: 14,
        splitLine: { lineStyle: { color: '#eef0f2' } },
      },
      series,
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10, height: 16 }],
    }
  }, [data, field])
  return <EChart option={option} height={360} />
}
