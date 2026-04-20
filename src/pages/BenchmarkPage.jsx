import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { getAccounts, getAllSnapshotHistory } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, vtfrGrade, erGrade, exportToCSV } from '../lib/metrics'
import BarChartComponent from '../components/charts/BarChart'
import HeatmapGrid from '../components/charts/HeatmapGrid'
import { viewsColorScale } from '../components/charts/heatmapScales'
import { COLORS } from '../components/charts/TrendChart'
import Sparkline from '../components/charts/Sparkline'

const PLATFORM_LABELS = { twitter: 'Twitter / X', reddit: 'Reddit', instagram: 'Instagram', tiktok: 'TikTok' }
const REDDIT_PLATFORM = 'reddit'

export default function BenchmarkPage() {
  const { platform: urlPlatform } = useParams()
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [timeRange, setTimeRange] = useState(30)
  const [referenceTime] = useState(() => Date.now())
  const filterPlatform = urlPlatform || platformFilter

  useEffect(() => {
    Promise.all([getAccounts(), getAllSnapshotHistory(90)])
      .then(([accs, snaps]) => {
        setAccounts(accs)
        setSnapshots(snaps)
      })
      .finally(() => setLoading(false))
  }, [])

  const isRedditBenchmark = filterPlatform === REDDIT_PLATFORM

  const benchmark = useMemo(() => {
    let filteredAccounts = accounts
    if (filterPlatform) filteredAccounts = filteredAccounts.filter(account => account.platform === filterPlatform)
    if (filterModel) filteredAccounts = filteredAccounts.filter(account => account.model_id === filterModel)

    const cutoff = new Date(referenceTime - timeRange * 86400000).toISOString().split('T')[0]
    const relevantSnapshots = snapshots.filter(snapshot => snapshot.snapshot_date >= cutoff)

    const snapshotsByAccount = {}
    for (const snapshot of relevantSnapshots) {
      if (!snapshotsByAccount[snapshot.account_id]) snapshotsByAccount[snapshot.account_id] = []
      snapshotsByAccount[snapshot.account_id].push(snapshot)
    }

    const rows = filteredAccounts.map(account => {
      const accountSnapshots = (snapshotsByAccount[account.id] || []).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      const latest = accountSnapshots[accountSnapshots.length - 1]
      const oldest = accountSnapshots[0]

      const followers = latest?.followers || 0
      const previousFollowers = oldest?.followers || 0
      const followerGrowthPct = previousFollowers > 0 ? ((followers - previousFollowers) / previousFollowers) * 100 : 0

      return {
        id: account.id,
        handle: account.handle,
        platform: account.platform,
        modelName: account.model?.name || 'Unknown',
        modelId: account.model_id,
        accountType: account.account_type,
        snapshotCount: accountSnapshots.length,
        lastSnapshotDate: latest?.snapshot_date || null,
        followers,
        followerGrowthPct,
        vtfr: latest?.vtfr_weekly || 0,
        er: latest?.engagement_rate_weekly || 0,
        views7d: getSnapshotViews(latest),
        clicks7d: getSnapshotClicks(latest),
        followerHistory: accountSnapshots.map(snapshot => snapshot.followers || 0),
        viewsHistory: accountSnapshots.map(snapshot => getSnapshotViews(snapshot)),
        vtfrHistory: accountSnapshots.map(snapshot => snapshot.vtfr_weekly || 0),
        erHistory: accountSnapshots.map(snapshot => snapshot.engagement_rate_weekly || 0),
        redditKarma: latest?.rd_karma_total || 0,
        redditPosts1d: latest?.rd_posts_1d || 0,
        redditPosts7d: latest?.rd_posts_7d || 0,
        redditUpvotes1d: latest?.rd_upvotes_1d || 0,
        redditUpvotes7d: latest?.rd_upvotes_7d || 0,
        redditAvgUpvotes1d: latest?.rd_avg_upvotes_1d ?? (latest?.rd_posts_1d === 0 ? 0 : null),
        redditAvgUpvotes7d: latest?.rd_avg_upvotes_7d ?? (latest?.rd_posts_7d === 0 ? 0 : null),
        redditReplies7d: latest?.rd_comments_received_7d || 0,
        redditTopPostUpvotes: latest?.rd_top_post_upvotes || 0,
        redditBanLog: latest?.rd_ban_log || null,
        redditActivityHistory: accountSnapshots.map(snapshot =>
          (snapshot.rd_posts_7d || 0) + (snapshot.rd_upvotes_7d || 0) + (snapshot.rd_comments_received_7d || 0)
        ),
      }
    }).filter(row => row.snapshotCount > 0)

    if (isRedditBenchmark) {
      rows.sort((a, b) =>
        b.redditUpvotes7d - a.redditUpvotes7d ||
        b.redditPosts7d - a.redditPosts7d ||
        b.redditKarma - a.redditKarma
      )
    } else {
      rows.sort((a, b) => b.vtfr - a.vtfr)
    }

    return rows
  }, [accounts, snapshots, filterPlatform, filterModel, timeRange, isRedditBenchmark, referenceTime])

  const visibleBenchmark = useMemo(() => {
    if (filterPlatform) return benchmark
    return benchmark.filter(row => row.platform !== REDDIT_PLATFORM)
  }, [benchmark, filterPlatform])

  const modelHeatmapData = useMemo(() => {
    const modelMap = {}
    for (const row of visibleBenchmark) {
      if (!modelMap[row.modelName]) modelMap[row.modelName] = { vtfrs: [], ers: [], views: [], growths: [] }
      if (row.vtfr) modelMap[row.modelName].vtfrs.push(row.vtfr)
      if (row.er) modelMap[row.modelName].ers.push(row.er)
      modelMap[row.modelName].views.push(row.views7d)
      modelMap[row.modelName].growths.push(row.followerGrowthPct)
    }

    return Object.entries(modelMap)
      .map(([name, data]) => {
        const avg = arr => (arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : 0)
        return {
          name,
          avgVTFR: avg(data.vtfrs),
          avgER: avg(data.ers),
          totalViews: data.views.reduce((sum, value) => sum + value, 0),
          avgGrowth: avg(data.growths),
        }
      })
      .sort((a, b) => b.avgVTFR - a.avgVTFR)
  }, [visibleBenchmark])

  const weeklyHeatmap = useMemo(() => {
    if (isRedditBenchmark || !snapshots.length) return { rows: [], columns: [] }

    const weekSet = new Set()
    const cutoff = new Date(referenceTime - timeRange * 86400000)

    for (const snapshot of snapshots) {
      if (filterPlatform && snapshot.account?.platform !== filterPlatform) continue
      if (snapshot.account?.platform === REDDIT_PLATFORM) continue
      if (new Date(snapshot.snapshot_date) >= cutoff) {
        const date = new Date(snapshot.snapshot_date)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        weekSet.add(weekStart.toISOString().split('T')[0])
      }
    }

    const weeks = Array.from(weekSet).sort()
    const columns = weeks.map(week => {
      const date = new Date(week)
      return `${date.getMonth() + 1}/${date.getDate()}`
    })

    const modelWeekViews = {}
    for (const snapshot of snapshots) {
      if (filterPlatform && snapshot.account?.platform !== filterPlatform) continue
      if (snapshot.account?.platform === REDDIT_PLATFORM) continue

      const date = new Date(snapshot.snapshot_date)
      if (date < cutoff) continue

      const modelName = snapshot.account?.model?.name || 'Unknown'
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!modelWeekViews[modelName]) modelWeekViews[modelName] = {}
      if (!modelWeekViews[modelName][weekKey]) modelWeekViews[modelName][weekKey] = 0
      modelWeekViews[modelName][weekKey] += getSnapshotViews(snapshot)
    }

    return {
      rows: Object.entries(modelWeekViews).map(([label, weekData]) => ({
        label,
        cells: weeks.map(week => ({ value: weekData[week] || null })),
      })),
      columns,
    }
  }, [snapshots, timeRange, isRedditBenchmark, filterPlatform, referenceTime])

  const vtfrBarData = useMemo(() =>
    visibleBenchmark.slice(0, 15).map(row => ({
      name: `@${row.handle}`,
      vtfr: Number(row.vtfr.toFixed(1)),
      er: Number(row.er.toFixed(2)),
    })),
  [visibleBenchmark])

  const modelBarData = useMemo(() =>
    modelHeatmapData.map(model => ({
      name: model.name,
      avgVTFR: Number(model.avgVTFR.toFixed(1)),
      avgER: Number(model.avgER.toFixed(2)),
      totalViews: model.totalViews,
    })),
  [modelHeatmapData])

  const redditUpvotesBarData = useMemo(() =>
    benchmark.slice(0, 15).map(row => ({
      name: `@${row.handle}`,
      upvotes7d: row.redditUpvotes7d,
      posts7d: row.redditPosts7d,
    })),
  [benchmark])

  const redditKarmaBarData = useMemo(() =>
    benchmark.slice(0, 15).map(row => ({
      name: `@${row.handle}`,
      karma: row.redditKarma,
      avgUpvotes7d: row.redditAvgUpvotes7d || 0,
    })),
  [benchmark])

  const models = useMemo(() => {
    const map = new Map()
    for (const account of accounts) {
      if (account.model) map.set(account.model_id, account.model.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [accounts])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">{urlPlatform ? `${PLATFORM_LABELS[urlPlatform] || urlPlatform} Benchmark` : 'Benchmarking & Analytics'}</h1>
          <p>
            {isRedditBenchmark
              ? `Reddit-native performance across ${benchmark.length} accounts`
              : `VTFR/ER performance across ${visibleBenchmark.length} accounts`}
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            const rows = (isRedditBenchmark ? benchmark : visibleBenchmark).map(row => (
              isRedditBenchmark
                ? {
                    handle: row.handle,
                    platform: row.platform,
                    type: row.accountType,
                    model: row.modelName,
                    karma_total: row.redditKarma,
                    posts_1d: row.redditPosts1d,
                    posts_7d: row.redditPosts7d,
                    upvotes_1d: row.redditUpvotes1d,
                    upvotes_7d: row.redditUpvotes7d,
                    avg_upvotes_1d: row.redditAvgUpvotes1d ?? '',
                    avg_upvotes_7d: row.redditAvgUpvotes7d ?? '',
                    replies_7d: row.redditReplies7d,
                    top_post_upvotes: row.redditTopPostUpvotes,
                  }
                : {
                    handle: row.handle,
                    platform: row.platform,
                    type: row.accountType,
                    model: row.modelName,
                    followers: row.followers,
                    growth_pct: row.followerGrowthPct.toFixed(1),
                    vtfr: row.vtfr.toFixed(1),
                    er: row.er.toFixed(2),
                    views_7d: row.views7d,
                    clicks_7d: row.clicks7d,
                  }
            ))
            exportToCSV(rows, 'benchmark.csv')
          }}
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select value={filterPlatform} onChange={e => setPlatformFilter(e.target.value)} style={selectStyle} disabled={Boolean(urlPlatform)}>
          <option value="">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="twitter">Twitter / X</option>
          <option value="reddit">Reddit</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={selectStyle}>
          <option value="">All Models</option>
          {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
        <select value={timeRange} onChange={e => setTimeRange(Number(e.target.value))} style={selectStyle}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {!filterPlatform && benchmark.some(row => row.platform === REDDIT_PLATFORM) && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
          Reddit uses a different benchmark model from Instagram, Twitter/X, and TikTok. Use the Reddit benchmark tab for native Reddit rankings and compare the other platforms here.
        </div>
      )}

      {isRedditBenchmark ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Top Reddit Accounts by Upvotes (7d)</h3>
              <BarChartComponent
                data={redditUpvotesBarData}
                bars={[
                  { key: 'upvotes7d', label: 'Upvotes 7d', color: COLORS.primary },
                  { key: 'posts7d', label: 'Posts 7d', color: COLORS.success },
                ]}
                height={350}
                formatter={value => formatNumber(value)}
              />
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Top Reddit Accounts by Total Karma</h3>
              <BarChartComponent
                data={redditKarmaBarData}
                bars={[
                  { key: 'karma', label: 'Total Karma', color: COLORS.primary },
                  { key: 'avgUpvotes7d', label: 'Avg Upvotes 7d', color: COLORS.success },
                ]}
                height={350}
                formatter={value => formatNumber(value)}
              />
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.25rem 0' }}>
              <h3 style={{ fontSize: '0.95rem' }}>Reddit Rankings</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="accounts-table" style={{ minWidth: '1250px' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Handle</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th className="numeric">Karma</th>
                    <th className="numeric">Posts 1d</th>
                    <th className="numeric">Posts 7d</th>
                    <th className="numeric">Upvotes 1d</th>
                    <th className="numeric">Upvotes 7d</th>
                    <th className="numeric">Avg Upvotes 1d</th>
                    <th className="numeric">Avg Upvotes 7d</th>
                    <th className="numeric">Replies 7d</th>
                    <th className="numeric">Top Post</th>
                    <th style={{ textAlign: 'center' }}>Activity Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmark.map((row, index) => (
                    <tr key={row.id}>
                      <td style={{ color: 'var(--text-tertiary)' }}>{index + 1}</td>
                      <td><strong style={{ color: 'var(--text-primary)' }}>@{row.handle}</strong></td>
                      <td>{row.modelName}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.accountType || '—'}</td>
                      <td className="numeric font-semibold">{formatNumber(row.redditKarma)}</td>
                      <td className="numeric">{formatNumber(row.redditPosts1d)}</td>
                      <td className="numeric">{formatNumber(row.redditPosts7d)}</td>
                      <td className="numeric">{formatNumber(row.redditUpvotes1d)}</td>
                      <td className="numeric font-semibold">{formatNumber(row.redditUpvotes7d)}</td>
                      <td className="numeric">{row.redditAvgUpvotes1d != null ? formatNumber(row.redditAvgUpvotes1d) : '—'}</td>
                      <td className="numeric">{row.redditAvgUpvotes7d != null ? formatNumber(row.redditAvgUpvotes7d) : '—'}</td>
                      <td className="numeric">{formatNumber(row.redditReplies7d)}</td>
                      <td className="numeric">{formatNumber(row.redditTopPostUpvotes)}</td>
                      <td style={{ textAlign: 'center' }}><Sparkline data={row.redditActivityHistory} color="#6366f1" /></td>
                    </tr>
                  ))}
                  {benchmark.length === 0 && (
                    <tr><td colSpan={14} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>No Reddit benchmark data yet. Run the Reddit scraper to populate rankings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Model Avg VTFR</h3>
              <BarChartComponent
                data={modelBarData}
                bars={[{ key: 'avgVTFR', label: 'Avg VTFR %', color: COLORS.primary }]}
                layout="horizontal"
                height={Math.max(200, modelBarData.length * 40)}
                formatter={value => value.toFixed(1) + '%'}
              />
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Model Avg ER</h3>
              <BarChartComponent
                data={modelBarData}
                bars={[{ key: 'avgER', label: 'Avg ER %', color: COLORS.success }]}
                layout="horizontal"
                height={Math.max(200, modelBarData.length * 40)}
                formatter={value => value.toFixed(2) + '%'}
              />
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Top 15 Accounts by VTFR</h3>
            <BarChartComponent
              data={vtfrBarData}
              bars={[
                { key: 'vtfr', label: 'VTFR %', color: COLORS.primary },
                { key: 'er', label: 'ER %', color: COLORS.success },
              ]}
              height={350}
              formatter={value => value + '%'}
            />
          </div>

          {weeklyHeatmap.rows.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <HeatmapGrid
                title="Weekly Reach by Model (Views)"
                rows={weeklyHeatmap.rows}
                columns={weeklyHeatmap.columns}
                colorScale={viewsColorScale}
                valueFormatter={formatNumber}
              />
            </div>
          )}

          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.25rem 0' }}>
              <h3 style={{ fontSize: '0.95rem' }}>Account Rankings</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="accounts-table" style={{ minWidth: '1100px' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Handle</th>
                    <th>Model</th>
                    <th>Platform</th>
                    <th>Type</th>
                    <th className="numeric">Followers</th>
                    <th className="numeric">Growth</th>
                    <th style={{ textAlign: 'center' }}>Follower Trend</th>
                    <th className="numeric">VTFR</th>
                    <th style={{ textAlign: 'center' }}>VTFR Trend</th>
                    <th className="numeric">ER</th>
                    <th style={{ textAlign: 'center' }}>ER Trend</th>
                    <th className="numeric">Views 7d</th>
                    <th style={{ textAlign: 'center' }}>Views Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBenchmark.map((row, index) => {
                    const vtfrStyle = vtfrGrade(row.vtfr)
                    const erStyle = erGrade(row.er)
                    return (
                      <tr key={row.id}>
                        <td style={{ color: 'var(--text-tertiary)' }}>{index + 1}</td>
                        <td><strong style={{ color: 'var(--text-primary)' }}>@{row.handle}</strong></td>
                        <td>{row.modelName}</td>
                        <td style={{ textTransform: 'capitalize' }}>{row.platform}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.accountType || '—'}</td>
                        <td className="numeric font-semibold">{formatNumber(row.followers)}</td>
                        <td className="numeric">
                          <span style={{ color: row.followerGrowthPct >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {row.followerGrowthPct >= 0 ? '+' : ''}{row.followerGrowthPct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}><Sparkline data={row.followerHistory} /></td>
                        <td className="numeric">
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: vtfrStyle.color, background: vtfrStyle.bg }}>
                            {row.vtfr.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}><Sparkline data={row.vtfrHistory} color="#6366f1" /></td>
                        <td className="numeric">
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: erStyle.color, background: erStyle.bg }}>
                            {row.er.toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}><Sparkline data={row.erHistory} color="#10b981" /></td>
                        <td className="numeric font-semibold">{formatNumber(row.views7d)}</td>
                        <td style={{ textAlign: 'center' }}><Sparkline data={row.viewsHistory} color="#f59e0b" /></td>
                      </tr>
                    )
                  })}
                  {visibleBenchmark.length === 0 && (
                    <tr><td colSpan={14} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>No benchmark data yet. Enter snapshot data to see rankings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const selectStyle = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  cursor: 'pointer',
}
