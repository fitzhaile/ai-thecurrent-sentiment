import { useMemo } from 'react'
import EChart from './EChart'
import { histogram } from '../lib/aggregate'

const POS = '#2f7d5b', NEG = '#c1432e'

export default function DistributionChart({ articles, field = 'valence' }) {
  const option = useMemo(() => {
    const bins = histogram(articles, field, 0.2)
    return {
      grid: { left: 42, right: 16, top: 16, bottom: 42 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category', data: bins.map((b) => b.lo.toFixed(1)),
        name: field, nameLocation: 'middle', nameGap: 26,
      },
      yAxis: { type: 'value', name: 'articles' },
      series: [{
        type: 'bar', barWidth: '92%',
        data: bins.map((b) => ({ value: b.count, itemStyle: { color: b.hi <= 0 ? NEG : POS } })),
      }],
    }
  }, [articles, field])

  return <EChart option={option} height={260} />
}
