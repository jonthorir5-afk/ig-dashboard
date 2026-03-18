import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Search, Filter } from 'lucide-react'
import { getAccounts, getLatestSnapshots } from '../lib/api'
import { healthColor, formatNumber, getSnapshotViews, exportToCSV } from '../lib/metrics'
import { Download } from 'lucide-react'

export default function AlertsPage() {
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    Promise.all([getAccounts(), getLatestSnapshots()])
      .then(([accs, snaps]) => { setAccounts(accs); setSnapshots(snaps) })
      .finally(() => setLoading(false))
  }, [])

  const alerts = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) snapByAccount[s.account_id] = s

    const items = []

    for (const a of accounts) {
      const snap = snapByAccount[a.id]
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      // Health issues
      if (a.health !== 'Clean') {
        items.push({
          account: a,
          type: 'health',
          severity: a.health === 'Suspended' || a.health === 'Shadowbanned' ? 'critical' : 'warning',
          message: `Account is ${a.health}`,
          detail: `@${a.handle} (${a.platform}) — ${a.model?.name || 'Unknown model'}`
        })
      }

      // No data entered in last 7 days
      if (a.status === 'Active' && (!snap || snap.snapshot_date < sevenDaysAgo)) {
        items.push({
          account: a,
          type: 'missing_data',
          severity: 'warning',
          message: 'No snapshot data in last 7 days',
          detail: `@${a.handle} (${a.platform}) — Last data: ${snap?.snapshot_date || 'never'}`
        })
      }

      // Zero posts in last 7 days
      if (snap && a.status === 'Active') {
        const totalPosts = (snap.ig_reels_posted_7d || 0) + (snap.ig_stories_posted_7d || 0)
          + (snap.tw_tweets_posted_7d || 0) + (snap.rd_posts_7d || 0) + (snap.tt_videos_posted_7d || 0)
        if (totalPosts === 0) {
          items.push({
            account: a,
            type: 'zero_posts',
            severity: 'info',
            message: 'Zero posts in last 7 days',
            detail: `@${a.handle} (${a.platform})`
          })
        }
      }

      // New account not yet producing (>14 days, no meaningful metrics)
      if (a.status === 'Active') {
        const daysSinceCreated = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000)
        if (daysSinceCreated > 14 && (!snap || (snap.followers || 0) < 10)) {
          items.push({
            account: a,
            type: 'stale_new',
            severity: 'info',
            message: `Account >14 days old with no meaningful metrics`,
            detail: `@${a.handle} — Created ${daysSinceCreated} days ago, ${snap?.followers || 0} followers`
          })
        }
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return items
  }, [accounts, snapshots])

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts
    return alerts.filter(a => a.type === filter)
  }, [alerts, filter])

  const severityStyles = {
    critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
    info: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' }
  }

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Alerts & Flags</h1>
          <p>{alerts.length} item(s) need attention</p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          const rows = filtered.map(a => ({ handle: a.detail, type: a.type, severity: a.severity, message: a.message }))
          exportToCSV(rows, 'alerts.csv')
        }}>
          <Download size={16} /> Export
        </button>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <FilterBadge label="All" count={alerts.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterBadge label="Health Issues" count={alerts.filter(a => a.type === 'health').length} active={filter === 'health'} onClick={() => setFilter('health')} color="#ef4444" />
        <FilterBadge label="Missing Data" count={alerts.filter(a => a.type === 'missing_data').length} active={filter === 'missing_data'} onClick={() => setFilter('missing_data')} color="#f59e0b" />
        <FilterBadge label="Zero Posts" count={alerts.filter(a => a.type === 'zero_posts').length} active={filter === 'zero_posts'} onClick={() => setFilter('zero_posts')} color="#6366f1" />
        <FilterBadge label="Stale Accounts" count={alerts.filter(a => a.type === 'stale_new').length} active={filter === 'stale_new'} onClick={() => setFilter('stale_new')} color="#8b5cf6" />
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map((alert, i) => {
          const s = severityStyles[alert.severity]
          return (
            <div key={i} style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <AlertTriangle size={20} color={s.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{alert.message}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>{alert.detail}</p>
              </div>
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: s.color, background: 'rgba(0,0,0,0.2)' }}>
                {alert.severity}
              </span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="glass-panel flex-center" style={{ padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--accent-success)', fontSize: '1.1rem', fontWeight: 600 }}>All clear!</p>
            <p style={{ color: 'var(--text-tertiary)' }}>No alerts or flags at this time.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterBadge({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '0.8rem' }}
    >
      {label}
      <span style={{
        marginLeft: '6px', padding: '0 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.2)' : (color ? `${color}22` : 'var(--bg-tertiary)'),
        color: active ? 'white' : (color || 'var(--text-secondary)')
      }}>
        {count}
      </span>
    </button>
  )
}
