import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

// Thin wrapper: init the chart once, setOption on change, resize with the window.
// Using echarts directly avoids depending on a React-version-sensitive binding.
export default function EChart({ option, height = 300 }) {
  const el = useRef(null)
  const chart = useRef(null)

  useEffect(() => {
    chart.current = echarts.init(el.current)
    const onResize = () => chart.current && chart.current.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.current && chart.current.dispose()
    }
  }, [])

  useEffect(() => {
    if (chart.current) chart.current.setOption({ textStyle: { fontFamily: '"Libre Franklin", system-ui, sans-serif' }, ...option }, true)
  }, [option])

  return <div ref={el} style={{ width: '100%', height }} />
}
