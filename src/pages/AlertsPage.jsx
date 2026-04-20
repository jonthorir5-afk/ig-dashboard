import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Settings, Download, Check, X, Bell } from 'lucide-react'
import { getAccounts, getLatestSnapshots, getAllSnapshotHistory } from '../lib/api'
import { formatNumber, exportToCSV, vtfrGrade, erGrade } from '../lib/metrics'
import { getAlertRules, saveAlertRules, DEFAULT_ALERT_RULES } from '../lib/automation'

export default function AlertsPage() {
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [rules, setRules] = useState(getAlertRules)
  const [referenceTime] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ig_dismissed_alerts') || '[]')) } catch { return new Set() }
  })
  const [showDismissed, setShowDismissed] = useState(false)

  useEffect(() => {
    Promise.all([getAccounts(), getLatestSnapshots(), getAllSnapshotHistory(30)])
      .then(([accs, snaps, hist]) => { setAccounts(accs); setSnapshots(snaps); setHistory(hist) })
      .finally(() => setLoading(false))
  }, [])

  // Build previous snapshot data for growth calculations
  const prevSnapByAccount = useMemo(() => {
    const byAccount = {}
    for (const s of history) {
      if (!byAccount[s.account_id]) byAccount[s.account_id] = []
      byAccount[s.account_id].push(s)
    }
    // Get 2nd-most-recent for each account (the one before the latest)
    const result = {}
    for (const [aid, snaps] of Object.entries(byAccount)) {
      const sorted = snaps.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
      if (sorted.length >= 2) result[aid] = sorted[1]
    }
    return result
  }, [history])

  const alerts = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) snapByAccount[s.account_id] = s

    const items = []

    for (const a of accounts) {
      const snap = snapByAccount[a.id]
      const prev = prevSnapByAccount[a.id]
      const sevenDaysAgo = new Date(referenceTime - rules.missing_data_days * 86400000).toISOString().split('T')[0]

      // Health issues
      if (rules.health_enabled && a.health !== 'Clean') {
        items.push({
          id: `health-${a.id}`,
          account: a,
          type: 'health',
          severity: a.health === 'Suspended' || a.health === 'Shadowbanned' ? 'critical' : 'warning',
          message: `Account is ${a.health}`,
          detail: `@${a.handle} (${a.platform}) — ${a.model?.name || 'Unknown model'}`
        })
      }

      // No data entered recently
      if (a.status === 'Active' && (!snap || snap.snapshot_date < sevenDaysAgo)) {
        items.push({
          id: `missing-${a.id}`,
          account: a,
          type: 'missing_data',
          severity: 'warning',
          message: `No snapshot data in last ${rules.missing_data_days} days`,
          detail: `@${a.handle} (${a.platform}) — Last data: ${snap?.snapshot_date || 'never'}`
        })
      }

      // VTFR below threshold
      if (snap && a.status === 'Active' && snap.vtfr_weekly != null && snap.vtfr_weekly < rules.vtfr_min && snap.vtfr_weekly > 0) {
        const vg = vtfrGrade(snap.vtfr_weekly)
        items.push({
          id: `vtfr-${a.id}`,
          account: a,
          type: 'low_vtfr',
          severity: snap.vtfr_weekly < rules.vtfr_min / 2 ? 'critical' : 'warning',
          message: `VTFR ${snap.vtfr_weekly.toFixed(1)}% — ${vg.label}`,
          detail: `@${a.handle} (${a.platform}) — threshold: ${rules.vtfr_min}%`
        })
      }

      // ER below threshold
      if (snap && a.status === 'Active' && snap.engagement_rate_weekly != null && snap.engagement_rate_weekly < rules.er_min && snap.engagement_rate_weekly > 0) {
        const eg = erGrade(snap.engagement_rate_weekly)
        items.push({
          id: `er-${a.id}`,
          account: a,
          type: 'low_er',
          severity: 'warning',
          message: `ER ${snap.engagement_rate_weekly.toFixed(2)}% — ${eg.label}`,
          detail: `@${a.handle} (${a.platform}) — threshold: ${rules.er_min}%`
        })
      }

      // Follower growth stall / decline
      if (snap && prev && a.status === 'Active' && snap.followers && prev.followers) {
        const growthPct = ((snap.followers - prev.followers) / prev.followers) * 100
        if (growthPct < rules.growth_min_pct) {
          items.push({
            id: `growth-${a.id}`,
            account: a,
            type: 'growth_stall',
            severity: growthPct < -10 ? 'critical' : 'warning',
            message: `Follower growth ${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`,
            detail: `@${a.handle} — ${formatNumber(prev.followers)} → ${formatNumber(snap.followers)}`
          })
        }
      }

      // Zero posts in last 7 days
      if (rules.zero_posts_enabled && snap && a.status === 'Active') {
        const totalPosts = (snap.ig_reels_posted_7d || 0) + (snap.ig_stories_posted_7d || 0)
          + (snap.tw_tweets_posted_7d || 0) + (snap.rd_posts_7d || 0) + (snap.tt_videos_posted_7d || 0)
        if (totalPosts === 0) {
          items.push({
            id: `zero-${a.id}`,
            account: a,
            type: 'zero_posts',
            severity: 'info',
            message: 'Zero posts in last 7 days',
            detail: `@${a.handle} (${a.platform})`
          })
        }
      }

      // Stale new account
      if (a.status === 'Active') {
        const daysSinceCreated = Math.floor((referenceTime - new Date(a.created_at).getTime()) / 86400000)
        if (daysSinceCreated > rules.stale_account_days && (!snap || (snap.followers || 0) < 10)) {
          items.push({
            id: `stale-${a.id}`,
            account: a,
            type: 'stale_new',
            severity: 'info',
            message: `Account >${rules.stale_account_days} days old with no meaningful metrics`,
            detail: `@${a.handle} — Created ${daysSinceCreated} days ago, ${snap?.followers || 0} followers`
          })
        }
      }
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 }
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    return items
  }, [accounts, snapshots, prevSnapByAccount, referenceTime, rules])

  const filtered = useMemo(() => {
    let result = alerts
    if (!showDismissed) result = result.filter(a => !dismissed.has(a.id))
    if (filter !== 'all') result = result.filter(a => a.type === filter)
    return result
  }, [alerts, filter, dismissed, showDismissed])

  const dismissAlert = (id) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem('ig_dismissed_alerts', JSON.stringify([...next]))
  }

  const undismissAll = () => {
    setDismissed(new Set())
    localStorage.removeItem('ig_dismissed_alerts')
  }

  const handleSaveRules = () => {
    saveAlertRules(rules)
    setShowSettings(false)
  }

  const severityStyles = {
    critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
    info: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' }
  }

  const activeAlerts = alerts.filter(a => !dismissed.has(a.id))

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Alerts & Flags</h1>
          <p>{activeAlerts.length} active alert(s), {dismissed.size} dismissed</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={16} /> Rules
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const rows = filtered.map(a => ({ handle: a.detail, type: a.type, severity: a.severity, message: a.message }))
            exportToCSV(rows, 'alerts.csv')
          }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Alert Rules Config */}
      {showSettings && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} /> Alert Thresholds
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <RuleField label="Min VTFR %" value={rules.vtfr_min} onChange={v => setRules({ ...rules, vtfr_min: Number(v) })} />
            <RuleField label="Min ER %" value={rules.er_min} onChange={v => setRules({ ...rules, er_min: Number(v) })} />
            <RuleField label="Min Follower Growth %" value={rules.growth_min_pct} onChange={v => setRules({ ...rules, growth_min_pct: Number(v) })} />
            <RuleField label="Missing Data (days)" value={rules.missing_data_days} onChange={v => setRules({ ...rules, missing_data_days: Number(v) })} />
            <RuleField label="Stale Account (days)" value={rules.stale_account_days} onChange={v => setRules({ ...rules, stale_account_days: Number(v) })} />
            <div>
              <label style={labelStyle}>Flags</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '4px' }}>
                <ToggleChip label="Health" active={rules.health_enabled} onClick={() => setRules({ ...rules, health_enabled: !rules.health_enabled })} />
                <ToggleChip label="Zero Posts" active={rules.zero_posts_enabled} onClick={() => setRules({ ...rules, zero_posts_enabled: !rules.zero_posts_enabled })} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setRules(DEFAULT_ALERT_RULES); saveAlertRules(DEFAULT_ALERT_RULES) }}>Reset Defaults</button>
            <button className="btn btn-primary" onClick={handleSaveRules}><Check size={16} /> Save Rules</button>
          </div>
        </div>
      )}

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterBadge label="All" count={activeAlerts.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterBadge label="Health" count={activeAlerts.filter(a => a.type === 'health').length} active={filter === 'health'} onClick={() => setFilter('health')} color="#ef4444" />
        <FilterBadge label="Low VTFR" count={activeAlerts.filter(a => a.type === 'low_vtfr').length} active={filter === 'low_vtfr'} onClick={() => setFilter('low_vtfr')} color="#f97316" />
        <FilterBadge label="Low ER" count={activeAlerts.filter(a => a.type === 'low_er').length} active={filter === 'low_er'} onClick={() => setFilter('low_er')} color="#eab308" />
        <FilterBadge label="Growth Stall" count={activeAlerts.filter(a => a.type === 'growth_stall').length} active={filter === 'growth_stall'} onClick={() => setFilter('growth_stall')} color="#ec4899" />
        <FilterBadge label="Missing Data" count={activeAlerts.filter(a => a.type === 'missing_data').length} active={filter === 'missing_data'} onClick={() => setFilter('missing_data')} color="#f59e0b" />
        <FilterBadge label="Zero Posts" count={activeAlerts.filter(a => a.type === 'zero_posts').length} active={filter === 'zero_posts'} onClick={() => setFilter('zero_posts')} color="#6366f1" />
        <FilterBadge label="Stale" count={activeAlerts.filter(a => a.type === 'stale_new').length} active={filter === 'stale_new'} onClick={() => setFilter('stale_new')} color="#8b5cf6" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setShowDismissed(!showDismissed)}>
            {showDismissed ? 'Hide' : 'Show'} Dismissed ({dismissed.size})
          </button>
          {dismissed.size > 0 && (
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={undismissAll}>
              Restore All
            </button>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map((alert) => {
          const s = severityStyles[alert.severity]
          const isDismissed = dismissed.has(alert.id)
          return (
            <div key={alert.id} style={{
              padding: '1rem 1.25rem', borderRadius: '12px', background: s.bg,
              border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '1rem',
              opacity: isDismissed ? 0.5 : 1,
            }}>
              <AlertTriangle size={20} color={s.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{alert.message}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>{alert.detail}</p>
              </div>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem',
                fontWeight: 700, textTransform: 'uppercase', color: s.color, background: 'rgba(0,0,0,0.2)'
              }}>
                {alert.severity}
              </span>
              {!isDismissed && (
                <button
                  className="icon-btn"
                  onClick={() => dismissAlert(alert.id)}
                  title="Dismiss"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="glass-panel flex-center" style={{ padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--accent-success)', fontSize: '1.1rem', fontWeight: 600 }}>All clear!</p>
            <p style={{ color: 'var(--text-tertiary)' }}>No alerts or flags at this time.</p>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }

function RuleField({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: '8px',
          border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)', fontSize: '0.875rem'
        }}
      />
    </div>
  )
}

function ToggleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem' }}
    >
      {active ? <Check size={12} /> : <X size={12} />} {label}
    </button>
  )
}

function FilterBadge({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '0.8rem' }}
    >
      {label}
      <span style={{
        marginLeft: '6px', padding: '0 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.2)' : (color ? `${color}22` : 'var(--bg-tertiary)'),
        color: active ? 'white' : (color || 'var(--text-secondary)')
      }}>
        {count}
      </span>
    </button>
  )
}
