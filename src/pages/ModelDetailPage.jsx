import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Globe } from 'lucide-react'
import { getModel, getAccounts, getSnapshotHistory, getOFTracking } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, vtfrGrade, erGrade } from '../lib/metrics'
import { getDisplayHandle } from '../lib/accountDisplay'
import { fillDailySeries } from '../lib/timeSeries'
import { TrendChart, AreaTrendChart, COLORS } from '../components/charts/TrendChart'
import Sparkline from '../components/charts/Sparkline'
import HeatmapGrid, { vtfrColorScale, viewsColorScale } from '../components/charts/HeatmapGrid'

export default function ModelDetailPage() {
  const { id } = useParams()
  const [model, setModel] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [ofTracking, setOfTracking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getModel(id),
      getAccounts({ model_id: id }),
    ]).then(([m, accs]) => {
      setModel(m)
      setAccounts(accs)
      if (accs.length > 0) {
        Promise.all([
          getSnapshotHistory(accs.map(a => a.id), 90),
          getOFTracking(90),
        ]).then(([snapshotData, ofData]) => {
          setSnapshots(snapshotData || [])
          setOfTracking((ofData || []).filter(row => row.model_id === id))
        })
      }
    }).finally(() => setLoading(false))
  }, [id])

  // Aggregate stats
  const latestByAccount = useMemo(() => {
    const map = {}
    for (const s of snapshots) {
      if (!map[s.account_id] || s.snapshot_date > map[s.account_id].snapshot_date) {
        map[s.account_id] = s
      }
    }
    return map
  }, [snapshots])

  const latestArr = Object.values(latestByAccount)
  const totalReach = latestArr.reduce((sum, s) => sum + getSnapshotViews(s), 0)
  const totalClicks = latestArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)
  const totalPosts = latestArr.reduce((sum, s) => {
    return sum + (s.ig_reels_posted_7d || 0) + (s.ig_stories_posted_7d || 0)
      + (s.tw_tweets_posted_7d || 0) + (s.rd_posts_7d || 0) + (s.tt_videos_posted_7d || 0)
  }, 0)

  const latestOFByAccount = useMemo(() => {
    const map = {}
    for (const row of ofTracking) {
      if (!row.account_id) continue
      if (!map[row.account_id] || row.snapshot_date > map[row.account_id].snapshot_date) {
        map[row.account_id] = row
      }
    }
    return map
  }, [ofTracking])

  const latestOFArr = Object.values(latestOFByAccount)
  const totalOFClicks = latestOFArr.reduce((sum, row) => sum + (row.clicks || 0), 0)
  const totalOFSubs = latestOFArr.reduce((sum, row) => sum + (row.subscribers || 0), 0)
  const totalOFRevenue = latestOFArr.reduce((sum, row) => sum + Number(row.revenue_total || 0), 0)

  const ofAccountRanking = useMemo(() => {
    return accounts.map(account => {
      const of = latestOFByAccount[account.id] || null
      const clicks = of?.clicks || 0
      const subscribers = of?.subscribers || 0
      const revenue = Number(of?.revenue_total || 0)
      return {
        account,
        of,
        clicks,
        subscribers,
        revenue,
        cvr: clicks > 0 ? (subscribers / clicks) * 100 : 0,
        shareOfSubs: totalOFSubs > 0 ? (subscribers / totalOFSubs) * 100 : 0,
        shareOfClicks: totalOFClicks > 0 ? (clicks / totalOFClicks) * 100 : 0,
      }
    }).sort((a, b) => b.subscribers - a.subscribers || b.clicks - a.clicks)
  }, [accounts, latestOFByAccount, totalOFClicks, totalOFSubs])

  // Per-platform combined stats (for platforms with multiple accounts)
  const platformStats = useMemo(() => {
    const result = {}
    for (const platform of ['twitter', 'reddit', 'instagram', 'tiktok']) {
      const platAccounts = accounts.filter(a => a.platform === platform)
      if (!platAccounts.length) continue
      const platSnaps = platAccounts.map(a => latestByAccount[a.id]).filter(Boolean)
      result[platform] = {
        accounts: platAccounts,
        followers: platSnaps.reduce((sum, s) => sum + (s.followers || 0), 0),
        views7d: platSnaps.reduce((sum, s) => sum + getSnapshotViews(s), 0),
        likes7d: platSnaps.reduce((sum, s) => sum + (s.tt_likes_7d || s.tw_likes_7d || 0), 0),
        perAccount: platAccounts.map(a => ({
          account: a,
          snap: latestByAccount[a.id] || null,
        })),
      }
    }
    return result
  }, [accounts, latestByAccount])

  // Build trend chart data: aggregate by date
  const trendData = useMemo(() => {
    const dateMap = {}
    for (const s of snapshots) {
      if (!dateMap[s.snapshot_date]) {
        dateMap[s.snapshot_date] = { date: s.snapshot_date, followers: 0, views: 0, clicks: 0 }
      }
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
  }, [snapshots])

  // Per-account sparkline data
  const accountSparklines = useMemo(() => {
    const byAccount = {}
    for (const s of snapshots) {
      if (!byAccount[s.account_id]) byAccount[s.account_id] = []
      byAccount[s.account_id].push(s)
    }
    const result = {}
    for (const [aid, snaps] of Object.entries(byAccount)) {
      const sorted = snaps.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      result[aid] = {
        followers: sorted.map(s => s.followers || 0),
        views: sorted.map(s => getSnapshotViews(s)),
        vtfr: sorted.map(s => s.vtfr_weekly || 0),
      }
    }
    return result
  }, [snapshots])

  // Weekly heatmap: accounts × weeks
  const weeklyHeatmap = useMemo(() => {
    if (!snapshots.length) return { rows: [], columns: [] }

    const weekSet = new Set()
    for (const s of snapshots) {
      const d = new Date(s.snapshot_date)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      weekSet.add(weekStart.toISOString().split('T')[0])
    }
    const weeks = Array.from(weekSet).sort()
    const columns = weeks.map(w => {
      const d = new Date(w)
      return `${d.getMonth() + 1}/${d.getDate()}`
    })

    const accountWeekViews = {}
    for (const s of snapshots) {
      const handle = s.account?.handle || s.account_id
      const d = new Date(s.snapshot_date)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!accountWeekViews[handle]) accountWeekViews[handle] = {}
      if (!accountWeekViews[handle][weekKey]) accountWeekViews[handle][weekKey] = 0
      accountWeekViews[handle][weekKey] += getSnapshotViews(s)
    }

    const rows = Object.entries(accountWeekViews).map(([label, weekData]) => ({
      label: `@${label}`,
      cells: weeks.map(w => ({ value: weekData[w] || null }))
    }))

    return { rows, columns }
  }, [snapshots])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>
  if (!model) return <div className="flex-center" style={{ height: '60vh' }}><p style={{ color: 'var(--text-tertiary)' }}>Model not found</p></div>

  return (
    <div className="dashboard-container">
      <Link to="/models" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Models
      </Link>

      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">{model.display_name || model.name}</h1>
          <p style={{ textTransform: 'capitalize' }}>Status: {model.status} {model.of_username && `· OF: @${model.of_username}`}</p>
        </div>
        <Link to="/data-entry" className="btn btn-primary">
          <Plus size={16} /> Enter Data
        </Link>
      </div>

      {/* Aggregated stats */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">Total Accounts</p>
            <h3 className="metric-value">{accounts.length}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">Total Reach (7d)</p>
            <h3 className="metric-value">{formatNumber(totalReach)}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">Total Clicks (7d)</p>
            <h3 className="metric-value">{formatNumber(totalClicks)}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">Content Volume (7d)</p>
            <h3 className="metric-value">{totalPosts}</h3>
          </div>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">OF Clicks (Latest)</p>
            <h3 className="metric-value">{formatNumber(totalOFClicks)}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">OF Subs (Latest)</p>
            <h3 className="metric-value">{formatNumber(totalOFSubs)}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">OF Conversion</p>
            <h3 className="metric-value">{totalOFClicks ? `${((totalOFSubs / totalOFClicks) * 100).toFixed(1)}%` : '—'}</h3>
          </div>
        </div>
        <div className="metric-card glass-panel">
          <div className="metric-data">
            <p className="metric-label">OF Revenue</p>
            <h3 className="metric-value">${formatNumber(totalOFRevenue)}</h3>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>OF Performance by Account</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '980px' }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Platform</th>
                <th>OF Link</th>
                <th className="numeric">Clicks</th>
                <th className="numeric">Subs</th>
                <th className="numeric">CVR</th>
                <th className="numeric">Revenue</th>
                <th className="numeric">Share of Subs</th>
              </tr>
            </thead>
            <tbody>
              {ofAccountRanking.map(({ account, of, clicks, subscribers, cvr, revenue, shareOfSubs }) => (
                <tr key={account.id}>
                  <td><strong style={{ color: 'var(--text-primary)' }}>@{getDisplayHandle(account)}</strong></td>
                  <td style={{ textTransform: 'capitalize' }}>{account.platform}</td>
                  <td style={{ fontSize: '0.8rem', color: of ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{of?.tracking_link_name || '—'}</td>
                  <td className="numeric">{formatNumber(clicks)}</td>
                  <td className="numeric font-semibold">{formatNumber(subscribers)}</td>
                  <td className="numeric">{clicks ? `${cvr.toFixed(1)}%` : '—'}</td>
                  <td className="numeric">${formatNumber(revenue)}</td>
                  <td className="numeric">{subscribers ? `${shareOfSubs.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-platform combined stats (shown for any platform with accounts) */}
      {Object.entries(platformStats).map(([platform, pStats]) => (
        <div key={platform} className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'capitalize' }}>
            {platform === 'twitter' ? 'Twitter / X' : platform} — Combined Stats
          </h3>

          {/* Totals row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="metric-card glass-panel" style={{ padding: '0.75rem 1rem' }}>
              <div className="metric-data">
                <p className="metric-label">Total Followers</p>
                <h3 className="metric-value" style={{ fontSize: '1.4rem' }}>{formatNumber(pStats.followers)}</h3>
                <span className="metric-text">{pStats.accounts.length} accounts</span>
              </div>
            </div>
            <div className="metric-card glass-panel" style={{ padding: '0.75rem 1rem' }}>
              <div className="metric-data">
                <p className="metric-label">Total Views (7d)</p>
                <h3 className="metric-value" style={{ fontSize: '1.4rem' }}>{formatNumber(pStats.views7d)}</h3>
              </div>
            </div>
            <div className="metric-card glass-panel" style={{ padding: '0.75rem 1rem' }}>
              <div className="metric-data">
                <p className="metric-label">Total Likes (7d)</p>
                <h3 className="metric-value" style={{ fontSize: '1.4rem' }}>{formatNumber(pStats.likes7d)}</h3>
              </div>
            </div>
          </div>

          {/* Per-account breakdown */}
          <table className="accounts-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Account</th>
                <th style={{ textAlign: 'left' }}>Type</th>
                <th style={{ textAlign: 'right' }}>Followers</th>
                <th style={{ textAlign: 'right' }}>Views 7d</th>
                <th style={{ textAlign: 'right' }}>Likes 7d</th>
                <th style={{ textAlign: 'left' }}>Health</th>
              </tr>
            </thead>
            <tbody>
              {pStats.perAccount.map(({ account, snap }) => {
                const hc = healthColor(account.health)
                return (
                  <tr key={account.id}>
                    <td style={{ fontWeight: 600 }}>@{getDisplayHandle(account)}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{account.account_type}</td>
                    <td style={{ textAlign: 'right' }}>{snap ? formatNumber(snap.followers || 0) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{snap ? formatNumber(getSnapshotViews(snap)) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{snap ? formatNumber(snap.tt_likes_7d || snap.tw_likes_7d || 0) : '—'}</td>
                    <td>
                      <span style={{ padding: '0.15rem 0.45rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                        {account.health}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Trend Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Follower Growth</h3>
          <AreaTrendChart data={trendData} dataKey="followers" label="Followers" color={COLORS.success} height={220} />
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Views & Clicks</h3>
          <TrendChart
            data={trendData}
            lines={[
              { key: 'views', label: 'Views', color: COLORS.primary },
              { key: 'clicks', label: 'Clicks', color: COLORS.warning },
            ]}
            height={220}
          />
        </div>
      </div>

      {/* Weekly heatmap */}
      {weeklyHeatmap.rows.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <HeatmapGrid
            title="Weekly Views by Account"
            rows={weeklyHeatmap.rows}
            columns={weeklyHeatmap.columns}
            colorScale={viewsColorScale}
            valueFormatter={formatNumber}
          />
        </div>
      )}

      {/* Account cards with sparklines */}
      <h2 style={{ marginTop: '0.5rem' }}>Accounts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {accounts.map(account => {
          const hc = healthColor(account.health)
          const snap = latestByAccount[account.id]
          const spark = accountSparklines[account.id]
          return (
            <div key={account.id} className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>@{getDisplayHandle(account)}</span>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{account.platform}</span>
                  {account.account_type && <span style={{ marginLeft: '0.4rem', padding: '0.1rem 0.4rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>{account.account_type}</span>}
                </div>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                  {account.health}
                </span>
              </div>
              {snap && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Followers</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatNumber(snap.followers)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Views 7d</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatNumber(getSnapshotViews(snap))}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>VTFR</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {snap.vtfr_weekly ? snap.vtfr_weekly.toFixed(1) + '%' : '—'}
                    </p>
                  </div>
                </div>
              )}
              {spark && (
                <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Followers</p>
                    <Sparkline data={spark.followers} width={70} height={24} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Views</p>
                    <Sparkline data={spark.views} width={70} height={24} color="#f59e0b" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>VTFR</p>
                    <Sparkline data={spark.vtfr} width={70} height={24} color="#6366f1" />
                  </div>
                </div>
              )}
              {!snap && !spark && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No snapshot data yet</p>
              )}
            </div>
          )
        })}
      </div>

      {accounts.length === 0 && (
        <div className="glass-panel flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem' }}>
          <Globe size={48} color="var(--text-tertiary)" />
          <p style={{ color: 'var(--text-tertiary)' }}>No accounts for this model yet.</p>
          <Link to="/accounts" className="btn btn-primary"><Plus size={16} /> Add Account</Link>
        </div>
      )}

      {model.notes && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginTop: '0.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Notes</h4>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{model.notes}</p>
        </div>
      )}
    </div>
  )
}
