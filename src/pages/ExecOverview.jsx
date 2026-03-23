import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Users, MousePointerClick, AlertTriangle, TrendingUp, TrendingDown, ChevronRight, Download, BarChart3 } from 'lucide-react'
import { getExecOverview, getAllSnapshotHistory } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, exportToCSV } from '../lib/metrics'
import { TrendChart, COLORS } from '../components/charts/TrendChart'
import BarChartComponent from '../components/charts/BarChart'

export default function ExecOverview() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getExecOverview(), getAllSnapshotHistory(30)])
      .then(([d, h]) => { setData(d); setHistory(h) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    if (!data) return null

    const { models, accounts, snapshots } = data
    const activeAccounts = accounts.filter(a => a.status === 'Active')

    // Platform counts
    const platformCounts = {}
    for (const a of accounts) {
      platformCounts[a.platform] = (platformCounts[a.platform] || 0) + 1
    }

    // Latest snapshots per account (last 7 days)
    const now = new Date()
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0]
    const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString().split('T')[0]

    const recentSnapshots = snapshots.filter(s => s.snapshot_date >= sevenDaysAgo)
    const previousSnapshots = snapshots.filter(s => s.snapshot_date >= fourteenDaysAgo && s.snapshot_date < sevenDaysAgo)

    // Latest snapshot per account
    const latestByAccount = {}
    for (const s of recentSnapshots) {
      if (!latestByAccount[s.account_id] || s.snapshot_date > latestByAccount[s.account_id].snapshot_date) {
        latestByAccount[s.account_id] = s
      }
    }
    const previousByAccount = {}
    for (const s of previousSnapshots) {
      if (!previousByAccount[s.account_id] || s.snapshot_date > previousByAccount[s.account_id].snapshot_date) {
        previousByAccount[s.account_id] = s
      }
    }

    const latestArr = Object.values(latestByAccount)
    const prevArr = Object.values(previousByAccount)

    const totalReach = latestArr.reduce((sum, s) => sum + getSnapshotViews(s), 0)
    const totalClicks = latestArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)
    const prevReach = prevArr.reduce((sum, s) => sum + getSnapshotViews(s), 0)
    const prevClicks = prevArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)

    const reachTrend = prevReach ? ((totalReach - prevReach) / prevReach * 100).toFixed(1) : null
    const clicksTrend = prevClicks ? ((totalClicks - prevClicks) / prevClicks * 100).toFixed(1) : null

    // Top & bottom models by reach
    const modelReach = {}
    for (const s of latestArr) {
      const modelName = s.account?.model?.name || 'Unknown'
      modelReach[modelName] = (modelReach[modelName] || 0) + getSnapshotViews(s)
    }
    const modelRanking = Object.entries(modelReach)
      .map(([name, reach]) => ({ name, reach }))
      .sort((a, b) => b.reach - a.reach)

    // Flagged accounts
    const flagged = accounts.filter(a =>
      a.health !== 'Clean' || a.status === 'Shadowbanned' || a.status === 'Suspended'
    )

    // Accounts with no recent snapshots (missing data)
    const accountsWithData = new Set(recentSnapshots.map(s => s.account_id))
    const missingData = activeAccounts.filter(a => !accountsWithData.has(a.id))

    return {
      activeModels: models.length,
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      platformCounts,
      totalReach,
      totalClicks,
      reachTrend,
      clicksTrend,
      topModels: modelRanking.slice(0, 3),
      bottomModels: modelRanking.slice(-3).reverse(),
      flagged,
      missingData,
      latestSnapshots: latestArr,
      modelRanking,
    }
  }, [data])

  // Daily aggregate trend from snapshot history
  const dailyTrend = useMemo(() => {
    if (!history.length) return []
    const dateMap = {}
    for (const s of history) {
      if (!dateMap[s.snapshot_date]) dateMap[s.snapshot_date] = { date: s.snapshot_date, followers: 0, views: 0, clicks: 0 }
      dateMap[s.snapshot_date].followers += s.followers || 0
      dateMap[s.snapshot_date].views += getSnapshotViews(s)
      dateMap[s.snapshot_date].clicks += getSnapshotClicks(s)
    }
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  }, [history])

  // Model bar chart data
  const modelBarData = useMemo(() => {
    if (!stats?.modelRanking) return []
    return stats.modelRanking.map(m => ({ name: m.name, views: m.reach }))
  }, [stats])

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '60vh' }}>
        <div className="loader" />
        <p style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Loading overview...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <AlertTriangle size={48} color="var(--accent-danger)" />
        <p style={{ color: 'var(--text-secondary)' }}>Error: {error}</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          Make sure you've run the schema.sql in your Supabase SQL editor.
        </p>
      </div>
    )
  }

  if (!stats) return null

  const MetricCard = ({ icon: Icon, iconClass, label, value, trend, trendLabel }) => (
    <div className="metric-card glass-panel">
      <div className={`metric-icon ${iconClass}`}>
        <Icon size={24} />
      </div>
      <div className="metric-data">
        <p className="metric-label">{label}</p>
        <h3 className="metric-value">{value}</h3>
        {trend != null && (
          <span className={`metric-trend ${Number(trend) >= 0 ? 'positive' : 'negative'}`}>
            {Number(trend) >= 0 ? '+' : ''}{trend}% {trendLabel || 'vs last week'}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Executive Overview</h1>
          <p>All traffic operations at a glance</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (stats.latestSnapshots.length) {
              const rows = stats.latestSnapshots.map(s => ({
                account: s.account?.handle || s.account_id,
                platform: s.account?.platform,
                model: s.account?.model?.name,
                date: s.snapshot_date,
                followers: s.followers,
                views: getSnapshotViews(s),
                clicks: getSnapshotClicks(s),
                health: s.account?.health
              }))
              exportToCSV(rows, `overview-${new Date().toISOString().split('T')[0]}.csv`)
            }
          }}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Top-level metrics */}
      <div className="metrics-grid">
        <MetricCard icon={Users} iconClass="followers" label="Active Models" value={stats.activeModels} />
        <MetricCard
          icon={Eye} iconClass="views"
          label="Total Reach (7d)"
          value={formatNumber(stats.totalReach)}
          trend={stats.reachTrend}
        />
        <MetricCard
          icon={MousePointerClick} iconClass="engagement"
          label="Total Link Clicks (7d)"
          value={formatNumber(stats.totalClicks)}
          trend={stats.clicksTrend}
        />
        <MetricCard
          icon={AlertTriangle} iconClass="winners"
          label="Flagged Accounts"
          value={stats.flagged.length}
        />
      </div>

      {/* Platform breakdown */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {['instagram', 'twitter', 'reddit', 'tiktok'].map(p => (
          <Link to={`/platforms/${p}`} key={p} className="metric-card glass-panel" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <div className="metric-data">
              <p className="metric-label" style={{ textTransform: 'capitalize' }}>{p === 'twitter' ? 'Twitter / X' : p}</p>
              <h3 className="metric-value">{stats.platformCounts[p] || 0}</h3>
              <span className="metric-text">accounts</span>
            </div>
            <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
          </Link>
        ))}
      </div>

      {/* Trend Charts */}
      {dailyTrend.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Network Views & Clicks (30d)</h3>
            <TrendChart
              data={dailyTrend}
              lines={[
                { key: 'views', label: 'Views', color: COLORS.primary },
                { key: 'clicks', label: 'Clicks', color: COLORS.warning },
              ]}
              height={240}
            />
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Total Followers (30d)</h3>
            <TrendChart
              data={dailyTrend}
              lines={[{ key: 'followers', label: 'Followers', color: COLORS.success }]}
              height={240}
            />
          </div>
        </div>
      )}

      {/* Model Reach Comparison */}
      {modelBarData.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} color="var(--accent-primary)" /> Model Reach Comparison (7d)
          </h3>
          <BarChartComponent
            data={modelBarData}
            bars={[{ key: 'views', label: 'Views', color: COLORS.primary }]}
            layout="horizontal"
            height={Math.max(200, modelBarData.length * 40)}
          />
        </div>
      )}

      {/* Top & Bottom Models + Flagged */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
        {/* Top 3 */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="var(--accent-success)" /> Top Models
          </h3>
          {stats.topModels.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No data yet</p>}
          {stats.topModels.map((m, i) => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: i < 2 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ color: 'var(--text-primary)' }}>{i + 1}. {m.name}</span>
              <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{formatNumber(m.reach)} views</span>
            </div>
          ))}
        </div>

        {/* Bottom 3 */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={18} color="var(--accent-danger)" /> Needs Attention
          </h3>
          {stats.bottomModels.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No data yet</p>}
          {stats.bottomModels.map((m, i) => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: i < 2 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
              <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{formatNumber(m.reach)} views</span>
            </div>
          ))}
        </div>

        {/* Flagged */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--accent-warning)" /> Flagged Accounts
          </h3>
          {stats.flagged.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>All clear</p>}
          {stats.flagged.slice(0, 5).map(a => {
            const hc = healthColor(a.health)
            return (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>@{a.handle}</span>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{a.platform}</span>
                  {a.account_type && a.account_type !== 'Primary' && <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>({a.account_type})</span>}
                </div>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                  {a.health}
                </span>
              </div>
            )
          })}
          {stats.flagged.length > 5 && (
            <Link to="/alerts" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8rem' }}>
              View all {stats.flagged.length} flagged accounts →
            </Link>
          )}
        </div>
      </div>

      {/* Missing data warning */}
      {stats.missingData.length > 0 && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <p style={{ color: 'var(--accent-warning)', fontSize: '0.875rem', fontWeight: 600 }}>
            {stats.missingData.length} active account(s) have no snapshot data in the last 7 days.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {stats.missingData.slice(0, 5).map(a => `@${a.handle}`).join(', ')}
            {stats.missingData.length > 5 && ` and ${stats.missingData.length - 5} more`}
          </p>
        </div>
      )}
    </div>
  )
}
