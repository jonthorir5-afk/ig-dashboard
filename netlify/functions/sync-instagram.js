import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APIFY_TOKEN = process.env.APIFY_TOKEN
const APIFY_PROFILE_SCRAPER = 'apify~instagram-profile-scraper'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function parseBody(req) {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function normalizeHandle(handle) {
  return (handle || '').trim().replace(/^@/, '').toLowerCase()
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getRecentPosts(item) {
  return item.latestPosts || item.latest_posts || item.posts || item.recentPosts || []
}

function firstNumber(...values) {
  for (const value of values) {
    if (value == null || value === '') continue
    if (typeof value === 'string') {
      const parsed = Number(String(value).replace(/,/g, '').trim())
      if (Number.isFinite(parsed)) return parsed
      continue
    }
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

async function getInstagramAccounts(handles = []) {
  let query = supabase
    .from('accounts')
    .select('id, handle, model_id')
    .eq('platform', 'instagram')
    .eq('status', 'Active')

  const normalizedHandles = handles.map(normalizeHandle).filter(Boolean)
  if (normalizedHandles.length > 0) query = query.in('handle', normalizedHandles)

  return query
}

async function startRun(usernames) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_PROFILE_SCRAPER}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify error ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  return data.data || data
}

async function getRun(runId) {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify status error ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.data || data
}

async function getDatasetItems(datasetId) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify dataset error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function importItems(accounts, items) {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  for (const item of items) {
    const username = normalizeHandle(item.username || item.userName || item.ownerUsername)
    if (!username) continue

    const account = accounts.find(acc => normalizeHandle(acc.handle) === username)
    if (!account) continue

    const posts = getRecentPosts(item)
    const posts7d = posts.filter(post => {
      const date = toDate(post.timestamp || post.takenAt || post.createdAt)
      return date && date >= sevenDaysAgo
    })
    const posts30d = posts.filter(post => {
      const date = toDate(post.timestamp || post.takenAt || post.createdAt)
      return date && date >= thirtyDaysAgo
    })

    const views7d = posts7d.reduce((sum, post) => sum + Number(post.videoViewCount || post.video_play_count || post.videoPlayCount || post.playCount || 0), 0)
    const views30d = posts30d.reduce((sum, post) => sum + Number(post.videoViewCount || post.video_play_count || post.videoPlayCount || post.playCount || 0), 0)
    const reels7d = posts7d.filter(post => {
      const type = String(post.type || post.productType || '').toLowerCase()
      return type.includes('video') || type.includes('clip') || type.includes('igtv') || type.includes('reel')
    })
    const topReelViews = posts.reduce((max, post) => {
      const value = Number(post.videoViewCount || post.video_play_count || post.videoPlayCount || post.playCount || 0)
      return Math.max(max, value)
    }, 0)

    const followers = firstNumber(
      item.followersCount,
      item.followers,
      item.followers_count,
      item.edge_followed_by?.count,
      item.owner?.followersCount,
      item.profile?.followersCount
    )
    const following = firstNumber(
      item.followsCount,
      item.followingCount,
      item.following,
      item.following_count,
      item.edge_follow?.count,
      item.owner?.followingCount,
      item.profile?.followingCount
    )

    const vtfrValues = posts7d
      .map(post => {
        const views = Number(post.videoViewCount || post.video_play_count || post.videoPlayCount || post.playCount || 0)
        if (!followers || !views) return null
        return (views / followers) * 100
      })
      .filter(value => value != null)

    const erValues = posts7d
      .map(post => {
        const views = Number(post.videoViewCount || post.video_play_count || post.videoPlayCount || post.playCount || 0)
        if (!views) return null
        const likes = Number(post.likesCount || post.likes || 0)
        const comments = Number(post.commentsCount || post.comments || 0)
        return ((likes + comments) / views) * 100
      })
      .filter(value => value != null)

    const snapshot = {
      account_id: account.id,
      snapshot_date: today,
      followers,
      following,
      ig_views_7d: views7d || null,
      ig_views_30d: views30d || null,
      ig_reels_posted_7d: reels7d.length || null,
      ig_top_reel_views: topReelViews || null,
      vtfr_weekly: vtfrValues.length ? average(vtfrValues) : null,
      engagement_rate_weekly: erValues.length ? average(erValues) : null,
      captured_by: 'API-Instagram',
      notes: `Auto-synced via Apify public Instagram profile data. Followers source: ${followers != null ? 'resolved' : 'missing'}.`,
    }

    const { data: existing } = await supabase
      .from('snapshots')
      .select('id')
      .eq('account_id', account.id)
      .eq('snapshot_date', today)
      .limit(1)

    if (existing?.length) {
      const { error } = await supabase.from('snapshots').update(snapshot).eq('id', existing[0].id)
      if (error) {
        results.errors.push(`@${username}: update failed — ${error.message}`)
      } else {
        results.synced++
        results.details.push({ handle: username, action: 'updated', followers, views_7d: views7d })
      }
    } else {
      const { error } = await supabase.from('snapshots').insert(snapshot)
      if (error) {
        results.errors.push(`@${username}: insert failed — ${error.message}`)
      } else {
        results.synced++
        results.details.push({ handle: username, action: 'created', followers, views_7d: views7d })
      }
    }
  }

  const syncedHandles = new Set(results.details.map(detail => normalizeHandle(detail.handle)))
  for (const account of accounts) {
    const handle = normalizeHandle(account.handle)
    if (!syncedHandles.has(handle)) {
      results.skipped++
      results.errors.push(`@${handle}: not found in Instagram scraper results`)
    }
  }

  return results
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!APIFY_TOKEN) return json({ error: 'APIFY_TOKEN not configured' }, 500)

  try {
    const body = await parseBody(req)
    const action = body.action || 'start'
    const handles = Array.isArray(body.handles) ? body.handles : []

    if (action === 'status') {
      if (!body.runId) return json({ error: 'runId is required' }, 400)
      const run = await getRun(body.runId)
      return json({
        action,
        runId: run.id,
        status: run.status,
        datasetId: run.defaultDatasetId,
      })
    }

    if (action === 'import') {
      if (!body.datasetId) return json({ error: 'datasetId is required' }, 400)
      const { data: accounts, error } = await getInstagramAccounts(handles)
      if (error) return json({ error: error.message }, 500)
      const items = await getDatasetItems(body.datasetId)
      const results = await importItems(accounts || [], items || [])
      return json(results)
    }

    const { data: accounts, error } = await getInstagramAccounts(handles)
    if (error) return json({ error: error.message }, 500)
    if (!accounts?.length) return json({ message: 'No active Instagram accounts found', synced: 0 })

    const usernames = accounts.map(account => normalizeHandle(account.handle)).filter(Boolean)
    const run = await startRun(usernames)

    return json({
      action: 'start',
      runId: run.id,
      datasetId: run.defaultDatasetId,
      handles: usernames,
      status: run.status,
    })
  } catch (err) {
    return json({ synced: 0, errors: [err.message] })
  }
}
