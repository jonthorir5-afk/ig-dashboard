import { ResponsiveContainer, LineChart, Line } from 'recharts'

/**
 * Tiny inline sparkline for use in table cells.
 * data: array of numbers, e.g. [100, 120, 115, 140, 160]
 */
export default function Sparkline({ data = [], color = '#6366f1', width = 80, height = 28 }) {
  if (!data.length) return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>—</span>

  const chartData = data.map((v, i) => ({ i, v }))
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0
  const lineColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : color

  return (
    <div style={{ display: 'inline-block', width, height, verticalAlign: 'middle' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
