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

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!APIFY_TOKEN) return json({ error: 'APIFY_TOKEN not configured' }, 500)

  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, handle, model_id')
    .eq('platform', 'instagram')
    .eq('status', 'Active')

  if (accErr) return json({ error: accErr.message }, 500)
  if (!accounts.length) return json({ message: 'No active Instagram accounts found', synced: 0 })

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  const usernames = accounts.map(account => normalizeHandle(account.handle)).filter(Boolean)

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_PROFILE_SCRAPER}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames,
        }),
      }
    )

    if (!runRes.ok) {
      const errText = await runRes.text()
      return json({ synced: 0, errors: [`Apify error ${runRes.status}: ${errText.slice(0, 500)}`] })
    }

    const items = await runRes.json()

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

      const followers = Number(item.followersCount || item.followers || 0) || null
      const following = Number(item.followsCount || item.followingCount || item.following || 0) || null

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
        notes: `Auto-synced via Apify Instagram Profile Scraper. Public profile data only; profile visits, reach, stories, and link clicks are unavailable.`,
      }

      const { data: existing } = await supabase
        .from('snapshots')
        .select('id')
        .eq('account_id', account.id)
        .eq('snapshot_date', today)
        .limit(1)

      if (existing?.length) {
        const { error: upErr } = await supabase
          .from('snapshots')
          .update(snapshot)
          .eq('id', existing[0].id)

        if (upErr) {
          results.errors.push(`@${username}: update failed — ${upErr.message}`)
        } else {
          results.synced++
          results.details.push({ handle: username, action: 'updated', followers, views_7d: views7d })
        }
      } else {
        const { error: insErr } = await supabase
          .from('snapshots')
          .insert(snapshot)

        if (insErr) {
          results.errors.push(`@${username}: insert failed — ${insErr.message}`)
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
  } catch (err) {
    results.errors.push(`Request failed: ${err.message}`)
  }

  return json(results)
}
