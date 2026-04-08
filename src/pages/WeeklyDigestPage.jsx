import { useState, useEffect, useMemo } from 'react'
import { Download, Printer, Calendar, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { getAccounts, getAllSnapshotHistory, getLatestSnapshots } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, vtfrGrade, erGrade, exportToCSV } from '../lib/metrics'
import { fillDailySeries } from '../lib/timeSeries'
import { TrendChart, COLORS } from '../components/charts/TrendChart'

export default function WeeklyDigestPage() {
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [latest, setLatest] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week, etc.

  useEffect(() => {
    Promise.all([getAccounts(), getAllSnapshotHistory(60), getLatestSnapshots()])
      .then(([accs, snaps, lat]) => { setAccounts(accs); setSnapshots(snaps); setLatest(lat) })
      .finally(() => setLoading(false))
  }, [])

  const weekRange = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7))
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0],
      label: `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
  }, [weekOffset])

  const prevWeekRange = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + ((weekOffset - 1) * 7))
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    return { start: startOfWeek.toISOString().split('T')[0], end: endOfWeek.toISOString().split('T')[0] }
  }, [weekOffset])

  const digest = useMemo(() => {
    // Snapshots for this week and previous week
    const thisWeekSnaps = snapshots.filter(s => s.snapshot_date >= weekRange.start && s.snapshot_date <= weekRange.end)
    const prevWeekSnaps = snapshots.filter(s => s.snapshot_date >= prevWeekRange.start && s.snapshot_date <= prevWeekRange.end)

    // Build latest per account for both weeks
    const latestThis = {}, latestPrev = {}
    for (const s of thisWeekSnaps) {
      if (!latestThis[s.account_id] || s.snapshot_date > latestThis[s.account_id].snapshot_date)
        latestThis[s.account_id] = s
    }
    for (const s of prevWeekSnaps) {
      if (!latestPrev[s.account_id] || s.snapshot_date > latestPrev[s.account_id].snapshot_date)
        latestPrev[s.account_id] = s
    }

    const thisArr = Object.values(latestThis)
    const prevArr = Object.values(latestPrev)

    // Totals
    const totalFollowers = thisArr.reduce((s, sn) => s + (sn.followers || 0), 0)
    const prevFollowers = prevArr.reduce((s, sn) => s + (sn.followers || 0), 0)
    const totalViews = thisArr.reduce((s, sn) => s + getSnapshotViews(sn), 0)
    const prevViews = prevArr.reduce((s, sn) => s + getSnapshotViews(sn), 0)
    const totalClicks = thisArr.reduce((s, sn) => s + getSnapshotClicks(sn), 0)
    const prevClicks = prevArr.reduce((s, sn) => s + getSnapshotClicks(sn), 0)

    const pctChange = (cur, prev) => prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0)

    // Model breakdown
    const modelMap = {}
    for (const s of thisArr) {
      const modelName = s.account?.model?.name || 'Unknown'
      if (!modelMap[modelName]) modelMap[modelName] = { views: 0, clicks: 0, followers: 0, accounts: 0 }
      modelMap[modelName].views += getSnapshotViews(s)
      modelMap[modelName].clicks += getSnapshotClicks(s)
      modelMap[modelName].followers += s.followers || 0
      modelMap[modelName].accounts++
    }
    const modelBreakdown = Object.entries(modelMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.views - a.views)

    // Top performers
    const accountPerformance = thisArr.map(s => {
      const prevSnap = latestPrev[s.account_id]
      const views = getSnapshotViews(s)
      const prevViewsAcc = prevSnap ? getSnapshotViews(prevSnap) : 0
      return {
        handle: s.account?.handle || '?',
        platform: s.account?.platform || '?',
        model: s.account?.model?.name || '?',
        followers: s.followers || 0,
        views,
        viewsChange: pctChange(views, prevViewsAcc),
        vtfr: s.vtfr_weekly || 0,
        er: s.engagement_rate_weekly || 0,
      }
    }).sort((a, b) => b.views - a.views)

    // Health issues
    const healthIssues = accounts.filter(a => a.health !== 'Clean')
    const missingData = accounts.filter(a => a.status === 'Active' && !latestThis[a.id])

    return {
      totalFollowers, prevFollowers,
      totalViews, prevViews,
      totalClicks, prevClicks,
      followerChange: pctChange(totalFollowers, prevFollowers),
      viewsChange: pctChange(totalViews, prevViews),
      clicksChange: pctChange(totalClicks, prevClicks),
      modelBreakdown,
      topPerformers: accountPerformance.slice(0, 10),
      bottomPerformers: accountPerformance.slice(-5).reverse(),
      healthIssues,
      missingData,
      accountsReported: thisArr.length,
      totalAccounts: accounts.filter(a => a.status === 'Active').length,
    }
  }, [accounts, snapshots, weekRange, prevWeekRange])

  // Daily trend for chart
  const dailyTrend = useMemo(() => {
    const dateMap = {}
    for (const s of snapshots) {
      if (s.snapshot_date < weekRange.start || s.snapshot_date > weekRange.end) continue
      if (!dateMap[s.snapshot_date]) dateMap[s.snapshot_date] = { date: s.snapshot_date, views: 0, clicks: 0 }
      dateMap[s.snapshot_date].views += getSnapshotViews(s)
      dateMap[s.snapshot_date].clicks += getSnapshotClicks(s)
    }
    return fillDailySeries(
      Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
      {
        keys: ['views', 'clicks'],
        startDate: weekRange.start,
        endDate: weekRange.end,
        treatAllZeroRowAsMissing: true,
      }
    )
  }, [snapshots, weekRange])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container" id="weekly-digest">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Weekly Digest</h1>
          <p>{weekRange.label}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setWeekOffset(w => w - 1)}>&larr; Prev</button>
          <button className="btn btn-secondary" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>This Week</button>
          <button className="btn btn-secondary" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>&rarr; Next</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const rows = digest.topPerformers.map(a => ({
              handle: a.handle, platform: a.platform, model: a.model,
              followers: a.followers, views: a.views, vtfr: a.vtfr.toFixed(1), er: a.er.toFixed(2)
            }))
            exportToCSV(rows, `digest-${weekRange.start}.csv`)
          }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KPICard label="Total Followers" value={formatNumber(digest.totalFollowers)} change={digest.followerChange} />
        <KPICard label="Total Views (7d)" value={formatNumber(digest.totalViews)} change={digest.viewsChange} />
        <KPICard label="Total Clicks (7d)" value={formatNumber(digest.totalClicks)} change={digest.clicksChange} />
        <KPICard label="Data Coverage" value={`${digest.accountsReported}/${digest.totalAccounts}`} subtitle="accounts reported" />
      </div>

      {/* Trend chart */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Daily Views & Clicks</h3>
        <TrendChart
          data={dailyTrend}
          lines={[
            { key: 'views', label: 'Views', color: COLORS.primary },
            { key: 'clicks', label: 'Clicks', color: COLORS.warning },
          ]}
          height={220}
        />
      </div>

      {/* Model Breakdown */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Model Breakdown</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="numeric">Accounts</th>
                <th className="numeric">Followers</th>
                <th className="numeric">Views</th>
                <th className="numeric">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {digest.modelBreakdown.map(m => (
                <tr key={m.name}>
                  <td><strong style={{ color: 'var(--text-primary)' }}>{m.name}</strong></td>
                  <td className="numeric">{m.accounts}</td>
                  <td className="numeric">{formatNumber(m.followers)}</td>
                  <td className="numeric font-semibold">{formatNumber(m.views)}</td>
                  <td className="numeric">{formatNumber(m.clicks)}</td>
                </tr>
              ))}
              {digest.modelBreakdown.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No data for this week</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Top Performers */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="var(--accent-success)" /> Top Performers
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {digest.topPerformers.slice(0, 5).map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginRight: '0.5rem' }}>#{i + 1}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>@{a.handle}</strong>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{a.model}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatNumber(a.views)}</span>
                  <WoWBadge change={a.viewsChange} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues Summary */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--accent-warning)" /> Issues
          </h3>
          {digest.healthIssues.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Health Issues ({digest.healthIssues.length})</p>
              {digest.healthIssues.slice(0, 5).map(a => {
                const hc = healthColor(a.health)
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>@{a.handle}</span>
                    <span style={{ color: hc.color, fontWeight: 600 }}>{a.health}</span>
                  </div>
                )
              })}
            </div>
          )}
          {digest.missingData.length > 0 && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Missing Data ({digest.missingData.length})</p>
              {digest.missingData.slice(0, 5).map(a => (
                <div key={a.id} style={{ padding: '0.3rem 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  @{a.handle} ({a.platform})
                </div>
              ))}
              {digest.missingData.length > 5 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>+{digest.missingData.length - 5} more</p>
              )}
            </div>
          )}
          {digest.healthIssues.length === 0 && digest.missingData.length === 0 && (
            <p style={{ color: 'var(--accent-success)', fontWeight: 600 }}>No issues this week</p>
          )}
        </div>
      </div>

      {/* Full rankings table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.25rem 0' }}>
          <h3 style={{ fontSize: '0.95rem' }}>Full Account Rankings</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Handle</th>
                <th>Model</th>
                <th>Platform</th>
                <th className="numeric">Followers</th>
                <th className="numeric">Views</th>
                <th className="numeric">WoW</th>
                <th className="numeric">VTFR</th>
                <th className="numeric">ER</th>
              </tr>
            </thead>
            <tbody>
              {digest.topPerformers.map((a, i) => {
                const vg = vtfrGrade(a.vtfr)
                const eg = erGrade(a.er)
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                    <td>{a.model}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.platform}</td>
                    <td className="numeric">{formatNumber(a.followers)}</td>
                    <td className="numeric font-semibold">{formatNumber(a.views)}</td>
                    <td className="numeric"><WoWBadge change={a.viewsChange} /></td>
                    <td className="numeric">
                      {a.vtfr > 0 ? (
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: vg.color, background: vg.bg }}>
                          {a.vtfr.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="numeric">
                      {a.er > 0 ? (
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: eg.color, background: eg.bg }}>
                          {a.er.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
              {digest.topPerformers.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No data for this week</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, change, subtitle }) {
  return (
    <div className="metric-card glass-panel">
      <div className="metric-data">
        <p className="metric-label">{label}</p>
        <h3 className="metric-value">{value}</h3>
        {change != null && <WoWBadge change={change} />}
        {subtitle && <span className="metric-text">{subtitle}</span>}
      </div>
    </div>
  )
}

function WoWBadge({ change }) {
  if (change == null) return null
  const isPositive = change >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.4rem',
      color: isPositive ? '#10b981' : '#ef4444',
    }}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{change.toFixed(1)}%
    </span>
  )
}
