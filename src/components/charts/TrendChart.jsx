import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Area, AreaChart
} from 'recharts'
import { formatNumber } from '../../lib/metrics'

const COLORS = {
  primary: '#6366f1',
  secondary: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
}

const chartTheme = {
  bg: 'rgba(26, 29, 36, 0.9)',
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
        <p key={i} style={{ color: entry.color, fontSize: '0.75rem', margin: '2px 0' }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

/**
 * Multi-line trend chart for time-series data.
 * data: [{ date: '2024-03-01', followers: 100, views: 5000, ... }, ...]
 * lines: [{ key: 'followers', label: 'Followers', color: '#10b981' }, ...]
 */
export function TrendChart({ data, lines, height = 300, formatter }) {
  const hasPlottableData = Array.isArray(data) && data.some(row =>
    lines.some(line => row?.[line.key] != null)
  )
  if (!data?.length || !hasPlottableData) return <EmptyChart height={height} />

  const singlePoint = data.length === 1
  const renderDot = (props) => {
    const { cx, cy, payload, dataKey, stroke } = props
    if (!payload || payload[dataKey] == null) return null
    return <circle cx={cx} cy={cy} r={singlePoint ? 5 : 3} fill={stroke} stroke="none" />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        <XAxis dataKey="date" tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: chartTheme.grid }} />
        <YAxis domain={[0, 'auto']} tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
        <Tooltip content={<CustomTooltip formatter={formatter || formatNumber} />} />
        <Legend wrapperStyle={{ fontSize: '0.75rem', color: chartTheme.text }} />
        {lines.map(line => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color || COLORS.primary}
            strokeWidth={2}
            dot={renderDot}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * Filled area chart — good for single metric trends.
 */
export function AreaTrendChart({ data, dataKey, label, color = COLORS.primary, height = 250, formatter }) {
  const hasPlottableData = Array.isArray(data) && data.some(row => row?.[dataKey] != null)
  if (!data?.length || !hasPlottableData) return <EmptyChart height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        <XAxis dataKey="date" tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: chartTheme.grid }} />
        <YAxis domain={[0, 'auto']} tick={{ fill: chartTheme.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
        <Tooltip content={<CustomTooltip formatter={formatter || formatNumber} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${dataKey})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', border: '1px dashed var(--border-color)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
      No data yet — check back after the first scrape runs
    </div>
  )
}

export { COLORS }
