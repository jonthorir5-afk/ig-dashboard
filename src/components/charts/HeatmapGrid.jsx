/**
 * Heatmap grid for quick visual scanning.
 * rows: [{ label: 'Model A', cells: [{ value: 50, label: 'W1' }, ...] }]
 * colorScale: function(value) => color string
 */
export default function HeatmapGrid({ rows = [], columns = [], colorScale, valueFormatter, title }) {
  if (!rows.length) return null

  return (
    <div>
      {title && <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{title}</h4>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 500 }}></th>
              {columns.map(col => (
                <th key={col} style={{ textAlign: 'center', padding: '4px 6px', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 500, minWidth: '48px' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {row.label}
                </td>
                {row.cells.map((cell, i) => {
                  const bg = cell.value != null ? colorScale(cell.value) : 'var(--bg-tertiary)'
                  return (
                    <td key={i} style={{
                      textAlign: 'center', padding: '6px 4px', borderRadius: '4px',
                      background: bg, fontSize: '0.7rem', fontWeight: 600,
                      color: cell.value != null ? '#fff' : 'var(--text-tertiary)',
                      cursor: 'default'
                    }}
                    title={`${row.label} — ${columns[i]}: ${cell.value != null ? (valueFormatter ? valueFormatter(cell.value) : cell.value) : 'N/A'}`}
                    >
                      {cell.value != null ? (valueFormatter ? valueFormatter(cell.value) : cell.value) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Common color scales for heatmaps.
 */
export function viewsColorScale(value) {
  if (value >= 100000) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 50000) return 'rgba(16, 185, 129, 0.7)'
  if (value >= 20000) return 'rgba(16, 185, 129, 0.5)'
  if (value >= 5000) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 1000) return 'rgba(245, 158, 11, 0.3)'
  return 'rgba(239, 68, 68, 0.3)'
}

export function vtfrColorScale(value) {
  if (value >= 100) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 50) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 30) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 20) return 'rgba(249, 115, 22, 0.5)'
  return 'rgba(239, 68, 68, 0.4)'
}

export function erColorScale(value) {
  if (value >= 10) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 5) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 3) return 'rgba(245, 158, 11, 0.5)'
  return 'rgba(239, 68, 68, 0.4)'
}

export function followerGrowthColorScale(value) {
  if (value >= 20) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 10) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 5) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 0) return 'rgba(245, 158, 11, 0.3)'
  return 'rgba(239, 68, 68, 0.5)'
}
