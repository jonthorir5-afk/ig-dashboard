import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Upload } from 'lucide-react'
import CSVImport from '../components/CSVImport'
import { useAuth } from '../contexts/useAuth'
import { getDisplayHandle } from '../lib/accountDisplay'
import { logAudit } from '../lib/automation'
import {
  createPosts,
  createSnapshot,
  getAccounts,
  getLinkMappings,
  getModels,
  getSnapshots,
  saveLinkMapping,
} from '../lib/api'
import { calcPostER, calcPostVTFR, calcWeeklyER, calcWeeklyVTFR } from '../lib/metrics'
import ApiSyncPanel from './data-entry/ApiSyncPanel'
import ManualEntryPanel from './data-entry/ManualEntryPanel'
import OnlyFansMappingPanel from './data-entry/OnlyFansMappingPanel'
import {
  dedupeStrings,
  dedupeSyncDetails,
  getFollowerSourceLabel,
  loadPendingInstagramRuns,
  savePendingInstagramRuns,
} from './data-entry/helpers'

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

  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0])
  const [health, setHealth] = useState('Clean')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState({})

  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState(null)

  const [ofLinks, setOfLinks] = useState([])
  const [ofMappings, setOfMappings] = useState([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [ofDiscovery, setOfDiscovery] = useState({ connectedAccounts: [], errors: [] })

  const [posts, setPosts] = useState([])
  const [pendingInstagramRuns, setPendingInstagramRuns] = useState([])

  useEffect(() => {
    Promise.all([getModels(), getAccounts()])
      .then(([loadedModels, loadedAccounts]) => {
        setModels(loadedModels)
        setAccounts(loadedAccounts)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPendingInstagramRuns(loadPendingInstagramRuns())
  }, [])

  const filteredAccounts = useMemo(() => {
    if (!selectedModel) return accounts
    return accounts.filter(account => account.model_id === selectedModel)
  }, [accounts, selectedModel])

  const currentAccount = useMemo(
    () => accounts.find(account => account.id === selectedAccount),
    [accounts, selectedAccount]
  )

  const displaySyncDetails = useMemo(
    () => dedupeSyncDetails(syncResults?.details || []),
    [syncResults]
  )

  const displaySyncErrors = useMemo(
    () => dedupeStrings(syncResults?.errors || []),
    [syncResults]
  )

  useEffect(() => {
    if (entryMode !== 'api-mapping') return

    const loadOnlyFansTab = async () => {
      setLoadingLinks(true)
      try {
        const mappings = await getLinkMappings()
        setOfMappings(mappings || [])

        const response = await fetch('/.netlify/functions/sync-onlyfans', {
          method: 'POST',
          body: JSON.stringify({ action: 'discover' }),
        })
        const data = await response.json()

        setOfDiscovery({
          connectedAccounts: data.connectedAccounts || [],
          errors: data.errors || [],
        })

        if (data.modelUpdates) {
          console.warn('SYNC MASTER LOG:', JSON.stringify(data.modelUpdates, null, 2))
        }

        if (data.trackingLinks) setOfLinks(data.trackingLinks)
      } catch (error) {
        console.error(error)
      } finally {
        setLoadingLinks(false)
      }
    }

    loadOnlyFansTab()
  }, [entryMode])

  useEffect(() => {
    if (!selectedAccount) {
      setPreviousSnapshot(null)
      setFields({})
      setPosts([])
      setSaved(false)
      return
    }

    getSnapshots(selectedAccount, 1).then(snapshots => {
      if (snapshots.length > 0) {
        const previous = snapshots[0]
        setPreviousSnapshot(previous)
        setFields(previous)
        setHealth(currentAccount?.health || 'Clean')
      } else {
        setPreviousSnapshot(null)
        setFields({})
        setHealth(currentAccount?.health || 'Clean')
      }
    })

    setPosts([])
    setSaved(false)
  }, [selectedAccount, currentAccount?.health])

  const platform = currentAccount?.platform

  const postCalcs = useMemo(() => {
    const followers = Number(fields.followers) || 0

    return posts.map(post => {
      const views = Number(post.views) || 0
      const parsedPost = {
        views,
        likes: Number(post.likes) || 0,
        comments: Number(post.comments) || 0,
        shares: Number(post.shares) || 0,
        saves: Number(post.saves) || 0,
      }

      return {
        vtfr: calcPostVTFR(views, followers),
        er: calcPostER(parsedPost),
      }
    })
  }, [posts, fields.followers])

  const weeklyVTFR = useMemo(() => {
    if (!posts.length) return 0
    const followers = Number(fields.followers) || 0
    return calcWeeklyVTFR(
      posts.map(post => ({ views: Number(post.views) || 0 })),
      followers
    )
  }, [posts, fields.followers])

  const weeklyER = useMemo(() => {
    if (!posts.length) return 0
    return calcWeeklyER(
      posts.map(post => ({
        views: Number(post.views) || 0,
        likes: Number(post.likes) || 0,
        comments: Number(post.comments) || 0,
        shares: Number(post.shares) || 0,
        saves: Number(post.saves) || 0,
      }))
    )
  }, [posts])

  const addPost = () => {
    setPosts(previous => [...previous, { views: '', likes: '', comments: '', shares: '', saves: '' }])
  }

  const updatePost = (index, key, value) => {
    setPosts(previous =>
      previous.map((post, postIndex) =>
        postIndex === index ? { ...post, [key]: value } : post
      )
    )
  }

  const removePost = index => {
    setPosts(previous => previous.filter((_, postIndex) => postIndex !== index))
  }

  const handleSave = async () => {
    if (!selectedAccount) return

    setSaving(true)
    try {
      const snapshotData = {
        account_id: selectedAccount,
        snapshot_date: snapshotDate,
        captured_by: 'Manual',
        created_by: user?.id,
        notes,
        followers: Number(fields.followers) || null,
        following: Number(fields.following) || null,
      }

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
          ig_likes_7d: Number(fields.ig_likes_7d) || null,
          ig_comments_7d: Number(fields.ig_comments_7d) || null,
          ig_shares_7d: Number(fields.ig_shares_7d) || null,
          ig_saves_7d: Number(fields.ig_saves_7d) || null,
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
          tw_bookmarks_7d: Number(fields.tw_bookmarks_7d) || null,
          tw_link_clicks_7d: Number(fields.tw_link_clicks_7d) || null,
          tw_tweets_posted_7d: Number(fields.tw_tweets_posted_7d) || null,
          tw_dms_sent_7d: Number(fields.tw_dms_sent_7d) || null,
          tw_dm_response_rate: Number(fields.tw_dm_response_rate) || null,
        })
      } else if (platform === 'reddit') {
        Object.assign(snapshotData, {
          rd_karma_total: Number(fields.rd_karma_total) || null,
          rd_posts_1d: Number(fields.rd_posts_1d) || null,
          rd_posts_7d: Number(fields.rd_posts_7d) || null,
          rd_upvotes_1d: Number(fields.rd_upvotes_1d) || null,
          rd_upvotes_7d: Number(fields.rd_upvotes_7d) || null,
          rd_avg_upvotes_1d: Number(fields.rd_avg_upvotes_1d) || null,
          rd_avg_upvotes_7d: Number(fields.rd_avg_upvotes_7d) || null,
          rd_total_views_7d: Number(fields.rd_total_views_7d) || null,
          rd_comments_received_1d: Number(fields.rd_comments_received_1d) || null,
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

      if (posts.length > 0) {
        const postRows = posts.map((post, index) => ({
          snapshot_id: snapshot.id,
          account_id: selectedAccount,
          platform,
          post_index: index + 1,
          views: Number(post.views) || 0,
          likes: Number(post.likes) || 0,
          comments: Number(post.comments) || 0,
          shares: Number(post.shares) || 0,
          saves: Number(post.saves) || 0,
          vtfr: postCalcs[index]?.vtfr || 0,
          engagement_rate: postCalcs[index]?.er || 0,
        }))
        await createPosts(postRows)
      }

      setSaved(true)
      logAudit({
        action: 'create_snapshot',
        entity_type: 'snapshot',
        entity_id: selectedAccount,
        details: `Manual snapshot for @${getDisplayHandle(currentAccount)} on ${snapshotDate}`,
        user_id: user?.id,
      })
    } catch (error) {
      alert(`Error saving: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndNext = async () => {
    await handleSave()
    const currentIndex = filteredAccounts.findIndex(account => account.id === selectedAccount)
    if (currentIndex < filteredAccounts.length - 1) {
      setSelectedAccount(filteredAccounts[currentIndex + 1].id)
    }
  }

  const pollPendingInstagramRuns = async () => {
    const pendingRuns = loadPendingInstagramRuns()
    if (!pendingRuns.length) return

    const nextPending = []
    const progress = { synced: 0, skipped: 0, errors: [], details: [], pending: 0, _debug: {} }

    for (const run of pendingRuns) {
      try {
        const statusResponse = await fetch('/.netlify/functions/sync-instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', runId: run.runId }),
        })
        const statusText = await statusResponse.text()
        let statusData
        try {
          statusData = JSON.parse(statusText)
        } catch {
          throw new Error(`Non-JSON response (${statusResponse.status}): ${statusText.slice(0, 500)}`)
        }

        if (!statusResponse.ok) {
          throw new Error(statusData.error || `Sync failed (${statusResponse.status})`)
        }

        const runStatus = statusData.status
        const datasetId = statusData.datasetId || run.datasetId

        if (runStatus === 'SUCCEEDED' || runStatus === 'SUCCEEDED_WITH_ERRORS') {
          const importResponse = await fetch('/.netlify/functions/sync-instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'import', datasetId, handles: run.handles }),
          })
          const importText = await importResponse.text()
          let importData
          try {
            importData = JSON.parse(importText)
          } catch {
            throw new Error(`Non-JSON response (${importResponse.status}): ${importText.slice(0, 500)}`)
          }

          if (!importResponse.ok) {
            throw new Error(importData.error || `Sync failed (${importResponse.status})`)
          }

          progress.synced += importData.synced || 0
          progress.skipped += importData.skipped || 0
          if (importData.errors?.length) progress.errors.push(...importData.errors)
          if (importData.details?.length) progress.details.push(...importData.details)
          if (importData._debug) Object.assign(progress._debug, importData._debug)
        } else if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
          progress.errors.push(`Instagram scrape ${runStatus.toLowerCase()} for ${run.handles.join(', ')}`)
        } else {
          nextPending.push({ ...run, status: runStatus, datasetId })
        }
      } catch (error) {
        nextPending.push(run)
        progress.errors.push(`Instagram status check failed for ${run.handles.join(', ')}: ${error.message}`)
      }
    }

    savePendingInstagramRuns(nextPending)
    setPendingInstagramRuns(nextPending)
    progress.pending = nextPending.length

    if (progress.synced || progress.errors.length || progress.pending !== pendingRuns.length) {
      setSyncResults(previous => {
        const base = previous && previous.source === 'instagram-background'
          ? previous
          : { synced: 0, skipped: 0, errors: [], details: [], source: 'instagram-background' }

        return {
          ...base,
          synced: (base.synced || 0) + progress.synced,
          skipped: (base.skipped || 0) + progress.skipped,
          errors: dedupeStrings([...(base.errors || []), ...progress.errors]),
          details: dedupeSyncDetails([...(base.details || []), ...progress.details]),
          pending: progress.pending,
          _debug: { ...(base._debug || {}), ...(progress._debug || {}) },
          source: 'instagram-background',
        }
      })
    }
  }

  useEffect(() => {
    if (entryMode !== 'api' || !pendingInstagramRuns.length) return

    pollPendingInstagramRuns()
    const intervalId = window.setInterval(() => {
      pollPendingInstagramRuns()
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [entryMode, pendingInstagramRuns.length])

  const handleApiSync = async (platformKey, options = {}) => {
    const { silent = false, manageSyncing = true } = options

    if (manageSyncing) setSyncing(true)
    if (!silent) setSyncResults(null)

    try {
      if (platformKey === 'instagram') {
        const instagramAccounts = accounts
          .filter(account => account.platform === 'instagram' && account.status === 'Active')
          .map(account => account.handle)

        const aggregated = { synced: 0, skipped: 0, errors: [], details: [], pending: 0, source: 'instagram-background' }
        const batchSize = 1

        for (let index = 0; index < instagramAccounts.length; index += batchSize) {
          const handles = instagramAccounts.slice(index, index + batchSize)
          const startResponse = await fetch('/.netlify/functions/sync-instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start', handles }),
          })
          const startText = await startResponse.text()
          let startData
          try {
            startData = JSON.parse(startText)
          } catch {
            throw new Error(`Non-JSON response (${startResponse.status}): ${startText.slice(0, 500)}`)
          }

          if (!startResponse.ok) {
            throw new Error(startData.error || `Sync failed (${startResponse.status})`)
          }

          aggregated.pending += 1
          const pendingRuns = [
            ...loadPendingInstagramRuns(),
            {
              runId: startData.runId,
              datasetId: startData.datasetId,
              handles,
              status: startData.status,
            },
          ]
          savePendingInstagramRuns(pendingRuns)
          setPendingInstagramRuns(pendingRuns)
        }

        aggregated.details.push({ action: 'started', views_7d: null })
        if (!silent) setSyncResults(aggregated)

        logAudit({
          action: 'api_sync',
          entity_type: 'platform',
          entity_id: platformKey,
          details: `Instagram background sync started for ${aggregated.pending} account${aggregated.pending !== 1 ? 's' : ''}`,
          user_id: user?.id,
        })

        return aggregated
      }

      const fetchOptions = { method: 'POST' }
      if (platformKey === 'onlyfans') {
        fetchOptions.headers = { 'Content-Type': 'application/json' }
        fetchOptions.body = JSON.stringify({ action: 'sync' })
      }

      const response = await fetch(`/.netlify/functions/sync-${platformKey}`, fetchOptions)
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 500)}`)
      }

      if (!response.ok) {
        throw new Error(data.error || `Sync failed (${response.status})`)
      }

      if (!silent) setSyncResults(data)

      logAudit({
        action: 'api_sync',
        entity_type: 'platform',
        entity_id: platformKey,
        details: `API sync: ${data.synced} accounts updated, ${data.errors?.length || 0} errors`,
        user_id: user?.id,
      })

      return data
    } catch (error) {
      if (!silent) setSyncResults({ synced: 0, errors: [error.message] })
      throw error
    } finally {
      if (manageSyncing) setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    setSyncResults(null)

    const allResults = { synced: 0, errors: [], details: [] }
    for (const platformKey of ['instagram', 'twitter', 'twitter-views', 'reddit', 'tiktok-views', 'onlyfans']) {
      try {
        if (platformKey === 'instagram') {
          const data = await handleApiSync('instagram', { silent: true, manageSyncing: false })
          allResults.synced += data.synced || 0
          if (data.errors?.length) allResults.errors.push(...data.errors.map(error => `[${platformKey}] ${error}`))
          if (data.details?.length) {
            allResults.details.push(...data.details.map(detail => ({ ...detail, _platform: platformKey })))
          }
          continue
        }

        const fetchOptions = { method: 'POST' }
        if (platformKey === 'onlyfans') {
          fetchOptions.headers = { 'Content-Type': 'application/json' }
          fetchOptions.body = JSON.stringify({ action: 'sync' })
        }

        const response = await fetch(`/.netlify/functions/sync-${platformKey}`, fetchOptions)
        const text = await response.text()
        let data
        try {
          data = JSON.parse(text)
        } catch {
          continue
        }

        allResults.synced += data.synced || 0
        if (data.errors?.length) allResults.errors.push(...data.errors.map(error => `[${platformKey}] ${error}`))
        if (data.details?.length) {
          allResults.details.push(...data.details.map(detail => ({ ...detail, _platform: platformKey })))
        }
        if (data.connectedAccountsList) {
          allResults.connectedAccountsList = data.connectedAccountsList
        }
      } catch (error) {
        allResults.errors.push(`[${platformKey}] ${error.message}`)
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

  const handleSaveMapping = async (account, linkName, linkDetails) => {
    const newMapping = {
      tracking_link_name: linkName,
      tracking_link_url: linkDetails.url || '',
      model_id: account.model_id,
      account_id: account.id,
    }

    try {
      const savedMapping = await saveLinkMapping(newMapping)
      setOfMappings(previous => {
        const filtered = previous.filter(mapping => mapping.account_id !== account.id)
        return [...filtered, savedMapping]
      })

      try {
        const syncData = await handleApiSync('onlyfans', { silent: true })
        setSyncResults(syncData)
      } catch (syncError) {
        setSyncResults({ synced: 0, errors: [`Mapping saved, but OnlyFans sync failed: ${syncError.message}`] })
      }
    } catch (error) {
      alert(`Error saving: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '60vh' }}>
        <div className="loader" />
      </div>
    )
  }

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
        <OnlyFansMappingPanel
          accounts={accounts}
          ofMappings={ofMappings}
          models={models}
          ofLinks={ofLinks}
          discovery={ofDiscovery}
          loadingLinks={loadingLinks}
          onSaveMapping={handleSaveMapping}
        />
      )}

      {entryMode === 'api' && (
        <ApiSyncPanel
          syncing={syncing}
          syncResults={syncResults}
          displaySyncDetails={displaySyncDetails}
          displaySyncErrors={displaySyncErrors}
          onSyncAll={handleSyncAll}
          onSyncPlatform={handleApiSync}
          getFollowerSourceLabel={getFollowerSourceLabel}
        />
      )}

      {entryMode === 'manual' && (
        <ManualEntryPanel
          models={models}
          filteredAccounts={filteredAccounts}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedAccount={selectedAccount}
          setSelectedAccount={setSelectedAccount}
          snapshotDate={snapshotDate}
          setSnapshotDate={setSnapshotDate}
          currentAccount={currentAccount}
          previousSnapshot={previousSnapshot}
          health={health}
          setHealth={setHealth}
          fields={fields}
          setFields={setFields}
          platform={platform}
          posts={posts}
          postCalcs={postCalcs}
          weeklyVTFR={weeklyVTFR}
          weeklyER={weeklyER}
          notes={notes}
          setNotes={setNotes}
          saved={saved}
          saving={saving}
          onAddPost={addPost}
          onUpdatePost={updatePost}
          onRemovePost={removePost}
          onSave={handleSave}
          onSaveAndNext={handleSaveAndNext}
        />
      )}
    </div>
  )
}
