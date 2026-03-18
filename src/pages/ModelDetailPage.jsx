import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Globe, ChevronRight } from 'lucide-react'
import { getModel, getAccounts } from '../lib/api'
import { supabase } from '../lib/supabase'
import { formatNumber, getSnapshotViews, getSnapshotClicks, healthColor } from '../lib/metrics'

export default function ModelDetailPage() {
  const { id } = useParams()
  const [model, setModel] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getModel(id),
      getAccounts({ model_id: id }),
      supabase
        .from('snapshots')
        .select('*, account:accounts(id, platform, handle)')
        .in('account_id', []) // will be replaced after accounts load
        .order('snapshot_date', { ascending: false })
        .limit(200)
    ]).then(([m, accs]) => {
      setModel(m)
      setAccounts(accs)

      // Now fetch snapshots for these accounts
      if (accs.length > 0) {
        const accountIds = accs.map(a => a.id)
        supabase
          .from('snapshots')
          .select('*, account:accounts(id, platform, handle)')
          .in('account_id', accountIds)
          .order('snapshot_date', { ascending: false })
          .limit(200)
          .then(({ data }) => setSnapshots(data || []))
      }
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>
  }

  if (!model) {
    return <div className="flex-center" style={{ height: '60vh' }}><p style={{ color: 'var(--text-tertiary)' }}>Model not found</p></div>
  }

  // Aggregate stats
  const latestByAccount = {}
  for (const s of snapshots) {
    if (!latestByAccount[s.account_id] || s.snapshot_date > latestByAccount[s.account_id].snapshot_date) {
      latestByAccount[s.account_id] = s
    }
  }
  const latestArr = Object.values(latestByAccount)
  const totalReach = latestArr.reduce((sum, s) => sum + getSnapshotViews(s), 0)
  const totalClicks = latestArr.reduce((sum, s) => sum + getSnapshotClicks(s), 0)

  // Content volume (sum of posts across platforms)
  const totalPosts = latestArr.reduce((sum, s) => {
    return sum + (s.ig_reels_posted_7d || 0) + (s.ig_stories_posted_7d || 0)
      + (s.tw_tweets_posted_7d || 0) + (s.rd_posts_7d || 0) + (s.tt_videos_posted_7d || 0)
  }, 0)

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

      {/* Account cards */}
      <h2 style={{ marginTop: '0.5rem' }}>Accounts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {accounts.map(account => {
          const hc = healthColor(account.health)
          const snap = latestByAccount[account.id]
          return (
            <div key={account.id} className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>@{account.handle}</span>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{account.platform}</span>
                </div>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                  {account.health}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Type: {account.account_type}</span>
                <span>Status: {account.status}</span>
              </div>
              {snap && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Followers</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatNumber(snap.followers)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Views 7d</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatNumber(getSnapshotViews(snap))}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Clicks 7d</p>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatNumber(getSnapshotClicks(snap))}</p>
                  </div>
                </div>
              )}
              {!snap && (
                <p style={{ marginTop: '0.75rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No snapshot data yet</p>
              )}
              {account.operator && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Operator: {account.operator.display_name}
                </p>
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
