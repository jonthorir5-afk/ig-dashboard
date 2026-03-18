import { useState, useEffect, useMemo } from 'react'
import { getProfiles, getAccounts, getLatestSnapshots } from '../lib/api'
import { formatNumber, healthColor, getSnapshotViews } from '../lib/metrics'

export default function OperatorsPage() {
  const [operators, setOperators] = useState([])
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([getProfiles(), getAccounts(), getLatestSnapshots()])
      .then(([ops, accs, snaps]) => { setOperators(ops); setAccounts(accs); setSnapshots(snaps) })
      .finally(() => setLoading(false))
  }, [])

  const operatorData = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) snapByAccount[s.account_id] = s

    return operators.map(op => {
      const assignedAccounts = accounts.filter(a => a.assigned_operator === op.id)
      const assignedWithSnaps = assignedAccounts.map(a => ({
        ...a,
        snapshot: snapByAccount[a.id] || null
      }))

      // Posts made vs target (sum posts across platforms from latest snapshot)
      const totalPosts = assignedWithSnaps.reduce((sum, a) => {
        const s = a.snapshot
        if (!s) return sum
        return sum + (s.ig_reels_posted_7d || 0) + (s.ig_stories_posted_7d || 0)
          + (s.tw_tweets_posted_7d || 0) + (s.rd_posts_7d || 0) + (s.tt_videos_posted_7d || 0)
      }, 0)

      const healthIssues = assignedAccounts.filter(a => a.health !== 'Clean')

      return {
        ...op,
        accounts: assignedWithSnaps,
        accountCount: assignedAccounts.length,
        totalPosts,
        healthIssues: healthIssues.length,
        postsPerAccount: assignedAccounts.length ? (totalPosts / assignedAccounts.length).toFixed(1) : 0
      }
    })
  }, [operators, accounts, snapshots])

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  const selectedOp = selected ? operatorData.find(o => o.id === selected) : null

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Operators</h1>
          <p>{operators.length} team members</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOp ? '300px 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Operator list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {operatorData.map(op => (
            <div
              key={op.id}
              className="glass-panel"
              onClick={() => setSelected(op.id === selected ? null : op.id)}
              style={{ padding: '1rem', cursor: 'pointer', border: op.id === selected ? '1px solid var(--accent-primary)' : undefined }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="avatar">{op.display_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{op.display_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{op.role}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{op.accountCount}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>accounts</p>
                </div>
              </div>
              {op.healthIssues > 0 && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-warning)' }}>
                  {op.healthIssues} health issue(s)
                </p>
              )}
            </div>
          ))}
          {operatorData.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', padding: '2rem', textAlign: 'center' }}>No operators yet.</p>
          )}
        </div>

        {/* Selected operator detail */}
        {selectedOp && (
          <div>
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>{selectedOp.display_name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Accounts Managed</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.accountCount}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Total Posts (7d)</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.totalPosts}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Posts / Account</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.postsPerAccount}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Platform</th>
                    <th>Health</th>
                    <th className="numeric">Followers</th>
                    <th className="numeric">Views 7d</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOp.accounts.map(a => {
                    const hc = healthColor(a.health)
                    return (
                      <tr key={a.id}>
                        <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{a.platform}</td>
                        <td>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                            {a.health}
                          </span>
                        </td>
                        <td className="numeric">{formatNumber(a.snapshot?.followers)}</td>
                        <td className="numeric">{formatNumber(getSnapshotViews(a.snapshot))}</td>
                      </tr>
                    )
                  })}
                  {selectedOp.accounts.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No accounts assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
