import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, Check, Save, Upload, RefreshCw } from 'lucide-react'
import { getModels, getAccounts, createSnapshot, createPosts, getSnapshots, getLinkMappings, saveLinkMapping } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { calcPostVTFR, calcPostER, calcWeeklyVTFR, calcWeeklyER, vtfrGrade, erGrade } from '../lib/metrics'
import { logAudit } from '../lib/automation'
import CSVImport from '../components/CSVImport'

const HEALTH_OPTIONS = {
  instagram: ['Clean', 'Shadowbanned', 'Restricted', 'Action Blocked'],
  twitter: ['Clean', 'Shadowbanned', 'Suspended', 'Limited'],
  reddit: ['Clean', 'Shadowbanned', 'Suspended', 'Karma Farming'],
  tiktok: ['Clean', 'Shadowbanned', 'Suspended', 'Under Review']
}

export default function DataEntryPage() {
  const { user } = useAuth()
  const [models, setModels] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previousSnapshot, setPreviousSnapshot] = useState(null)
  const [entryMode, setEntryMode] = useState('manual')

  // Snapshot form state
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0])
  const [health, setHealth] = useState('Clean')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState({})

  // API sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState(null)

  // OnlyFans Mapping state
  const [ofLinks, setOfLinks] = useState([])
  const [ofMappings, setOfMappings] = useState([])
  const [loadingLinks, setLoadingLinks] = useState(false)

  // Per-post data (for Instagram VTFR/ER)
  const [posts, setPosts] = useState([])

  useEffect(() => {
    Promise.all([getModels(), getAccounts()])
      .then(([m, a]) => { setModels(m); setAccounts(a) })
      .finally(() => setLoading(false))
  }, [])

  const filteredAccounts = useMemo(() => {
    if (!selectedModel) return accounts
    return accounts.filter(a => a.model_id === selectedModel)
  }, [accounts, selectedModel])

  const currentAccount = useMemo(() => accounts.find(a => a.id === selectedAccount), [accounts, selectedAccount])

  useEffect(() => {
    if (entryMode === 'api-mapping') {
      const loadOFTab = async () => {
        setLoadingLinks(true)
        try {
          const maps = await getLinkMappings()
          setOfMappings(maps || [])
          
          const res = await fetch('/.netlify/functions/sync-onlyfans', { 
            method: 'POST', 
            body: JSON.stringify({ action: 'discover' }) 
          })
          const data = await res.json()
          if (data.connectedAccounts) console.warn('OF RAW JSON:', JSON.stringify(data.connectedAccounts.map(a => a.rawAccount).slice(0, 2), null, 2))
          if (data.trackingLinks) setOfLinks(data.trackingLinks)
        } catch (e) {
          console.error(e)
        } finally {
          setLoadingLinks(false)
        }
      }
      loadOFTab()
    }
  }, [entryMode])

  // Load previous snapshot when account changes
  useEffect(() => {
    if (!selectedAccount) { setPreviousSnapshot(null); return }
    getSnapshots(selectedAccount, 1).then(snaps => {
      if (snaps.length) {
        setPreviousSnapshot(snaps[0])
        // Pre-fill fields from previous snapshot
        const prev = snaps[0]
        setFields(prev)
        setHealth(currentAccount?.health || 'Clean')
      } else {
        setPreviousSnapshot(null)
        setFields({})
      }
    })
    setPosts([])
    setSaved(false)
  }, [selectedAccount])

  const platform = currentAccount?.platform

  const addPost = () => {
    setPosts([...posts, { views: '', likes: '', comments: '', shares: '', saves: '' }])
  }

  const updatePost = (index, key, value) => {
    const updated = [...posts]
    updated[index] = { ...updated[index], [key]: value }
    setPosts(updated)
  }

  const removePost = (index) => {
    setPosts(posts.filter((_, i) => i !== index))
  }

  // Live VTFR/ER calculations
  const postCalcs = useMemo(() => {
    const followers = Number(fields.followers) || 0
    return posts.map(p => {
      const views = Number(p.views) || 0
      const post = { views, likes: Number(p.likes) || 0, comments: Number(p.comments) || 0, shares: Number(p.shares) || 0, saves: Number(p.saves) || 0 }
      return {
        vtfr: calcPostVTFR(views, followers),
        er: calcPostER(post)
      }
    })
  }, [posts, fields.followers])

  const weeklyVTFR = useMemo(() => {
    if (!posts.length) return 0
    const followers = Number(fields.followers) || 0
    const parsedPosts = posts.map(p => ({ views: Number(p.views) || 0 }))
    return calcWeeklyVTFR(parsedPosts, followers)
  }, [posts, fields.followers])

  const weeklyER = useMemo(() => {
    if (!posts.length) return 0
    const parsedPosts = posts.map(p => ({
      views: Number(p.views) || 0, likes: Number(p.likes) || 0,
      comments: Number(p.comments) || 0, shares: Number(p.shares) || 0, saves: Number(p.saves) || 0
    }))
    return calcWeeklyER(parsedPosts)
  }, [posts])

  const handleSave = async () => {
    if (!selectedAccount) return
    setSaving(true)
    try {
      const snapshotData = {
        account_id: selectedAccount,
        snapshot_date: snapshotDate,
        captured_by: 'Manual',
        created_by: user.id,
        notes,
        followers: Number(fields.followers) || null,
        following: Number(fields.following) || null,
      }

      // Platform-specific fields
      if (platform === 'instagram') {
        Object.assign(snapshotData, {
          ig_views_7d: Number(fields.ig_views_7d) || null,
          ig_views_30d: Number(fields.ig_views_30d) || null,
          ig_views_90d: Number(fields.ig_views_90d) || null,
          ig_reach_7d: Number(fields.ig_reach_7d) || null,
          ig_profile_visits_7d: Number(fields.ig_profile_visits_7d) || null,
          ig_link_clicks_7d: Number(fields.ig_link_clicks_7d) || null,
          ig_reels_posted_7d: Number(fields.ig_reels_posted_7d) || null,
          ig_stories_posted_7d: Number(fields.ig_stories_posted_7d) || null,
          ig_top_reel_views: Number(fields.ig_top_reel_views) || null,
          vtfr_weekly: weeklyVTFR || null,
          engagement_rate_weekly: weeklyER || null,
        })
      } else if (platform === 'twitter') {
        Object.assign(snapshotData, {
          tw_impressions_7d: Number(fields.tw_impressions_7d) || null,
          tw_views_7d: Number(fields.tw_views_7d) || null,
          tw_retweets_7d: Number(fields.tw_retweets_7d) || null,
          tw_likes_7d: Number(fields.tw_likes_7d) || null,
          tw_replies_7d: Number(fields.tw_replies_7d) || null,
          tw_link_clicks_7d: Number(fields.tw_link_clicks_7d) || null,
          tw_tweets_posted_7d: Number(fields.tw_tweets_posted_7d) || null,
          tw_dms_sent_7d: Number(fields.tw_dms_sent_7d) || null,
          tw_dm_response_rate: Number(fields.tw_dm_response_rate) || null,
        })
      } else if (platform === 'reddit') {
        Object.assign(snapshotData, {
          rd_karma_total: Number(fields.rd_karma_total) || null,
          rd_posts_7d: Number(fields.rd_posts_7d) || null,
          rd_avg_upvotes_7d: Number(fields.rd_avg_upvotes_7d) || null,
          rd_total_views_7d: Number(fields.rd_total_views_7d) || null,
          rd_comments_received_7d: Number(fields.rd_comments_received_7d) || null,
          rd_top_post_upvotes: Number(fields.rd_top_post_upvotes) || null,
          rd_link_clicks_7d: Number(fields.rd_link_clicks_7d) || null,
          rd_subreddits_posted_7d: Number(fields.rd_subreddits_posted_7d) || null,
          rd_account_age_days: Number(fields.rd_account_age_days) || null,
          rd_ban_log: fields.rd_ban_log || null,
        })
      } else if (platform === 'tiktok') {
        Object.assign(snapshotData, {
          tt_views_7d: Number(fields.tt_views_7d) || null,
          tt_likes_7d: Number(fields.tt_likes_7d) || null,
          tt_comments_7d: Number(fields.tt_comments_7d) || null,
          tt_shares_7d: Number(fields.tt_shares_7d) || null,
          tt_videos_posted_7d: Number(fields.tt_videos_posted_7d) || null,
          tt_avg_watch_time: Number(fields.tt_avg_watch_time) || null,
          tt_profile_views_7d: Number(fields.tt_profile_views_7d) || null,
          tt_link_clicks_7d: Number(fields.tt_link_clicks_7d) || null,
          tt_live_hours_7d: Number(fields.tt_live_hours_7d) || null,
          tt_live_peak_viewers: Number(fields.tt_live_peak_viewers) || null,
        })
      }

      const snapshot = await createSnapshot(snapshotData)

      // Save per-post data
      if (posts.length > 0) {
        const postRows = posts.map((p, i) => ({
          snapshot_id: snapshot.id,
          account_id: selectedAccount,
          platform,
          post_index: i + 1,
          views: Number(p.views) || 0,
          likes: Number(p.likes) || 0,
          comments: Number(p.comments) || 0,
          shares: Number(p.shares) || 0,
          saves: Number(p.saves) || 0,
          vtfr: postCalcs[i]?.vtfr || 0,
          engagement_rate: postCalcs[i]?.er || 0,
        }))
        await createPosts(postRows)
      }

      setSaved(true)
      logAudit({
        action: 'create_snapshot',
        entity_type: 'snapshot',
        entity_id: selectedAccount,
        details: `Manual snapshot for @${currentAccount?.handle} on ${snapshotDate}`,
        user_id: user?.id,
      })
    } catch (err) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndNext = async () => {
    await handleSave()
    // Move to next account in the filtered list
    const currentIdx = filteredAccounts.findIndex(a => a.id === selectedAccount)
    if (currentIdx < filteredAccounts.length - 1) {
      setSelectedAccount(filteredAccounts[currentIdx + 1].id)
    }
  }

  const handleApiSync = async (platform) => {
    setSyncing(true)
    setSyncResults(null)
    try {
      const res = await fetch(`/.netlify/functions/sync-${platform}`, { method: 'POST' })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 500)}`) }
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`)
      setSyncResults(data)
      logAudit({
        action: 'api_sync',
        entity_type: 'platform',
        entity_id: platform,
        details: `API sync: ${data.synced} accounts updated, ${data.errors?.length || 0} errors`,
        user_id: user?.id,
      })
    } catch (err) {
      setSyncResults({ synced: 0, errors: [err.message] })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Data Entry</h1>
          <p>Log daily/weekly metrics for accounts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${entryMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEntryMode('manual')}>
            Manual Entry
          </button>
          <button className={`btn ${entryMode === 'csv' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEntryMode('csv')}>
            <Upload size={16} /> CSV Import
          </button>
          <button className={`btn ${entryMode === 'api' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEntryMode('api')}>
            <RefreshCw size={16} /> API Sync
          </button>
          <button className={`btn ${entryMode === 'api-mapping' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEntryMode('api-mapping')}>
            Map OF Links
          </button>
        </div>
      </div>

      {entryMode === 'csv' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Bulk CSV Import</h3>
          <CSVImport accounts={accounts} userId={user?.id} onComplete={() => {}} />
        </div>
      )}

      {entryMode === 'api-mapping' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Map OnlyFans Tracking Links</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Assign tracking links to your social media accounts. Search by tracking name or URL. Only mapped links are synced.
          </p>

          {loadingLinks ? (
            <div className="flex-center" style={{ padding: '3rem' }}>
              <div className="loader" />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {accounts.map(acc => {
                const currentMapping = ofMappings.find(m => m.account_id === acc.id)
                return (
                  <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>@{acc.handle}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                        {acc.platform} • {acc.model?.name || 'Unknown Model'}
                      </span>
                      {acc.platform === 'twitter' && <a href={`https://twitter.com/${acc.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '2px' }}>View Profile ↗</a>}
                      {acc.platform === 'reddit' && <a href={`https://reddit.com/user/${acc.handle.replace('u/', '')}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '2px' }}>View Profile ↗</a>}
                      {acc.platform === 'instagram' && <a href={`https://instagram.com/${acc.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '2px' }}>View Profile ↗</a>}
                      {acc.platform === 'tiktok' && <a href={`https://tiktok.com/@${acc.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '2px' }}>View Profile ↗</a>}
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>OF Tracking Link</label>
                      <MappingInput 
                        acc={acc}
                        currentMapping={currentMapping}
                        ofLinks={ofLinks}
                        onSave={async (linkName, linkDetails) => {
                          const newMap = {
                            tracking_link_name: linkName,
                            tracking_link_url: linkDetails.url || '',
                            model_id: acc.model_id,
                            account_id: acc.id
                          }
                          try {
                            const saved = await saveLinkMapping(newMap)
                            setOfMappings(prev => {
                              const filtered = prev.filter(m => m.account_id !== acc.id && m.tracking_link_name !== linkName)
                              return [...filtered, saved]
                            })
                          } catch (err) {
                            alert("Error saving: " + err.message)
                          }
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {entryMode === 'api' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>API Sync</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Pull follower counts and metrics from platform APIs for all active accounts. Creates a snapshot for today.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleApiSync('twitter')}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Twitter/X'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleApiSync('reddit')}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Reddit'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleApiSync('onlyfans')}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync OnlyFans'}
            </button>
          </div>

          {syncResults && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                background: syncResults.errors?.length && !syncResults.synced && !syncResults.trackingLinks ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${syncResults.errors?.length && !syncResults.synced && !syncResults.trackingLinks ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}>
                {/* Discover mode results */}
                {syncResults.action === 'discover' && (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      OnlyFans Discovery: {syncResults.trackingLinks?.length || 0} tracking link(s) found
                    </p>
                    {syncResults.connectedAccounts?.length > 0 && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Connected accounts: {syncResults.connectedAccounts.map(a => a.name || a.id).join(', ')}
                      </p>
                    )}
                    {syncResults.trackingLinks?.length > 0 && (
                      <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.8rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px' }}>Link Name</th>
                              <th style={{ padding: '6px 8px' }}>Clicks</th>
                              <th style={{ padding: '6px 8px' }}>Subs</th>
                              <th style={{ padding: '6px 8px' }}>Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {syncResults.trackingLinks.map((l, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 8px' }}>{l.name}</td>
                                <td style={{ padding: '6px 8px' }}>{(l.clicks || 0).toLocaleString()}</td>
                                <td style={{ padding: '6px 8px' }}>{(l.subscribers || 0).toLocaleString()}</td>
                                <td style={{ padding: '6px 8px' }}>${(l.revenue || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {syncResults.trackingLinks?.length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>
                        This is discovery mode — data is not saved yet. Review the links above, then use full sync to save.
                      </p>
                    )}
                  </>
                )}

                {/* Normal sync results */}
                {syncResults.action !== 'discover' && (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {syncResults.synced > 0 ? `Synced ${syncResults.synced} account${syncResults.synced !== 1 ? 's' : ''}` : 'Sync complete'}
                      {syncResults.skipped > 0 && `, ${syncResults.skipped} skipped`}
                    </p>

                    {syncResults.details?.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Details:</p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                          {syncResults.details.map((d, i) => (
                            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                              {d.handle ? `@${d.handle} — ${d.action}, ` : ''}
                              {d.followers != null ? `${d.followers.toLocaleString()} followers` : d.karma != null ? `${d.karma.toLocaleString()} karma` : ''}
                              {d.link ? `${d.model}: ${d.link} — ${d.clicks} clicks, ${d.subscribers} subs, $${d.revenue}` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncResults.unmapped?.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Unmapped links (no model match):</p>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem' }}>
                          {syncResults.unmapped.map((u, i) => (
                            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                              {u.name} — {u.clicks} clicks, {u.subscribers} subs, ${u.revenue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {syncResults.errors?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginBottom: '0.5rem' }}>Errors:</p>
                    {syncResults.errors.map((e, i) => (
                      <p key={i} style={{ fontSize: '0.8rem', color: 'var(--accent-danger)' }}>{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {entryMode === 'manual' && (<>
      {/* Rest of manual entry form */}

      {/* Account selector */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Model</label>
          <select value={selectedModel} onChange={e => { setSelectedModel(e.target.value); setSelectedAccount('') }} style={inputStyle}>
            <option value="">All Models</option>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 2, minWidth: '250px' }}>
          <label style={labelStyle}>Account</label>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={inputStyle}>
            <option value="">Select an account</option>
            {filteredAccounts.map(a => (
              <option key={a.id} value={a.id}>@{a.handle} ({a.platform}{a.account_type ? ` · ${a.account_type}` : ''}){a.model?.name ? ` — ${a.model.name}` : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: '160px' }}>
          <label style={labelStyle}>Snapshot Date</label>
          <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {!selectedAccount && (
        <div className="glass-panel flex-center" style={{ padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>Select a model and account to begin entering data.</p>
        </div>
      )}

      {selectedAccount && currentAccount && (
        <>
          {/* Account Health */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Account Health</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(HEALTH_OPTIONS[platform] || ['Clean']).map(h => (
                <button
                  key={h}
                  className={`btn ${health === h ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '6px 16px' }}
                  onClick={() => setHealth(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Platform-specific metrics form */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>{platform} Metrics</h3>

            {/* Common fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <NumField label="Followers" value={fields.followers} prev={previousSnapshot?.followers} onChange={v => setFields({ ...fields, followers: v })} />
              {platform === 'instagram' && (
                <>
                  <NumField label="Following" value={fields.following} prev={previousSnapshot?.following} onChange={v => setFields({ ...fields, following: v })} />
                  <NumField label="Views (7d)" value={fields.ig_views_7d} prev={previousSnapshot?.ig_views_7d} onChange={v => setFields({ ...fields, ig_views_7d: v })} />
                  <NumField label="Views (30d)" value={fields.ig_views_30d} prev={previousSnapshot?.ig_views_30d} onChange={v => setFields({ ...fields, ig_views_30d: v })} />
                  <NumField label="Views (90d)" value={fields.ig_views_90d} prev={previousSnapshot?.ig_views_90d} onChange={v => setFields({ ...fields, ig_views_90d: v })} />
                  <NumField label="Reach (7d)" value={fields.ig_reach_7d} prev={previousSnapshot?.ig_reach_7d} onChange={v => setFields({ ...fields, ig_reach_7d: v })} />
                  <NumField label="Profile Visits (7d)" value={fields.ig_profile_visits_7d} prev={previousSnapshot?.ig_profile_visits_7d} onChange={v => setFields({ ...fields, ig_profile_visits_7d: v })} />
                  <NumField label="Link Clicks (7d)" value={fields.ig_link_clicks_7d} prev={previousSnapshot?.ig_link_clicks_7d} onChange={v => setFields({ ...fields, ig_link_clicks_7d: v })} />
                  <NumField label="Reels Posted (7d)" value={fields.ig_reels_posted_7d} prev={previousSnapshot?.ig_reels_posted_7d} onChange={v => setFields({ ...fields, ig_reels_posted_7d: v })} />
                  <NumField label="Stories Posted (7d)" value={fields.ig_stories_posted_7d} prev={previousSnapshot?.ig_stories_posted_7d} onChange={v => setFields({ ...fields, ig_stories_posted_7d: v })} />
                  <NumField label="Top Reel Views" value={fields.ig_top_reel_views} prev={previousSnapshot?.ig_top_reel_views} onChange={v => setFields({ ...fields, ig_top_reel_views: v })} />
                </>
              )}
              {platform === 'twitter' && (
                <>
                  <NumField label="Impressions (7d)" value={fields.tw_impressions_7d} prev={previousSnapshot?.tw_impressions_7d} onChange={v => setFields({ ...fields, tw_impressions_7d: v })} />
                  <NumField label="Views (7d)" value={fields.tw_views_7d} prev={previousSnapshot?.tw_views_7d} onChange={v => setFields({ ...fields, tw_views_7d: v })} />
                  <NumField label="Retweets (7d)" value={fields.tw_retweets_7d} prev={previousSnapshot?.tw_retweets_7d} onChange={v => setFields({ ...fields, tw_retweets_7d: v })} />
                  <NumField label="Likes (7d)" value={fields.tw_likes_7d} prev={previousSnapshot?.tw_likes_7d} onChange={v => setFields({ ...fields, tw_likes_7d: v })} />
                  <NumField label="Replies (7d)" value={fields.tw_replies_7d} prev={previousSnapshot?.tw_replies_7d} onChange={v => setFields({ ...fields, tw_replies_7d: v })} />
                  <NumField label="Link Clicks (7d)" value={fields.tw_link_clicks_7d} prev={previousSnapshot?.tw_link_clicks_7d} onChange={v => setFields({ ...fields, tw_link_clicks_7d: v })} />
                  <NumField label="Tweets Posted (7d)" value={fields.tw_tweets_posted_7d} prev={previousSnapshot?.tw_tweets_posted_7d} onChange={v => setFields({ ...fields, tw_tweets_posted_7d: v })} />
                  <NumField label="DMs Sent (7d)" value={fields.tw_dms_sent_7d} prev={previousSnapshot?.tw_dms_sent_7d} onChange={v => setFields({ ...fields, tw_dms_sent_7d: v })} />
                  <NumField label="DM Response Rate %" value={fields.tw_dm_response_rate} prev={previousSnapshot?.tw_dm_response_rate} onChange={v => setFields({ ...fields, tw_dm_response_rate: v })} />
                </>
              )}
              {platform === 'reddit' && (
                <>
                  <NumField label="Karma (Total)" value={fields.rd_karma_total} prev={previousSnapshot?.rd_karma_total} onChange={v => setFields({ ...fields, rd_karma_total: v })} />
                  <NumField label="Posts (7d)" value={fields.rd_posts_7d} prev={previousSnapshot?.rd_posts_7d} onChange={v => setFields({ ...fields, rd_posts_7d: v })} />
                  <NumField label="Avg Upvotes (7d)" value={fields.rd_avg_upvotes_7d} prev={previousSnapshot?.rd_avg_upvotes_7d} onChange={v => setFields({ ...fields, rd_avg_upvotes_7d: v })} />
                  <NumField label="Total Views (7d)" value={fields.rd_total_views_7d} prev={previousSnapshot?.rd_total_views_7d} onChange={v => setFields({ ...fields, rd_total_views_7d: v })} />
                  <NumField label="Comments Received (7d)" value={fields.rd_comments_received_7d} prev={previousSnapshot?.rd_comments_received_7d} onChange={v => setFields({ ...fields, rd_comments_received_7d: v })} />
                  <NumField label="Top Post Upvotes" value={fields.rd_top_post_upvotes} prev={previousSnapshot?.rd_top_post_upvotes} onChange={v => setFields({ ...fields, rd_top_post_upvotes: v })} />
                  <NumField label="Link Clicks (7d)" value={fields.rd_link_clicks_7d} prev={previousSnapshot?.rd_link_clicks_7d} onChange={v => setFields({ ...fields, rd_link_clicks_7d: v })} />
                  <NumField label="Subreddits Posted (7d)" value={fields.rd_subreddits_posted_7d} prev={previousSnapshot?.rd_subreddits_posted_7d} onChange={v => setFields({ ...fields, rd_subreddits_posted_7d: v })} />
                  <NumField label="Account Age (Days)" value={fields.rd_account_age_days} prev={previousSnapshot?.rd_account_age_days} onChange={v => setFields({ ...fields, rd_account_age_days: v })} />
                </>
              )}
              {platform === 'tiktok' && (
                <>
                  <NumField label="Views (7d)" value={fields.tt_views_7d} prev={previousSnapshot?.tt_views_7d} onChange={v => setFields({ ...fields, tt_views_7d: v })} />
                  <NumField label="Likes (7d)" value={fields.tt_likes_7d} prev={previousSnapshot?.tt_likes_7d} onChange={v => setFields({ ...fields, tt_likes_7d: v })} />
                  <NumField label="Comments (7d)" value={fields.tt_comments_7d} prev={previousSnapshot?.tt_comments_7d} onChange={v => setFields({ ...fields, tt_comments_7d: v })} />
                  <NumField label="Shares (7d)" value={fields.tt_shares_7d} prev={previousSnapshot?.tt_shares_7d} onChange={v => setFields({ ...fields, tt_shares_7d: v })} />
                  <NumField label="Videos Posted (7d)" value={fields.tt_videos_posted_7d} prev={previousSnapshot?.tt_videos_posted_7d} onChange={v => setFields({ ...fields, tt_videos_posted_7d: v })} />
                  <NumField label="Avg Watch Time (sec)" value={fields.tt_avg_watch_time} prev={previousSnapshot?.tt_avg_watch_time} onChange={v => setFields({ ...fields, tt_avg_watch_time: v })} />
                  <NumField label="Profile Views (7d)" value={fields.tt_profile_views_7d} prev={previousSnapshot?.tt_profile_views_7d} onChange={v => setFields({ ...fields, tt_profile_views_7d: v })} />
                  <NumField label="Link Clicks (7d)" value={fields.tt_link_clicks_7d} prev={previousSnapshot?.tt_link_clicks_7d} onChange={v => setFields({ ...fields, tt_link_clicks_7d: v })} />
                  <NumField label="Live Hours (7d)" value={fields.tt_live_hours_7d} prev={previousSnapshot?.tt_live_hours_7d} onChange={v => setFields({ ...fields, tt_live_hours_7d: v })} />
                  <NumField label="Live Peak Viewers" value={fields.tt_live_peak_viewers} prev={previousSnapshot?.tt_live_peak_viewers} onChange={v => setFields({ ...fields, tt_live_peak_viewers: v })} />
                </>
              )}
            </div>
          </div>

          {/* Reddit ban log (special text field) */}
          {platform === 'reddit' && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <label style={labelStyle}>Ban Log</label>
              <textarea
                value={fields.rd_ban_log || ''}
                onChange={e => setFields({ ...fields, rd_ban_log: e.target.value })}
                rows={3}
                placeholder="Subreddit, date, reason, permanent/temp..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          )}

          {/* Per-post entry (Instagram required, others recommended) */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3>Post-Level Data {platform === 'instagram' && <span style={{ color: 'var(--accent-warning)', fontSize: '0.75rem' }}>(Required for VTFR/ER)</span>}</h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Enter each post published this week. System calculates VTFR and ER per post + weekly averages.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={addPost}>
                <Plus size={16} /> Add Post
              </button>
            </div>

            {posts.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="accounts-table" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Shares</th>
                      <th>Saves</th>
                      <th className="numeric">VTFR</th>
                      <th className="numeric">ER</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post, i) => {
                      const calc = postCalcs[i] || {}
                      const vg = vtfrGrade(calc.vtfr || 0)
                      const eg = erGrade(calc.er || 0)
                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                          <td><input type="number" min="0" value={post.views} onChange={e => updatePost(i, 'views', e.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.likes} onChange={e => updatePost(i, 'likes', e.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.comments} onChange={e => updatePost(i, 'comments', e.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.shares} onChange={e => updatePost(i, 'shares', e.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.saves} onChange={e => updatePost(i, 'saves', e.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td className="numeric">
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: vg.color, background: vg.bg }}>
                              {(calc.vtfr || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="numeric">
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: eg.color, background: eg.bg }}>
                              {(calc.er || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td>
                            <button className="icon-btn" onClick={() => removePost(i)} style={{ color: 'var(--accent-danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Weekly averages */}
            {posts.length > 0 && (
              <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Weekly Avg VTFR</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: vtfrGrade(weeklyVTFR).color }}>
                    {weeklyVTFR.toFixed(1)}%
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 500 }}>{vtfrGrade(weeklyVTFR).label}</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Weekly Avg ER</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: erGrade(weeklyER).color }}>
                    {weeklyER.toFixed(2)}%
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 500 }}>{erGrade(weeklyER).label}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <label style={labelStyle}>Notes (anomalies, bans, context)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any context for this snapshot..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Save buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-success)', fontWeight: 600, fontSize: '0.875rem' }}>
                <Check size={18} /> Saved!
              </span>
            )}
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
              <ChevronRight size={16} /> {saving ? 'Saving...' : 'Save & Next'}
            </button>
          </div>
        </>
      )}
      </>)}
    </div>
  )
}

const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '0.875rem'
}
const cellInputStyle = {
  width: '80px', padding: '6px 8px', borderRadius: '6px',
  border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', fontSize: '0.8rem', textAlign: 'right'
}

function NumField({ label, value, prev, onChange }) {
  const displayPrev = prev != null && prev !== '' ? `prev: ${prev}` : null
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={displayPrev || '0'}
        style={inputStyle}
      />
      {displayPrev && (
        <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{displayPrev}</p>
      )}
    </div>
  )
}

function MappingInput({ acc, currentMapping, ofLinks, onSave }) {
  const [text, setText] = useState(currentMapping?.tracking_link_name || '')

  useEffect(() => {
    setText(currentMapping?.tracking_link_name || '')
  }, [currentMapping?.tracking_link_name])

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    
    const cleanVal = val.toLowerCase().trim().replace(/\/$/, '')
    
    const linkDetails = ofLinks.find(l => {
      const lName = (l.campaignName || l.name || l.label || '').toLowerCase().trim()
      const lUrl = (l.campaignUrl || l.url || l.link || '').toLowerCase().trim().replace(/\/$/, '')
      
      return lName === cleanVal || lUrl === cleanVal || (cleanVal.includes('onlyfans.com') && lUrl.includes(cleanVal))
    })
    
    if (linkDetails) {
      const lName = linkDetails.campaignName || linkDetails.name || linkDetails.label
      setText(lName)
      onSave(lName, linkDetails)
    } else if (val.includes('onlyfans.com') && val.length > 25) {
      console.warn('URL pasted but NOT FOUND natively in the API downloaded tracking links: ', val)
    }
  }

  return (
    <>
      <input 
        list={`ofLinksList-${acc.id}`}
        value={text}
        onChange={handleChange}
        placeholder="Search & select tracking link..."
        style={inputStyle}
      />
      <datalist id={`ofLinksList-${acc.id}`}>
        {ofLinks.map((l, i) => {
          const lName = l.campaignName || l.name || l.label || ''
          const lUrl = l.campaignUrl || l.url || l.link || ''
          return (
            <option key={i} value={lName}>
              {lUrl}
            </option>
          )
        })}
      </datalist>
    </>
  )
}
