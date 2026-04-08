import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Users, MousePointerClick, AlertTriangle, TrendingUp, TrendingDown, ChevronRight, Download, BarChart3 } from 'lucide-react'
import { getExecOverview, getAllSnapshotHistory, getLinkMappings } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, exportToCSV } from '../lib/metrics'
import { getDisplayHandle } from '../lib/accountDisplay'
import { fillDailySeries } from '../lib/timeSeries'
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

  // Per-model, per-platform follower totals for the summary table
  const modelPlatformTable = useMemo(() => {
    if (!data) return []
    const { models, accounts, snapshots: snaps, ofTracking = [] } = data
    // Build latest snapshot per account
    const latestSnap = {}
    for (const s of snaps) {
      if (!latestSnap[s.account_id] || s.snapshot_date > latestSnap[s.account_id].snapshot_date) {
        latestSnap[s.account_id] = s
      }
    }
    // Build OF subs per model (sum latest subscribers across all tracking links)
    const ofSubsByModel = {}
    const ofLatestByLink = {}
    for (const t of ofTracking) {
      const key = `${t.model_id}::${t.tracking_link_name}`
      if (!ofLatestByLink[key] || t.snapshot_date > ofLatestByLink[key].snapshot_date) {
        ofLatestByLink[key] = t
      }
    }
    for (const t of Object.values(ofLatestByLink)) {
      if (!ofSubsByModel[t.model_id]) ofSubsByModel[t.model_id] = { subscribers: 0, clicks: 0, revenue: 0, links: 0 }
      ofSubsByModel[t.model_id].subscribers += t.subscribers || 0
      ofSubsByModel[t.model_id].clicks += t.clicks || 0
      ofSubsByModel[t.model_id].revenue += parseFloat(t.revenue_total) || 0
      ofSubsByModel[t.model_id].links++
    }

    return models
      .sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name))
      .map(model => {
        const modelAccounts = accounts.filter(a => a.model_id === model.id)
        const row = { id: model.id, name: model.display_name || model.name, of_username: model.of_username }
        for (const p of ['twitter', 'reddit', 'instagram', 'tiktok']) {
          const platAccts = modelAccounts.filter(a => a.platform === p)
          if (!platAccts.length) { row[p] = null; continue }
          let totalFollowers = 0
          let hasData = false
          for (const acc of platAccts) {
            const snap = latestSnap[acc.id]
            if (snap) {
              const val = p === 'reddit' ? (snap.rd_karma_total || 0) : (snap.followers || 0)
              totalFollowers += val
              hasData = true
            }
          }
          // For display purposes, we pass the aggregated value under 'mainMetric'
          row[p] = { accounts: platAccts.length, mainMetric: hasData ? totalFollowers : null }
        }
        // OF subs: prefer of_tracking aggregation, fall back to model.of_subs
        const trackingData = ofSubsByModel[model.id] || null
        const modelSubs = typeof model.of_subs === 'number' && model.of_subs > 0 ? model.of_subs : null
        if (trackingData && trackingData.subscribers > 0) {
          row.of = trackingData
        } else if (modelSubs) {
          row.of = { subscribers: modelSubs, clicks: 0, revenue: 0, links: 0 }
        } else {
          row.of = null
        }
        return row
      })
  }, [data])

  const stats = useMemo(() => {
    if (!data) return null

    const { models, accounts, snapshots, ofTracking = [] } = data
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

    const totalFollowers = latestArr.reduce((sum, s) => sum + (s.followers || 0), 0)
    const prevTotalFollowers = prevArr.reduce((sum, s) => sum + (s.followers || 0), 0)
    const totalClicks = latestArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)
    const prevClicks = prevArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)

    const followersTrend = prevTotalFollowers ? ((totalFollowers - prevTotalFollowers) / prevTotalFollowers * 100).toFixed(1) : null
    const clicksTrend = prevClicks ? ((totalClicks - prevClicks) / prevClicks * 100).toFixed(1) : null

    // Per-platform followers and views (total from latest snapshots)
    const getPlatformMainMetric = (platform, snapshot) => {
      if (!snapshot) return 0
      if (platform === 'reddit') return snapshot.rd_karma_total || 0
      return snapshot.followers || 0
    }

    const platformFollowers = {}
    for (const p of ['twitter', 'reddit', 'instagram', 'tiktok']) {
      const platAccountIds = new Set(accounts.filter(a => a.platform === p).map(a => a.id))
      const platLatest = latestArr.filter(s => platAccountIds.has(s.account_id))
      const platPrev = prevArr.filter(s => platAccountIds.has(s.account_id))
      const followers = platLatest.reduce((sum, s) => sum + getPlatformMainMetric(p, s), 0)
      const prevFollowers = platPrev.reduce((sum, s) => sum + getPlatformMainMetric(p, s), 0)
      const views = platLatest.reduce((sum, s) => sum + (getSnapshotViews(s) || 0), 0)
      platformFollowers[p] = {
        followers,
        views: views || null,
        trend: prevFollowers ? ((followers - prevFollowers) / prevFollowers * 100).toFixed(1) : null,
      }
    }

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

    const latestOFByAccount = {}
    for (const row of ofTracking) {
      if (!row.account_id) continue
      if (!latestOFByAccount[row.account_id] || row.snapshot_date > latestOFByAccount[row.account_id].snapshot_date) {
        latestOFByAccount[row.account_id] = row
      }
    }
    const latestOFArr = Object.values(latestOFByAccount)
    const totalOFClicks = latestOFArr.reduce((sum, row) => sum + (row.clicks || 0), 0)
    const totalOFSubs = latestOFArr.reduce((sum, row) => sum + (row.subscribers || 0), 0)
    const totalOFRevenue = latestOFArr.reduce((sum, row) => sum + Number(row.revenue_total || 0), 0)
    const topOFDrivers = latestOFArr
      .map(row => ({
        handle: row.account?.handle || row.account_id,
        model: row.account?.model?.display_name || row.account?.model?.name || 'Unknown',
        platform: row.account?.platform || 'unknown',
        linkName: row.tracking_link_name,
        clicks: row.clicks || 0,
        subscribers: row.subscribers || 0,
        revenue: Number(row.revenue_total || 0),
        cvr: (row.clicks || 0) > 0 ? ((row.subscribers || 0) / row.clicks) * 100 : 0,
      }))
      .sort((a, b) => b.subscribers - a.subscribers || b.clicks - a.clicks)

    return {
      activeModels: models.length,
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      platformCounts,
      totalFollowers,
      totalClicks,
      followersTrend,
      clicksTrend,
      topModels: modelRanking.slice(0, 3),
      bottomModels: modelRanking.slice(-3).reverse(),
      flagged,
      missingData,
      latestSnapshots: latestArr,
      modelRanking,
      platformFollowers,
      totalOFClicks,
      totalOFSubs,
      totalOFRevenue,
      topOFDrivers: topOFDrivers.slice(0, 8),
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
    return fillDailySeries(
      Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
      {
        keys: ['followers', 'views', 'clicks'],
        treatAllZeroRowAsMissing: true,
      }
    )
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
          icon={Users} iconClass="views"
          label="Total Followers"
          value={formatNumber(stats.totalFollowers)}
          trend={stats.followersTrend}
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

      <div className="metrics-grid">
        <MetricCard icon={MousePointerClick} iconClass="engagement" label="OF Clicks" value={formatNumber(stats.totalOFClicks)} />
        <MetricCard icon={Users} iconClass="followers" label="OF Subscribers" value={formatNumber(stats.totalOFSubs)} />
        <MetricCard icon={BarChart3} iconClass="views" label="OF Revenue" value={`$${formatNumber(stats.totalOFRevenue)}`} />
        <MetricCard
          icon={TrendingUp}
          iconClass="winners"
          label="OF Conversion"
          value={stats.totalOFClicks ? `${((stats.totalOFSubs / stats.totalOFClicks) * 100).toFixed(1)}%` : '—'}
        />
      </div>

      {/* Per-platform followers */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { key: 'twitter', label: 'Twitter / X' },
          { key: 'reddit', label: 'Reddit' },
          { key: 'instagram', label: 'Instagram' },
          { key: 'tiktok', label: 'TikTok' },
        ].map(p => {
          const pf = stats.platformFollowers[p.key] || {}
          return (
            <Link to={`/platforms/${p.key}`} key={p.key} className="metric-card glass-panel" style={{ textDecoration: 'none', cursor: 'pointer' }}>
              <div className="metric-data">
                <p className="metric-label">{p.label}</p>
                <h3 className="metric-value">{formatNumber(pf.followers || 0)}</h3>
                {pf.views && (
                  <span className="metric-text" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {formatNumber(pf.views)} views (7d)
                  </span>
                )}
                <span className="metric-text">{stats.platformCounts[p.key] || 0} accounts</span>
                {pf.trend != null && (
                  <span className={`metric-trend ${Number(pf.trend) >= 0 ? 'positive' : 'negative'}`}>
                    {Number(pf.trend) >= 0 ? '+' : ''}{pf.trend}% vs last week
                  </span>
                )}
              </div>
              <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
            </Link>
          )
        })}
      </div>

      {/* Model × Platform Table */}
      {modelPlatformTable.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem 0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem' }}>Model Overview</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="accounts-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: '160px' }}>Creator</th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>𝕏</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>Twitter</span>
                    </div>
                  </th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>R</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>Reddit</span>
                    </div>
                  </th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>IG</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>Instagram</span>
                    </div>
                  </th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>TT</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>TikTok</span>
                    </div>
                  </th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>OF</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>Subs</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelPlatformTable.map(row => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/models/${row.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{row.name}</span>
                        {row.of_username && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>@{row.of_username}</span>}
                      </Link>
                    </td>
                    {['twitter', 'reddit', 'instagram', 'tiktok'].map(p => (
                      <td key={p} style={{ textAlign: 'center' }}>
                        {row[p] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }} title={p === 'reddit' ? 'Total Karma' : 'Total Followers'}>
                              {row[p].mainMetric != null ? formatNumber(row[p].mainMetric) : '—'}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                              {row[p].accounts} acct{row[p].accounts !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      {row.of ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {formatNumber(row.of.subscribers)}
                          </span>
                          {row.of.links > 0 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                              {row.of.links} link{row.of.links !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend Charts */}
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

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Top OF Traffic Drivers</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Model</th>
                <th>Platform</th>
                <th>OF Link</th>
                <th className="numeric">Clicks</th>
                <th className="numeric">Subs</th>
                <th className="numeric">CVR</th>
                <th className="numeric">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.topOFDrivers.length > 0 ? stats.topOFDrivers.map(driver => (
                <tr key={`${driver.handle}-${driver.linkName}`}>
                  <td><strong style={{ color: 'var(--text-primary)' }}>@{getDisplayHandle(driver.handle, driver.platform)}</strong></td>
                  <td>{driver.model}</td>
                  <td style={{ textTransform: 'capitalize' }}>{driver.platform}</td>
                  <td style={{ fontSize: '0.8rem' }}>{driver.linkName || '—'}</td>
                  <td className="numeric">{formatNumber(driver.clicks)}</td>
                  <td className="numeric font-semibold">{formatNumber(driver.subscribers)}</td>
                  <td className="numeric">{driver.clicks ? `${driver.cvr.toFixed(1)}%` : '—'}</td>
                  <td className="numeric">${formatNumber(driver.revenue)}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No OF tracking data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>@{getDisplayHandle(a)}</span>
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
            {stats.missingData.slice(0, 5).map(a => `@${getDisplayHandle(a)}`).join(', ')}
            {stats.missingData.length > 5 && ` and ${stats.missingData.length - 5} more`}
          </p>
        </div>
      )}
    </div>
  )
}
