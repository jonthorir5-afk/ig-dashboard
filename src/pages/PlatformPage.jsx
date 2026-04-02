import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Download, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { getAccounts, getLatestSnapshots, getAllSnapshotHistory, getLatestOFTracking } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, exportToCSV } from '../lib/metrics'
import Sparkline from '../components/charts/Sparkline'
import { TrendChart, COLORS } from '../components/charts/TrendChart'

const PLATFORM_LABELS = { instagram: 'Instagram', twitter: 'Twitter / X', reddit: 'Reddit', tiktok: 'TikTok' }

export default function PlatformPage() {
  const { platform } = useParams()
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [history, setHistory] = useState([])
  const [ofTracking, setOfTracking] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('followers')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedPlatform, setSelectedPlatform] = useState(platform || '')
  const [selectedModelIds, setSelectedModelIds] = useState([])

  useEffect(() => {
    setSelectedPlatform(platform || '')
  }, [platform])

  useEffect(() => {
    Promise.all([getAccounts(), getLatestSnapshots(), getAllSnapshotHistory(60), getLatestOFTracking(90)])
      .then(([accs, snaps, hist, tracking]) => { setAccounts(accs); setSnapshots(snaps); setHistory(hist); setOfTracking(tracking) })
      .finally(() => setLoading(false))
  }, [])

  const merged = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) {
      snapByAccount[s.account_id] = s
    }
    const ofByAccount = Object.fromEntries(ofTracking.map(row => [row.account_id, row]))
    let result = accounts.map(a => ({
      ...a,
      snapshot: snapByAccount[a.id] || null,
      ofTracking: ofByAccount[a.id] || null,
      _followers: snapByAccount[a.id]?.followers || 0,
      _views: getSnapshotViews(snapByAccount[a.id]),
      _clicks: getSnapshotClicks(snapByAccount[a.id]),
      _vtfr: snapByAccount[a.id]?.vtfr_weekly || 0,
      _er: snapByAccount[a.id]?.engagement_rate_weekly || 0,
      _ofClicks: ofByAccount[a.id]?.clicks || 0,
      _ofSubs: ofByAccount[a.id]?.subscribers || 0,
      _ofRevenue: Number(ofByAccount[a.id]?.revenue_total || 0),
      _ofCvr: (ofByAccount[a.id]?.clicks || 0) > 0 ? ((ofByAccount[a.id]?.subscribers || 0) / ofByAccount[a.id].clicks) * 100 : 0,
    }))
    if (selectedPlatform) result = result.filter(a => a.platform === selectedPlatform)
    if (selectedModelIds.length > 0) result = result.filter(a => selectedModelIds.includes(a.model_id))
    if (search) result = result.filter(a => a.handle.toLowerCase().includes(search.toLowerCase()) || a.model?.name?.toLowerCase().includes(search.toLowerCase()))
    result.sort((a, b) => {
      const aVal = a[`_${sortKey}`] ?? a[sortKey] ?? 0
      const bVal = b[`_${sortKey}`] ?? b[sortKey] ?? 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
    return result
  }, [accounts, snapshots, ofTracking, selectedPlatform, selectedModelIds, search, sortKey, sortDir])

  const requestSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />) : null

  const modelOptions = useMemo(() => {
    const map = new Map()
    for (const account of accounts) {
      if (selectedPlatform && account.platform !== selectedPlatform) continue
      if (account.model_id && account.model?.name) map.set(account.model_id, account.model.name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts, selectedPlatform])

  const toggleModel = (modelId) => {
    setSelectedModelIds(prev =>
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    )
  }

  // Sparkline data per account from history
  const sparklines = useMemo(() => {
    const byAccount = {}
    for (const s of history) {
      if (!byAccount[s.account_id]) byAccount[s.account_id] = []
      byAccount[s.account_id].push(s)
    }
    const result = {}
    for (const [aid, snaps] of Object.entries(byAccount)) {
      const sorted = snaps.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      result[aid] = sorted.map(s => s.followers || 0)
    }
    return result
  }, [history])

  // Daily aggregate trend for this platform
  const dailyTrend = useMemo(() => {
    const dateMap = {}
    for (const s of history) {
      if (selectedPlatform && s.account?.platform !== selectedPlatform) continue
      if (!dateMap[s.snapshot_date]) dateMap[s.snapshot_date] = { date: s.snapshot_date, views: 0, followers: 0 }
      dateMap[s.snapshot_date].views += getSnapshotViews(s)
      dateMap[s.snapshot_date].followers += s.followers || 0
    }
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  }, [history, selectedPlatform])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">{selectedPlatform ? PLATFORM_LABELS[selectedPlatform] : 'All Platforms'}</h1>
          <p>{merged.length} accounts ranked by performance</p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          const rows = merged.map(a => ({
            handle: a.handle, model: a.model?.name, platform: a.platform,
            health: a.health, followers: a._followers, views_7d: a._views,
            clicks_7d: a._clicks, vtfr: a._vtfr, er: a._er, of_link: a.ofTracking?.tracking_link_name || '',
            of_clicks: a._ofClicks, of_subs: a._ofSubs, of_cvr: a._ofCvr.toFixed(1), of_revenue: a._ofRevenue
          }))
          exportToCSV(rows, `${selectedPlatform || 'all-platforms'}.csv`)
        }}>
          <Download size={16} /> Export
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="search-bar" style={{ maxWidth: '400px' }}>
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search by handle or model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', minWidth: '260px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Models</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => setSelectedModelIds([])}
            >
              All Models
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {modelOptions.map(model => {
              const active = selectedModelIds.includes(model.id)
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', borderRadius: '999px' }}
                >
                  {model.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {dailyTrend.length > 1 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>
            {selectedPlatform ? PLATFORM_LABELS[selectedPlatform] : 'All Platforms'} — Views & Followers Over Time
          </h3>
          <TrendChart
            data={dailyTrend}
            lines={[
              { key: 'views', label: 'Views', color: COLORS.primary },
              { key: 'followers', label: 'Followers', color: COLORS.success },
            ]}
            height={240}
          />
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '1200px' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Handle</th>
                <th>Model</th>
                {!selectedPlatform && <th>Platform</th>}
                <th>Health</th>
                <th className="sortable numeric" onClick={() => requestSort('followers')}>Followers <SortIcon k="followers" /></th>
                <th style={{ textAlign: 'center' }}>Trend</th>
                <th className="sortable numeric" onClick={() => requestSort('views')}>Views 7d <SortIcon k="views" /></th>
                <th className="sortable numeric" onClick={() => requestSort('clicks')}>Clicks 7d <SortIcon k="clicks" /></th>
                <th className="numeric">OF Link</th>
                <th className="sortable numeric" onClick={() => requestSort('ofClicks')}>OF Clicks <SortIcon k="ofClicks" /></th>
                <th className="sortable numeric" onClick={() => requestSort('ofSubs')}>OF Subs <SortIcon k="ofSubs" /></th>
                <th className="sortable numeric" onClick={() => requestSort('ofCvr')}>CVR <SortIcon k="ofCvr" /></th>
                <th className="sortable numeric" onClick={() => requestSort('ofRevenue')}>Revenue <SortIcon k="ofRevenue" /></th>
                <th className="sortable numeric" onClick={() => requestSort('vtfr')}>VTFR <SortIcon k="vtfr" /></th>
                <th className="sortable numeric" onClick={() => requestSort('er')}>ER <SortIcon k="er" /></th>
              </tr>
            </thead>
            <tbody>
              {merged.map((a, i) => {
                const hc = healthColor(a.health)
                return (
                  <tr key={a.id} style={a.health !== 'Clean' ? { background: 'rgba(239, 68, 68, 0.03)' } : undefined}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                    <td>{a.model?.name || '—'}</td>
                    {!selectedPlatform && <td style={{ textTransform: 'capitalize' }}>{a.platform}</td>}
                    <td>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                        {a.health}
                      </span>
                    </td>
                    <td className="numeric font-semibold">{formatNumber(a._followers)}</td>
                    <td style={{ textAlign: 'center' }}><Sparkline data={sparklines[a.id] || []} /></td>
                    <td className="numeric font-semibold">{formatNumber(a._views)}</td>
                    <td className="numeric">{formatNumber(a._clicks)}</td>
                    <td className="numeric" style={{ textAlign: 'left', fontSize: '0.8rem', color: a.ofTracking ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{a.ofTracking?.tracking_link_name || '—'}</td>
                    <td className="numeric">{formatNumber(a._ofClicks)}</td>
                    <td className="numeric font-semibold">{formatNumber(a._ofSubs)}</td>
                    <td className="numeric">{a._ofClicks ? `${a._ofCvr.toFixed(1)}%` : '—'}</td>
                    <td className="numeric">{a._ofRevenue ? `$${formatNumber(a._ofRevenue)}` : '—'}</td>
                    <td className="numeric">{a._vtfr ? a._vtfr.toFixed(1) + '%' : '—'}</td>
                    <td className="numeric">{a._er ? a._er.toFixed(1) + '%' : '—'}</td>
                  </tr>
                )
              })}
              {merged.length === 0 && (
                <tr>
                  <td
                    colSpan={selectedPlatform ? 15 : 16}
                    style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}
                  >
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
