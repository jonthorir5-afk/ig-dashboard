import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v24.0'

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
    try {
      const text = await req.text()
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }
}

function normalizeHandle(handle) {
  return (handle || '').trim().replace(/^@/, '').toLowerCase()
}

function sumMetric(entries) {
  return (entries || []).reduce((sum, entry) => {
    const value = Number(entry?.values?.[0]?.value || 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

async function metaFetch(path, accessToken, params = {}) {
  const url = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, value)
  })
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Meta API returned invalid JSON: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data.error?.message || `Meta API ${res.status}`)
  return data
}

async function fetchInstagramProfile(connection) {
  return metaFetch('/me', connection.access_token, {
    fields: 'user_id,username,account_type,media_count,followers_count,follows_count',
  })
}

async function fetchMediaList(connection) {
  const data = await metaFetch('/me/media', connection.access_token, {
    fields: 'id,caption,media_type,timestamp,permalink',
    limit: '25',
  })
  return data.data || []
}

async function fetchMediaInsights(connection, mediaId) {
  try {
    const data = await metaFetch(`/${mediaId}/insights`, connection.access_token, {
      metric: 'views,reach,likes,comments,saved,shares,total_interactions',
    })
    return data.data || []
  } catch {
    return []
  }
}

async function fetchAccountInsights(connection) {
  try {
    const data = await metaFetch('/me/insights', connection.access_token, {
      metric: 'reach,profile_views,website_clicks',
      period: 'day',
    })
    return data.data || []
  } catch {
    return []
  }
}

function computeMediaMetrics(mediaItems, insightsByMedia) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  let reelsPosted7d = 0
  let views7d = 0
  let views30d = 0
  let topReelViews = 0
  let likes7d = 0
  let comments7d = 0
  let shares7d = 0
  let saves7d = 0

  for (const media of mediaItems) {
    const timestamp = media.timestamp ? new Date(media.timestamp) : null
    const isRecent7d = timestamp && timestamp >= sevenDaysAgo
    const insights = insightsByMedia[media.id] || []
    const mediaViews = sumMetric(insights.filter(metric => metric.name === 'views'))
    const mediaLikes = sumMetric(insights.filter(metric => metric.name === 'likes'))
    const mediaComments = sumMetric(insights.filter(metric => metric.name === 'comments'))
    const mediaShares = sumMetric(insights.filter(metric => metric.name === 'shares'))
    const mediaSaves = sumMetric(insights.filter(metric => metric.name === 'saved'))

    if (media.media_type === 'REEL') {
      if (isRecent7d) reelsPosted7d += 1
      topReelViews = Math.max(topReelViews, mediaViews)
    }

    views30d += mediaViews
    if (isRecent7d) {
      views7d += mediaViews
      likes7d += mediaLikes
      comments7d += mediaComments
      shares7d += mediaShares
      saves7d += mediaSaves
    }
  }

  return {
    ig_views_7d: views7d || null,
    ig_views_30d: views30d || null,
    ig_reels_posted_7d: reelsPosted7d || null,
    ig_top_reel_views: topReelViews || null,
    ig_likes_7d: likes7d || null,
    ig_comments_7d: comments7d || null,
    ig_shares_7d: shares7d || null,
    ig_saves_7d: saves7d || null,
  }
}

async function upsertSnapshot(accountId, snapshot) {
  const { data: existing, error: existingError } = await supabase
    .from('snapshots')
    .select('id')
    .eq('account_id', accountId)
    .eq('snapshot_date', snapshot.snapshot_date)
    .limit(1)

  if (existingError) throw existingError

  if (existing?.length) {
    const { error } = await supabase.from('snapshots').update(snapshot).eq('id', existing[0].id)
    if (error) throw error
    return 'updated'
  }

  const { error } = await supabase.from('snapshots').insert(snapshot)
  if (error) throw error
  return 'created'
}

async function markConnectionStatus(connectionId, updates) {
  await supabase
    .from('instagram_connections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', connectionId)
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const body = await parseBody(req)
    const handles = Array.isArray(body.handles) ? body.handles.map(normalizeHandle).filter(Boolean) : []
    const today = new Date().toISOString().split('T')[0]

    let accountQuery = supabase
      .from('accounts')
      .select('id, handle, platform, status, model_id, model:models(id, name, display_name)')
      .eq('platform', 'instagram')
      .eq('status', 'Active')

    if (handles.length) accountQuery = accountQuery.in('handle', handles)

    const { data: accounts, error: accountsError } = await accountQuery
    if (accountsError) throw accountsError
    if (!accounts?.length) return json({ synced: 0, skipped: 0, errors: [], details: [] })

    const accountIds = accounts.map(account => account.id)
    const { data: connections, error: connectionsError } = await supabase
      .from('instagram_connections')
      .select('*')
      .in('account_id', accountIds)

    if (connectionsError && !String(connectionsError.message || '').includes('instagram_connections')) {
      throw connectionsError
    }

    const connectionByAccountId = Object.fromEntries((connections || []).map(connection => [connection.account_id, connection]))
    const results = { synced: 0, skipped: 0, errors: [], details: [] }

    for (const account of accounts) {
      const connection = connectionByAccountId[account.id]
      if (!connection) {
        results.skipped++
        results.details.push({
          handle: normalizeHandle(account.handle),
          action: 'skipped',
          warning: 'Instagram account not connected to Meta yet',
          follower_source: 'missing',
        })
        continue
      }

      try {
        const profile = await fetchInstagramProfile(connection)
        const mediaItems = await fetchMediaList(connection)
        const insightsByMedia = {}

        for (const media of mediaItems) {
          insightsByMedia[media.id] = await fetchMediaInsights(connection, media.id)
        }

        const accountInsights = await fetchAccountInsights(connection)
        const mediaMetrics = computeMediaMetrics(mediaItems, insightsByMedia)

        const snapshot = {
          account_id: account.id,
          snapshot_date: today,
          followers: Number(profile.followers_count || 0) || null,
          following: Number(profile.follows_count || 0) || null,
          ig_reach_7d: sumMetric(accountInsights.filter(metric => metric.name === 'reach')) || null,
          ig_profile_visits_7d: sumMetric(accountInsights.filter(metric => metric.name === 'profile_views')) || null,
          ig_link_clicks_7d: sumMetric(accountInsights.filter(metric => metric.name === 'website_clicks')) || null,
          ...mediaMetrics,
          captured_by: 'API-Instagram-Meta',
          notes: `Auto-synced via Meta Graph API for @${profile.username || account.handle}.`,
        }

        const action = await upsertSnapshot(account.id, snapshot)
        await markConnectionStatus(connection.id, {
          status: 'connected',
          last_synced_at: new Date().toISOString(),
          last_error: null,
        })

        await supabase
          .from('accounts')
          .update({ data_source: 'meta_graph' })
          .eq('id', account.id)

        results.synced++
        results.details.push({
          handle: normalizeHandle(account.handle),
          action,
          followers: snapshot.followers,
          views_7d: snapshot.ig_views_7d,
          follower_source: 'meta_graph',
        })
      } catch (err) {
        const message = err.message || 'Meta sync failed'
        results.errors.push(`@${normalizeHandle(account.handle)}: ${message}`)
        results.details.push({
          handle: normalizeHandle(account.handle),
          action: 'failed',
          warning: message,
        })

        const nextStatus = /expired|invalid|token|session/i.test(message) ? 'expired' : 'error'
        await markConnectionStatus(connection.id, {
          status: nextStatus,
          last_error: message,
        })
      }
    }

    return json(results)
  } catch (err) {
    return json({ synced: 0, skipped: 0, errors: [err.message || 'Instagram sync failed'], details: [] }, 500)
  }
}
