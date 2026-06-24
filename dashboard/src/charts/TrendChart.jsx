import { useMemo } from 'react'
import EChart from './EChart'
import { toTime, rolling, monthlyMean } from '../lib/aggregate'

const POS = '#2f7d5b', NEG = '#c1432e', NEU = '#b8b2a4', ACCENT = '#46403a'

export default function TrendChart({ articles }) {
  const option = useMemo(() => {
    const scatter = articles
      .filter((a) => a.date)
      .map((a) => ({ value: [toTime(a.date), a.valence], title: a.title, section: a.section }))
    const roll = rolling(articles, 'valence', 7)
    const monthly = monthlyMean(articles, 'valence').map((m) => [toTime(m.month + '-15T00:00:00'), m.mean])

    return {
      grid: { left: 46, right: 20, top: 34, bottom: 58 },
      legend: { top: 2, data: ['articles', '7-day average', 'monthly mean'] },
      tooltip: {
        trigger: 'item', confine: true,
        formatter: (p) => {
          if (p.seriesName === 'articles') {
            const d = new Date(p.value[0]).toISOString().slice(0, 10)
            return `${p.data.title}<br/><span style="color:#888">${p.data.section} · ${d}</span><br/><b>valence ${p.value[1].toFixed(2)}</b>`
          }
          return `${p.seriesName}: <b>${p.value[1].toFixed(2)}</b>`
        },
      },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#ccc' } } },
      yAxis: {
        type: 'value', min: -1, max: 1, name: 'valence', nameLocation: 'middle', nameGap: 32,
        splitLine: { lineStyle: { color: '#eee' } },
      },
      series: [
        {
          // The dots — bigger, brighter, and they pop on hover so they're easy to target.
          name: 'articles', type: 'scatter', data: scatter, symbolSize: 6, large: false, z: 2,
          itemStyle: {
            opacity: 0.45,
            color: (p) => (p.value[1] > 0.15 ? POS : p.value[1] < -0.15 ? NEG : NEU),
          },
          emphasis: { scale: 2.2, itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 1 } },
          markArea: {
            silent: true, itemStyle: { color: 'rgba(150,150,145,0.10)' },
            data: [[{ yAxis: -0.15 }, { yAxis: 0.15 }]],
          },
          markLine: {
            silent: true, symbol: 'none', lineStyle: { color: '#bbb', type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
        {
          // silent: true -> the line never steals the mouse from the dots beneath it.
          name: '7-day average', type: 'line', data: roll, showSymbol: false, smooth: true,
          silent: true, lineStyle: { width: 3, color: ACCENT }, z: 3,
        },
        {
          name: 'monthly mean', type: 'line', data: monthly, showSymbol: true, symbolSize: 5,
          silent: true, lineStyle: { width: 1.5, color: '#999', type: 'dotted' }, itemStyle: { color: '#999' }, z: 1,
        },
      ],
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 8, height: 18 }],
    }
  }, [articles])

  return <EChart option={option} height={400} />
}
