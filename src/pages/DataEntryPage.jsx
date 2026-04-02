import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, Check, Save, Upload, RefreshCw } from 'lucide-react'
import { getModels, getAccounts, createSnapshot, createPosts, getSnapshots, getLinkMappings, saveLinkMapping } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { calcPostVTFR, calcPostER, calcWeeklyVTFR, calcWeeklyER, vtfrGrade, erGrade } from '../lib/metrics'
import { logAudit } from '../lib/automation'
import CSVImport from '../components/CSVImport'

const INSTAGRAM_SYNC_STORAGE_KEY = 'ig-dashboard-instagram-sync-runs'

const HEALTH_OPTIONS = {
  instagram: ['Clean', 'Shadowbanned', 'Restricted', 'Action Blocked'],
  twitter: ['Clean', 'Shadowbanned', 'Suspended', 'Limited'],
  reddit: ['Clean', 'Shadowbanned', 'Suspended', 'Karma Farming'],
  tiktok: ['Clean', 'Shadowbanned', 'Suspended', 'Under Review']
}

function loadPendingInstagramRuns() {
  try {
    const raw = window.localStorage.getItem(INSTAGRAM_SYNC_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePendingInstagramRuns(runs) {
  try {
    if (!runs.length) window.localStorage.removeItem(INSTAGRAM_SYNC_STORAGE_KEY)
    else window.localStorage.setItem(INSTAGRAM_SYNC_STORAGE_KEY, JSON.stringify(runs))
  } catch {
    // ignore localStorage failures
  }
}

function dedupeSyncDetails(details = []) {
  const byKey = new Map()
  for (const detail of details) {
    if (detail.action === 'started') {
      byKey.set('started', detail)
      continue
    }
    const key = [
      detail._platform || 'local',
      detail.handle || '',
      detail.action || '',
      detail.model || '',
    ].join(':')
    byKey.set(key, detail)
  }
  return Array.from(byKey.values())
}

function dedupeStrings(values = []) {
  return Array.from(new Set(values))
}

function getFollowerSourceLabel(source) {
  if (source === 'scraper') return 'fetched from scraper'
  if (source === 'saved-value') return 'used saved value'
  if (source === 'previous-snapshot') return 'used previous snapshot'
  if (source === 'missing') return 'followers unavailable from scraper'
  return ''
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
  const [ofDiscovery, setOfDiscovery] = useState({ connectedAccounts: [], errors: [] })

  // Per-post data (for Instagram VTFR/ER)
  const [posts, setPosts] = useState([])
  const [pendingInstagramRuns, setPendingInstagramRuns] = useState([])

  useEffect(() => {
    Promise.all([getModels(), getAccounts()])
      .then(([m, a]) => { setModels(m); setAccounts(a) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPendingInstagramRuns(loadPendingInstagramRuns())
  }, [])

  const filteredAccounts = useMemo(() => {
    if (!selectedModel) return accounts
    return accounts.filter(a => a.model_id === selectedModel)
  }, [accounts, selectedModel])

  const currentAccount = useMemo(() => accounts.find(a => a.id === selectedAccount), [accounts, selectedAccount])
  const displaySyncDetails = useMemo(() => dedupeSyncDetails(syncResults?.details || []), [syncResults])
  const displaySyncErrors = useMemo(() => dedupeStrings(syncResults?.errors || []), [syncResults])

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
          setOfDiscovery({
            connectedAccounts: data.connectedAccounts || [],
            errors: data.errors || [],
          })
          if (data.modelUpdates) console.warn('SYNC MASTER LOG:', JSON.stringify(data.modelUpdates, null, 2))
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

  const pollPendingInstagramRuns = async () => {
    const pendingRuns = loadPendingInstagramRuns()
    if (!pendingRuns.length) return

    const nextPending = []
    const progress = { synced: 0, skipped: 0, errors: [], details: [], pending: 0 }

    for (const run of pendingRuns) {
      try {
        const statusRes = await fetch('/.netlify/functions/sync-instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', runId: run.runId }),
        })
        const statusText = await statusRes.text()
        let statusData
        try { statusData = JSON.parse(statusText) } catch { throw new Error(`Non-JSON response (${statusRes.status}): ${statusText.slice(0, 500)}`) }
        if (!statusRes.ok) throw new Error(statusData.error || `Sync failed (${statusRes.status})`)

        const runStatus = statusData.status
        const datasetId = statusData.datasetId || run.datasetId

        if (runStatus === 'SUCCEEDED' || runStatus === 'SUCCEEDED_WITH_ERRORS') {
          const importRes = await fetch('/.netlify/functions/sync-instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'import', datasetId, handles: run.handles }),
          })
          const importText = await importRes.text()
          let importData
          try { importData = JSON.parse(importText) } catch { throw new Error(`Non-JSON response (${importRes.status}): ${importText.slice(0, 500)}`) }
          if (!importRes.ok) throw new Error(importData.error || `Sync failed (${importRes.status})`)

          progress.synced += importData.synced || 0
          progress.skipped += importData.skipped || 0
          if (importData.errors?.length) progress.errors.push(...importData.errors)
          if (importData.details?.length) progress.details.push(...importData.details)
        } else if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
          progress.errors.push(`Instagram scrape ${runStatus.toLowerCase()} for ${run.handles.join(', ')}`)
        } else {
          nextPending.push({ ...run, status: runStatus, datasetId })
        }
      } catch (err) {
        nextPending.push(run)
        progress.errors.push(`Instagram status check failed for ${run.handles.join(', ')}: ${err.message}`)
      }
    }

    savePendingInstagramRuns(nextPending)
    setPendingInstagramRuns(nextPending)
    progress.pending = nextPending.length

    if (progress.synced || progress.errors.length || progress.pending !== pendingRuns.length) {
      setSyncResults(prev => {
        const base = prev && prev.source === 'instagram-background'
          ? prev
          : { synced: 0, skipped: 0, errors: [], details: [], source: 'instagram-background' }

        return {
          ...base,
          synced: (base.synced || 0) + progress.synced,
          skipped: (base.skipped || 0) + progress.skipped,
          errors: dedupeStrings([...(base.errors || []), ...progress.errors]),
          details: dedupeSyncDetails([...(base.details || []), ...progress.details]),
          pending: progress.pending,
          source: 'instagram-background',
        }
      })
    }
  }

  useEffect(() => {
    if (entryMode !== 'api' || !pendingInstagramRuns.length) return
    pollPendingInstagramRuns()
    const interval = window.setInterval(() => {
      pollPendingInstagramRuns()
    }, 10000)
    return () => window.clearInterval(interval)
  }, [entryMode, pendingInstagramRuns.length])

  const handleApiSync = async (platform, options = {}) => {
    const { silent = false, manageSyncing = true } = options
    if (manageSyncing) setSyncing(true)
    if (!silent) setSyncResults(null)
    try {
      if (platform === 'instagram') {
        const instagramAccounts = accounts
          .filter(account => account.platform === 'instagram' && account.status === 'Active')
          .map(account => account.handle)

        const aggregated = { synced: 0, skipped: 0, errors: [], details: [], pending: 0, source: 'instagram-background' }
        const batchSize = 1

        for (let i = 0; i < instagramAccounts.length; i += batchSize) {
          const handles = instagramAccounts.slice(i, i + batchSize)

          const startRes = await fetch('/.netlify/functions/sync-instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start', handles }),
          })
          const startText = await startRes.text()
          let startData
          try { startData = JSON.parse(startText) } catch { throw new Error(`Non-JSON response (${startRes.status}): ${startText.slice(0, 500)}`) }
          if (!startRes.ok) throw new Error(startData.error || `Sync failed (${startRes.status})`)

          aggregated.pending += 1
          const pendingRuns = [...loadPendingInstagramRuns(), {
            runId: startData.runId,
            datasetId: startData.datasetId,
            handles,
            status: startData.status,
          }]
          savePendingInstagramRuns(pendingRuns)
          setPendingInstagramRuns(pendingRuns)
        }

        aggregated.details.push({ action: 'started', views_7d: null })
        if (!silent) setSyncResults(aggregated)
        logAudit({
          action: 'api_sync',
          entity_type: 'platform',
          entity_id: platform,
          details: `Instagram background sync started for ${aggregated.pending} account${aggregated.pending !== 1 ? 's' : ''}`,
          user_id: user?.id,
        })
        return aggregated
      }

      const fetchOpts = { method: 'POST' }
      if (platform === 'onlyfans') {
        fetchOpts.headers = { 'Content-Type': 'application/json' }
        fetchOpts.body = JSON.stringify({ action: 'sync' })
      }
      const res = await fetch(`/.netlify/functions/sync-${platform}`, fetchOpts)
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 500)}`) }
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`)
      if (!silent) setSyncResults(data)
      logAudit({
        action: 'api_sync',
        entity_type: 'platform',
        entity_id: platform,
        details: `API sync: ${data.synced} accounts updated, ${data.errors?.length || 0} errors`,
        user_id: user?.id,
      })
      return data
    } catch (err) {
      if (!silent) setSyncResults({ synced: 0, errors: [err.message] })
      throw err
    } finally {
      if (manageSyncing) setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    setSyncResults(null)
    const allResults = { synced: 0, errors: [], details: [] }
    for (const platform of ['instagram', 'twitter', 'twitter-views', 'reddit', 'tiktok-views', 'onlyfans']) {
      try {
        if (platform === 'instagram') {
          const data = await handleApiSync('instagram', { silent: true, manageSyncing: false })
          allResults.synced += data.synced || 0
          if (data.errors?.length) allResults.errors.push(...data.errors.map(e => `[${platform}] ${e}`))
          if (data.details?.length) allResults.details.push(...data.details.map(d => ({ ...d, _platform: platform })))
          continue
        }

        const fetchOpts = { method: 'POST' }
        if (platform === 'onlyfans') {
          fetchOpts.headers = { 'Content-Type': 'application/json' }
          fetchOpts.body = JSON.stringify({ action: 'sync' })
        }
        const res = await fetch(`/.netlify/functions/sync-${platform}`, fetchOpts)
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch { continue }
        allResults.synced += data.synced || 0
        if (data.errors?.length) allResults.errors.push(...data.errors.map(e => `[${platform}] ${e}`))
        if (data.details?.length) allResults.details.push(...data.details.map(d => ({ ...d, _platform: platform })))
        if (data.connectedAccountsList) allResults.connectedAccountsList = data.connectedAccountsList
      } catch (err) {
        allResults.errors.push(`[${platform}] ${err.message}`)
      }
    }
    setSyncResults(allResults)
    logAudit({
      action: 'api_sync',
      entity_type: 'platform',
      entity_id: 'all',
      details: `Sync All: ${allResults.synced} total synced, ${allResults.errors?.length || 0} errors`,
      user_id: user?.id,
    })
    setSyncing(false)
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
                        ofLinks={getScopedTrackingLinks(acc, models, ofLinks)}
                        discovery={ofDiscovery}
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
                              const filtered = prev.filter(m => m.account_id !== acc.id)
                              return [...filtered, saved]
                            })
                            try {
                              const syncData = await handleApiSync('onlyfans', { silent: true })
                              setSyncResults(syncData)
                            } catch (syncErr) {
                              setSyncResults({ synced: 0, errors: [`Mapping saved, but OnlyFans sync failed: ${syncErr.message}`] })
                            }
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

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleSyncAll}
              disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', padding: '0.65rem 1.5rem' }}
            >
              <RefreshCw size={18} className={syncing ? 'spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync All Platforms'}
            </button>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>or sync individually:</span>
            <button className="btn btn-secondary" onClick={() => handleApiSync('instagram')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Instagram</button>
            <button className="btn btn-secondary" onClick={() => handleApiSync('twitter')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Twitter/X</button>
            <button className="btn btn-secondary" onClick={() => handleApiSync('twitter-views')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Twitter Views</button>
            <button className="btn btn-secondary" onClick={() => handleApiSync('reddit')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Reddit</button>
            <button className="btn btn-secondary" onClick={() => handleApiSync('tiktok-views')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>TikTok Views</button>
            <button className="btn btn-secondary" onClick={() => handleApiSync('onlyfans')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>OnlyFans</button>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            Syncs run automatically every day at 6:00 AM UTC.
          </p>

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
                      {syncResults.pending > 0 && syncResults.synced === 0
                        ? `Instagram sync started for ${syncResults.pending} account${syncResults.pending !== 1 ? 's' : ''}`
                        : syncResults.synced > 0
                          ? `Synced ${syncResults.synced} account${syncResults.synced !== 1 ? 's' : ''}`
                          : 'Sync complete'}
                      {syncResults.skipped > 0 && `, ${syncResults.skipped} skipped`}
                    </p>
                    {syncResults.pending > 0 && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Instagram scraping is running in the background. Keep this page open and results will import automatically.
                      </p>
                    )}

                    {displaySyncDetails.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Details:</p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                          {displaySyncDetails.map((d, i) => (
                            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                              {d.action === 'started' && syncResults.pending > 0 && `Instagram background jobs queued`}
                              {d.handle && `@${d.handle} — ${d.action}`}
                              {d.followers != null && `, ${d.followers.toLocaleString()} followers`}
                              {d.karma != null && `, ${d.karma.toLocaleString()} karma`}
                              {d.views_7d != null && `, ${d.views_7d.toLocaleString()} views (7d)`}
                              {d.views_30d != null && `, ${d.views_30d.toLocaleString()} views (30d)`}
                              {d.views != null && !d.views_7d && `, ${d.views.toLocaleString()} views`}
                              {d.tweets_7d != null && `, ${d.tweets_7d} tweets`}
                              {d.tweets != null && !d.tweets_7d && `, ${d.tweets} tweets`}
                              {d.videos_7d != null && `, ${d.videos_7d} videos`}
                              {d.model && d.subscribers != null && `${d.model} (@${d.of_username || ''}) — ${d.subscribers.toLocaleString()} subscribers`}
                              {d.follower_source && <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>({getFollowerSourceLabel(d.follower_source)})</span>}
                              {!d.follower_source && d.warning && <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>({d.warning})</span>}
                              {d._platform && <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>[{d._platform}]</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncResults.connectedAccountsList?.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Connected OF accounts ({syncResults.connectedAccounts}):</p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                          {syncResults.connectedAccountsList.map((a, i) => (
                            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                              {a.display_name || '?'} — @{a.onlyfans_username || a.username || a.user_data_username || '?'} — {(a.subscribersCount || 0).toLocaleString()} subs
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {displaySyncErrors.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginBottom: '0.5rem' }}>Errors:</p>
                    {displaySyncErrors.map((e, i) => (
                      <p key={i} style={{ fontSize: '0.8rem', color: 'var(--accent-danger)' }}>{e}</p>
                    ))}
                  </div>
                )}

                {syncResults._debug && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Debug info</summary>
                    <pre style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto', marginTop: '0.5rem' }}>
                      {JSON.stringify(syncResults._debug, null, 2)}
                    </pre>
                  </details>
                )}
                {syncResults._authorsFound && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    Authors found in scrape: {syncResults._authorsFound.join(', ') || 'none'}
                  </p>
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

function normalizeTrackingToken(value) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/^@/, '')
    .replace(/\s+/g, '')
}

function getTrackingLinkModelSlug(link) {
  const url = (link?.campaignUrl || link?.url || link?.link || '')
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
  return url.match(/onlyfans\.com\/([^/?#]+)/i)?.[1] || ''
}

function getScopedTrackingLinks(account, models, ofLinks) {
  const model = models.find(m => m.id === account.model_id)
  const allowedSlugs = new Set([
    normalizeTrackingToken(account?.of_username_override),
    normalizeTrackingToken(model?.of_username),
    normalizeTrackingToken(model?.display_name),
    normalizeTrackingToken(model?.name),
  ].filter(Boolean))

  if (!allowedSlugs.size) return ofLinks

  return ofLinks.filter(link => allowedSlugs.has(getTrackingLinkModelSlug(link)))
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

function MappingInput({ acc, currentMapping, ofLinks, discovery, onSave }) {
  const [text, setText] = useState(currentMapping?.tracking_link_name || '')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setText(currentMapping?.tracking_link_name || '')
  }, [currentMapping?.tracking_link_name])

  const normalizedLinks = useMemo(() =>
    ofLinks.map(link => {
      const name = (link.campaignName || link.name || link.label || '').trim()
      const url = (link.campaignUrl || link.url || link.link || '').trim()
      const normalizedUrl = url.toLowerCase().replace(/\/$/, '')
      const shortCode = normalizedUrl.match(/\/(c\d+)(?:$|[/?#])/i)?.[1]?.toLowerCase() || ''
      const modelSlug = normalizedUrl.match(/onlyfans\.com\/([^/?#]+)/i)?.[1]?.toLowerCase() || ''

      return {
        ...link,
        name,
        url,
        normalizedName: name.toLowerCase(),
        normalizedUrl,
        shortCode,
        modelSlug,
      }
    }),
  [ofLinks])

  const filteredLinks = useMemo(() => {
    const query = text.toLowerCase().trim().replace(/\/$/, '')
    if (!query) return normalizedLinks.slice(0, 12)

    return normalizedLinks
      .filter(link =>
        link.normalizedName.includes(query) ||
        link.normalizedUrl.includes(query) ||
        link.shortCode.includes(query) ||
        link.modelSlug.includes(query)
      )
      .slice(0, 12)
  }, [normalizedLinks, text])

  const discoveryMessage = useMemo(() => {
    const targetSlug = normalizeTrackingToken(acc?.of_username_override || acc?.model?.of_username || acc?.model?.display_name || acc?.model?.name)
    if (!targetSlug) return null

    const connected = (discovery?.connectedAccounts || []).find(account =>
      normalizeTrackingToken(account.username) === targetSlug
    )
    if (!connected) return `No connected OF account found for @${targetSlug}.`

    const relatedError = (discovery?.errors || []).find(error =>
      error.toLowerCase().includes(targetSlug) || error.toLowerCase().includes(connected.name?.toLowerCase?.() || '')
    )
    if (relatedError && relatedError.includes('NEEDS_REAUTHENTICATION')) {
      return `@${targetSlug} needs re-authentication in OnlyFansAPI.`
    }

    if (!normalizedLinks.length) {
      return `Connected OF account found for @${targetSlug}, but 0 tracking links were returned.`
    }

    return null
  }, [acc, discovery, normalizedLinks.length])

  const selectLink = (link) => {
    setText(link.name || link.url)
    setIsOpen(false)
    onSave(link.name || link.url, link)
  }

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    setIsOpen(true)

    if (val.includes('onlyfans.com') && val.length > 25) {
      console.warn('URL pasted but NOT FOUND natively in the API downloaded tracking links: ', val)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={text}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150)
        }}
        placeholder="Search & select tracking link..."
        style={inputStyle}
      />
      {isOpen && filteredLinks.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 20,
          maxHeight: '260px',
          overflowY: 'auto',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
        }}>
          {filteredLinks.map((link, i) => (
            <button
              key={`${link.name}-${link.url}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectLink(link)}
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                border: 'none',
                borderBottom: i === filteredLinks.length - 1 ? 'none' : '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{link.name || 'Unnamed link'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{link.url}</div>
            </button>
          ))}
        </div>
      )}
      {isOpen && filteredLinks.length === 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '0.8rem 0.9rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-tertiary)',
          fontSize: '0.8rem',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
        }}>
          No matching tracking links for this account.
        </div>
      )}
      {discoveryMessage && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {discoveryMessage}
        </div>
      )}
    </div>
  )
}
