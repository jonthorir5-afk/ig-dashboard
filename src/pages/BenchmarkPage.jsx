import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Filter } from 'lucide-react'
import { getAccounts, getAllSnapshotHistory } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, vtfrGrade, erGrade, exportToCSV } from '../lib/metrics'
import BarChartComponent from '../components/charts/BarChart'
import HeatmapGrid, { vtfrColorScale, erColorScale, viewsColorScale, followerGrowthColorScale } from '../components/charts/HeatmapGrid'
import { TrendChart, COLORS } from '../components/charts/TrendChart'
import Sparkline from '../components/charts/Sparkline'

const PLATFORM_LABELS = { twitter: 'Twitter / X', reddit: 'Reddit', instagram: 'Instagram', tiktok: 'TikTok' }

export default function BenchmarkPage() {
  const { platform: urlPlatform } = useParams()
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterPlatform, setFilterPlatform] = useState(urlPlatform || '')
  const [filterModel, setFilterModel] = useState('')

  // Sync URL param to filter
  useEffect(() => { setFilterPlatform(urlPlatform || '') }, [urlPlatform])
  const [timeRange, setTimeRange] = useState(30)

  useEffect(() => {
    Promise.all([getAccounts(), getAllSnapshotHistory(90)])
      .then(([accs, snaps]) => { setAccounts(accs); setSnapshots(snaps) })
      .finally(() => setLoading(false))
  }, [])

  // Build per-account benchmark data
  const benchmark = useMemo(() => {
    let filteredAccounts = accounts
    if (filterPlatform) filteredAccounts = filteredAccounts.filter(a => a.platform === filterPlatform)
    if (filterModel) filteredAccounts = filteredAccounts.filter(a => a.model_id === filterModel)

    const cutoff = new Date(Date.now() - timeRange * 86400000).toISOString().split('T')[0]
    const relevantSnaps = snapshots.filter(s => s.snapshot_date >= cutoff)

    // Group snapshots by account
    const snapsByAccount = {}
    for (const s of relevantSnaps) {
      if (!snapsByAccount[s.account_id]) snapsByAccount[s.account_id] = []
      snapsByAccount[s.account_id].push(s)
    }

    const accountData = filteredAccounts.map(a => {
      const snaps = (snapsByAccount[a.id] || []).sort((x, y) => x.snapshot_date.localeCompare(y.snapshot_date))
      const latest = snaps[snaps.length - 1]
      const oldest = snaps[0]

      const followers = latest?.followers || 0
      const prevFollowers = oldest?.followers || 0
      const followerGrowthPct = prevFollowers > 0 ? ((followers - prevFollowers) / prevFollowers * 100) : 0

      const vtfr = latest?.vtfr_weekly || 0
      const er = latest?.engagement_rate_weekly || 0

      const views7d = getSnapshotViews(latest)
      const clicks7d = getSnapshotClicks(latest)

      // Sparkline data: followers over time
      const followerHistory = snaps.map(s => s.followers || 0)
      const viewsHistory = snaps.map(s => getSnapshotViews(s))
      const vtfrHistory = snaps.map(s => s.vtfr_weekly || 0)
      const erHistory = snaps.map(s => s.engagement_rate_weekly || 0)

      return {
        id: a.id,
        handle: a.handle,
        platform: a.platform,
        modelName: a.model?.name || 'Unknown',
        modelId: a.model_id,
        accountType: a.account_type,
        followers,
        followerGrowthPct,
        vtfr,
        er,
        views7d,
        clicks7d,
        followerHistory,
        viewsHistory,
        vtfrHistory,
        erHistory,
        snapshotCount: snaps.length,
      }
    }).filter(a => a.snapshotCount > 0) // Only show accounts with data

    // Sort by VTFR descending
    accountData.sort((a, b) => b.vtfr - a.vtfr)

    return accountData
  }, [accounts, snapshots, filterPlatform, filterModel, timeRange])

  // Model aggregates for heatmap
  const modelHeatmapData = useMemo(() => {
    const modelMap = {}
    for (const a of benchmark) {
      if (!modelMap[a.modelName]) modelMap[a.modelName] = { accounts: [], vtfrs: [], ers: [], views: [], growths: [] }
      modelMap[a.modelName].accounts.push(a)
      if (a.vtfr) modelMap[a.modelName].vtfrs.push(a.vtfr)
      if (a.er) modelMap[a.modelName].ers.push(a.er)
      modelMap[a.modelName].views.push(a.views7d)
      modelMap[a.modelName].growths.push(a.followerGrowthPct)
    }

    return Object.entries(modelMap).map(([name, data]) => {
      const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
      return {
        name,
        accountCount: data.accounts.length,
        avgVTFR: avg(data.vtfrs),
        avgER: avg(data.ers),
        totalViews: data.views.reduce((s, v) => s + v, 0),
        avgGrowth: avg(data.growths),
      }
    }).sort((a, b) => b.avgVTFR - a.avgVTFR)
  }, [benchmark])

  // Weekly heatmap: models × weeks
  const weeklyHeatmap = useMemo(() => {
    if (!snapshots.length) return { rows: [], columns: [] }

    // Get distinct weeks
    const weekSet = new Set()
    const cutoff = new Date(Date.now() - timeRange * 86400000)
    for (const s of snapshots) {
      if (new Date(s.snapshot_date) >= cutoff) {
        const d = new Date(s.snapshot_date)
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay())
        weekSet.add(weekStart.toISOString().split('T')[0])
      }
    }
    const weeks = Array.from(weekSet).sort()
    const columns = weeks.map(w => {
      const d = new Date(w)
      return `${d.getMonth() + 1}/${d.getDate()}`
    })

    // Group snapshots by model and week
    const modelWeekViews = {}
    for (const s of snapshots) {
      const modelName = s.account?.model?.name || 'Unknown'
      const d = new Date(s.snapshot_date)
      if (d < cutoff) continue
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!modelWeekViews[modelName]) modelWeekViews[modelName] = {}
      if (!modelWeekViews[modelName][weekKey]) modelWeekViews[modelName][weekKey] = 0
      modelWeekViews[modelName][weekKey] += getSnapshotViews(s)
    }

    const rows = Object.entries(modelWeekViews).map(([label, weekData]) => ({
      label,
      cells: weeks.map(w => ({ value: weekData[w] || null }))
    }))

    return { rows, columns }
  }, [snapshots, timeRange])

  // Top VTFR bar chart data
  const vtfrBarData = useMemo(() =>
    benchmark.slice(0, 15).map(a => ({
      name: `@${a.handle}`,
      vtfr: Number(a.vtfr.toFixed(1)),
      er: Number(a.er.toFixed(2)),
    })),
    [benchmark]
  )

  // Model comparison bar chart
  const modelBarData = useMemo(() =>
    modelHeatmapData.map(m => ({
      name: m.name,
      avgVTFR: Number(m.avgVTFR.toFixed(1)),
      avgER: Number(m.avgER.toFixed(2)),
      totalViews: m.totalViews,
    })),
    [modelHeatmapData]
  )

  const models = useMemo(() => {
    const set = new Map()
    for (const a of accounts) {
      if (a.model) set.set(a.model_id, a.model.name)
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }))
  }, [accounts])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">{urlPlatform ? `${PLATFORM_LABELS[urlPlatform] || urlPlatform} Benchmark` : 'Benchmarking & Analytics'}</h1>
          <p>VTFR/ER performance across {benchmark.length} accounts</p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          const rows = benchmark.map(a => ({
            handle: a.handle, platform: a.platform, type: a.accountType, model: a.modelName,
            followers: a.followers, growth_pct: a.followerGrowthPct.toFixed(1),
            vtfr: a.vtfr.toFixed(1), er: a.er.toFixed(2),
            views_7d: a.views7d, clicks_7d: a.clicks7d
          }))
          exportToCSV(rows, 'benchmark.csv')
        }}>
          <Download size={16} /> Export
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={selectStyle}>
          <option value="">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="twitter">Twitter / X</option>
          <option value="reddit">Reddit</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={selectStyle}>
          <option value="">All Models</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={timeRange} onChange={e => setTimeRange(Number(e.target.value))} style={selectStyle}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Model comparison bar chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Model Avg VTFR</h3>
          <BarChartComponent
            data={modelBarData}
            bars={[{ key: 'avgVTFR', label: 'Avg VTFR %', color: COLORS.primary }]}
            layout="horizontal"
            height={Math.max(200, modelBarData.length * 40)}
            formatter={v => v.toFixed(1) + '%'}
          />
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Model Avg ER</h3>
          <BarChartComponent
            data={modelBarData}
            bars={[{ key: 'avgER', label: 'Avg ER %', color: COLORS.success }]}
            layout="horizontal"
            height={Math.max(200, modelBarData.length * 40)}
            formatter={v => v.toFixed(2) + '%'}
          />
        </div>
      </div>

      {/* Top accounts VTFR bar chart */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Top 15 Accounts by VTFR</h3>
        <BarChartComponent
          data={vtfrBarData}
          bars={[
            { key: 'vtfr', label: 'VTFR %', color: COLORS.primary },
            { key: 'er', label: 'ER %', color: COLORS.success },
          ]}
          height={350}
          formatter={v => v + '%'}
        />
      </div>

      {/* Weekly reach heatmap */}
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

      {/* Full benchmark table with sparklines */}
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
              {benchmark.map((a, i) => {
                const vg = vtfrGrade(a.vtfr)
                const eg = erGrade(a.er)
                return (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                    <td>{a.modelName}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.platform}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.accountType || '—'}</td>
                    <td className="numeric font-semibold">{formatNumber(a.followers)}</td>
                    <td className="numeric">
                      <span style={{ color: a.followerGrowthPct >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {a.followerGrowthPct >= 0 ? '+' : ''}{a.followerGrowthPct.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}><Sparkline data={a.followerHistory} /></td>
                    <td className="numeric">
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: vg.color, background: vg.bg }}>
                        {a.vtfr.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}><Sparkline data={a.vtfrHistory} color="#6366f1" /></td>
                    <td className="numeric">
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, color: eg.color, background: eg.bg }}>
                        {a.er.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}><Sparkline data={a.erHistory} color="#10b981" /></td>
                    <td className="numeric font-semibold">{formatNumber(a.views7d)}</td>
                    <td style={{ textAlign: 'center' }}><Sparkline data={a.viewsHistory} color="#f59e0b" /></td>
                  </tr>
                )
              })}
              {benchmark.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>No benchmark data yet. Enter snapshot data to see rankings.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const selectStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer'
}
