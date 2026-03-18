import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import { formatNumber } from '../../lib/metrics'
import { COLORS } from './TrendChart'

const chartTheme = {
  grid: 'rgba(255, 255, 255, 0.05)',
  text: '#94a3b8',
  tooltipBg: '#1a1d24',
  tooltipBorder: 'rgba(255,255,255,0.1)',
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`,
      borderRadius: '8px', padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
    }}>
      <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.8rem', marginBottom: '6px' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.fill || entry.color, fontSize: '0.75rem', margin: '2px 0' }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

/**
 * Horizontal or vertical bar chart for comparisons.
 * data: [{ name: 'Model A', value: 500 }, ...]
 * bars: [{ key: 'value', label: 'Followers', color: '#6366f1' }]
 */
export default function BarChartComponent({ data, bars, height = 300, layout = 'vertical', formatter }) {
  if (!data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
        No data to display yet
      </div>
    )
  }

  const isHorizontal = layout === 'horizontal'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 20, left: isHorizontal ? 80 : 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
            <YAxis type="category" dataKey="name" tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={false} width={75} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: chartTheme.grid }} />
            <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
          </>
        )}
        <Tooltip content={<CustomTooltip formatter={formatter || formatNumber} />} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: '0.75rem' }} />}
        {bars.map(bar => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.label}
            fill={bar.color || COLORS.primary}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  )
}
