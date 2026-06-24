import { useMemo } from 'react'
import EChart from './EChart'
import { monthlyMean } from '../lib/aggregate'

export default function VolumeChart({ articles }) {
  const option = useMemo(() => {
    const m = monthlyMean(articles, 'valence') // also carries n per month
    return {
      grid: { left: 38, right: 16, top: 16, bottom: 52 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: m.map((x) => x.month), axisLabel: { rotate: 45, fontSize: 10 } },
      yAxis: { type: 'value', name: 'articles' },
      series: [{ type: 'bar', barWidth: '68%', itemStyle: { color: '#1f3a5f' }, data: m.map((x) => x.n) }],
    }
  }, [articles])

  return <EChart option={option} height={260} />
}
