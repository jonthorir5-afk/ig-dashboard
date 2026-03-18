import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Download, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { getAccounts, getLatestSnapshots } from '../lib/api'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor, exportToCSV } from '../lib/metrics'

const PLATFORM_LABELS = { instagram: 'Instagram', twitter: 'Twitter / X', reddit: 'Reddit', tiktok: 'TikTok' }

export default function PlatformPage() {
  const { platform } = useParams()
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('followers')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedPlatform, setSelectedPlatform] = useState(platform || '')

  useEffect(() => {
    setSelectedPlatform(platform || '')
  }, [platform])

  useEffect(() => {
    Promise.all([getAccounts(), getLatestSnapshots()])
      .then(([accs, snaps]) => { setAccounts(accs); setSnapshots(snaps) })
      .finally(() => setLoading(false))
  }, [])

  const merged = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) {
      snapByAccount[s.account_id] = s
    }
    let result = accounts.map(a => ({
      ...a,
      snapshot: snapByAccount[a.id] || null,
      _followers: snapByAccount[a.id]?.followers || 0,
      _views: getSnapshotViews(snapByAccount[a.id]),
      _clicks: getSnapshotClicks(snapByAccount[a.id]),
      _vtfr: snapByAccount[a.id]?.vtfr_weekly || 0,
      _er: snapByAccount[a.id]?.engagement_rate_weekly || 0,
    }))
    if (selectedPlatform) result = result.filter(a => a.platform === selectedPlatform)
    if (search) result = result.filter(a => a.handle.toLowerCase().includes(search.toLowerCase()) || a.model?.name?.toLowerCase().includes(search.toLowerCase()))
    result.sort((a, b) => {
      const aVal = a[`_${sortKey}`] ?? a[sortKey] ?? 0
      const bVal = b[`_${sortKey}`] ?? b[sortKey] ?? 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
    return result
  }, [accounts, snapshots, selectedPlatform, search, sortKey, sortDir])

  const requestSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />) : null

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
            clicks_7d: a._clicks, vtfr: a._vtfr, er: a._er
          }))
          exportToCSV(rows, `${selectedPlatform || 'all-platforms'}.csv`)
        }}>
          <Download size={16} /> Export
        </button>
      </div>

      {/* Platform tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link to="/platforms" className={`btn ${!selectedPlatform ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: '20px', padding: '6px 16px' }}>All</Link>
        {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
          <Link key={key} to={`/platforms/${key}`} className={`btn ${selectedPlatform === key ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: '20px', padding: '6px 16px' }}>
            {label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="search-bar" style={{ maxWidth: '400px' }}>
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search by handle or model..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Handle</th>
                <th>Model</th>
                {!selectedPlatform && <th>Platform</th>}
                <th>Health</th>
                <th className="sortable numeric" onClick={() => requestSort('followers')}>Followers <SortIcon k="followers" /></th>
                <th className="sortable numeric" onClick={() => requestSort('views')}>Views 7d <SortIcon k="views" /></th>
                <th className="sortable numeric" onClick={() => requestSort('clicks')}>Clicks 7d <SortIcon k="clicks" /></th>
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
                    <td className="numeric font-semibold">{formatNumber(a._views)}</td>
                    <td className="numeric">{formatNumber(a._clicks)}</td>
                    <td className="numeric">{a._vtfr ? a._vtfr.toFixed(1) + '%' : '—'}</td>
                    <td className="numeric">{a._er ? a._er.toFixed(1) + '%' : '—'}</td>
                  </tr>
                )
              })}
              {merged.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
