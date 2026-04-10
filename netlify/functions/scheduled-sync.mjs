import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN
const APIFY_TOKEN = process.env.APIFY_TOKEN
const OF_API_KEY = process.env.ONLYFANS_API_KEY
const OF_API_BASE = 'https://app.onlyfansapi.com/api'

function buildTwitterFollowerUpdate(metrics) {
  const update = {
    captured_by: 'API-Twitter',
  }

  if (metrics.like_count != null) update.tw_likes_7d = metrics.like_count
  if (metrics.followers_count != null) update.followers = metrics.followers_count
  if (metrics.following_count != null) update.following = metrics.following_count

  const noteBits = []
  if (metrics.tweet_count != null) noteBits.push(`Tweets: ${metrics.tweet_count}`)
  if (metrics.listed_count != null) noteBits.push(`Listed: ${metrics.listed_count}`)
  if (noteBits.length) update.notes = `Auto-synced (scheduled). ${noteBits.join(', ')}`

  return update
}

// ── Twitter Views Sync (via Apify) ──
async function syncTwitterViews() {
  if (!APIFY_TOKEN) return { synced: 0, errors: ['APIFY_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'twitter').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const results = { synced: 0, errors: [] }

  const searchTerms = accounts.map(a => `from:${a.handle.replace('@', '')}`)
  const batchSize = 5

  for (let i = 0; i < searchTerms.length; i += batchSize) {
    const batchTerms = searchTerms.slice(i, i + batchSize)
    const batchAccounts = accounts.slice(i, i + batchSize)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000)
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            searchTerms: batchTerms,
            maxItems: batchTerms.length * 150,
            sort: 'Latest',
          }),
        }
      )
      clearTimeout(timer)
      if (!runRes.ok) { results.errors.push(`Apify ${runRes.status}`); continue }
      const tweets = await runRes.json()

      const viewsByUser = {}
      for (const tweet of tweets) {
        const author = (tweet.author?.userName || '').toLowerCase()
        if (!author) continue
        const tweetDate = tweet.createdAt || tweet.created_at
        if (!tweetDate) continue
        const dateStr = new Date(tweetDate).toISOString().split('T')[0]
        if (dateStr < thirtyDaysAgo) continue
        const views = parseInt(tweet.viewCount || 0, 10) || 0
        if (!viewsByUser[author]) viewsByUser[author] = { views7d: 0, views30d: 0, tweets7d: 0, tweets30d: 0 }
        viewsByUser[author].views30d += views
        viewsByUser[author].tweets30d++
        if (dateStr >= sevenDaysAgo) {
          viewsByUser[author].views7d += views
          viewsByUser[author].tweets7d++
        }
      }

      for (const account of batchAccounts) {
        const handle = account.handle.replace('@', '').toLowerCase()
        const userData = viewsByUser[handle]
        if (!userData) continue
        const viewData = { tw_views_7d: userData.views7d, tw_impressions_7d: userData.views30d, tw_tweets_posted_7d: userData.tweets7d }
        const { data: existing } = await supabase.from('snapshots').select('id').eq('account_id', account.id).eq('snapshot_date', today).limit(1)
        if (existing?.length) {
          await supabase.from('snapshots').update(viewData).eq('id', existing[0].id)
        } else {
          await supabase.from('snapshots').insert({ account_id: account.id, snapshot_date: today, captured_by: 'API-Twitter-Views', ...viewData })
        }
        results.synced++
      }
    } catch (err) { results.errors.push(err.message) }
  }
  return results
}

// ── TikTok Views Sync (via Apify) ──
async function syncTikTokViews() {
  if (!APIFY_TOKEN) return { synced: 0, errors: ['APIFY_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'tiktok').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const results = { synced: 0, errors: [] }

  const profiles = accounts.map(a => a.handle.replace('@', ''))
  const batchSize = 5

  for (let i = 0; i < profiles.length; i += batchSize) {
    const batchProfiles = profiles.slice(i, i + batchSize)
    const batchAccounts = accounts.slice(i, i + batchSize)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000)
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ profiles: batchProfiles, resultsPerPage: 30, shouldDownloadVideos: false }),
        }
      )
      clearTimeout(timer)
      if (!runRes.ok) { results.errors.push(`Apify TikTok ${runRes.status}`); continue }
      const videos = await runRes.json()

      const statsByUser = {}
      for (const video of videos) {
        const author = (video.authorMeta?.name || video.author?.uniqueId || '').toLowerCase()
        if (!author) continue
        const createTime = video.createTimeISO || video.createTime
        if (!createTime) continue
        const videoDate = new Date(typeof createTime === 'number' ? createTime * 1000 : createTime)
        if (isNaN(videoDate.getTime()) || videoDate < thirtyDaysAgo) continue
        const plays = parseInt(video.playCount || 0, 10) || 0
        const likes = parseInt(video.diggCount || 0, 10) || 0
        const comments = parseInt(video.commentCount || 0, 10) || 0
        const shares = parseInt(video.shareCount || 0, 10) || 0
        if (!statsByUser[author]) statsByUser[author] = { views7d: 0, likes7d: 0, comments7d: 0, shares7d: 0, videos7d: 0, followers: null }
        if (videoDate >= sevenDaysAgo) {
          statsByUser[author].views7d += plays
          statsByUser[author].likes7d += likes
          statsByUser[author].comments7d += comments
          statsByUser[author].shares7d += shares
          statsByUser[author].videos7d++
        }
        const fans = video.authorMeta?.fans || video.authorMeta?.followers
        if (fans && !statsByUser[author].followers) statsByUser[author].followers = parseInt(fans, 10) || null
      }

      for (const account of batchAccounts) {
        const handle = account.handle.replace('@', '').toLowerCase()
        const userData = statsByUser[handle]
        if (!userData) continue
        const snapshotData = {
          tt_views_7d: userData.views7d, tt_likes_7d: userData.likes7d,
          tt_comments_7d: userData.comments7d, tt_shares_7d: userData.shares7d,
          tt_videos_posted_7d: userData.videos7d,
        }
        if (userData.followers) snapshotData.followers = userData.followers
        const { data: existing } = await supabase.from('snapshots').select('id').eq('account_id', account.id).eq('snapshot_date', today).limit(1)
        if (existing?.length) {
          await supabase.from('snapshots').update(snapshotData).eq('id', existing[0].id)
        } else {
          await supabase.from('snapshots').insert({ account_id: account.id, snapshot_date: today, captured_by: 'API-TikTok', ...snapshotData })
        }
        results.synced++
      }
    } catch (err) { results.errors.push(err.message) }
  }
  return results
}

// ── Twitter Sync ──
async function syncTwitter() {
  if (!TWITTER_BEARER) return { synced: 0, errors: ['TWITTER_BEARER_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'twitter').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const results = { synced: 0, skipped: 0, errors: [] }

  for (let i = 0; i < accounts.length; i += 100) {
    const batch = accounts.slice(i, i + 100)
    const usernames = batch.map(a => a.handle.replace('@', '')).join(',')
    try {
      const res = await fetch(
        `https://api.x.com/2/users/by?usernames=${usernames}&user.fields=public_metrics,created_at`,
        { headers: { Authorization: `Bearer ${TWITTER_BEARER}` } }
      )
      if (!res.ok) { results.errors.push(`Twitter API ${res.status}`); continue }
      const json = await res.json()
      const twitterErrors = json.errors || []
      const matchedHandles = new Set()

      for (const err of twitterErrors) {
        results.errors.push(`@${err.value}: ${err.detail}`)
        results.skipped++
      }

      for (const tUser of (json.data || [])) {
        const account = batch.find(a => a.handle.replace('@', '').toLowerCase() === tUser.username.toLowerCase())
        if (!account) continue
        matchedHandles.add(account.handle.replace('@', '').toLowerCase())
        const metrics = tUser.public_metrics
        if (!metrics || (metrics.followers_count == null && metrics.following_count == null && metrics.like_count == null)) {
          results.errors.push(`@${tUser.username}: missing public_metrics; preserved previous snapshot values`)
          results.skipped++
          continue
        }

        const snapshot = buildTwitterFollowerUpdate(metrics)
        const { data: existing } = await supabase.from('snapshots').select('id').eq('account_id', account.id).eq('snapshot_date', today).limit(1)
        if (existing?.length) {
          await supabase.from('snapshots').update(snapshot).eq('id', existing[0].id)
        } else {
          if (snapshot.followers == null && snapshot.following == null) {
            results.errors.push(`@${tUser.username}: follower metrics unavailable for new snapshot; skipped insert to avoid zero overwrite`)
            results.skipped++
            continue
          }
          await supabase.from('snapshots').insert({ account_id: account.id, snapshot_date: today, ...snapshot })
        }
        results.synced++
      }

      for (const account of batch) {
        const normalizedHandle = account.handle.replace('@', '').toLowerCase()
        if (!matchedHandles.has(normalizedHandle) && !twitterErrors.some(err => (err.value || '').toLowerCase() === normalizedHandle)) {
          results.errors.push(`@${normalizedHandle}: no user payload returned; preserved previous snapshot values`)
          results.skipped++
        }
      }
    } catch (err) { results.errors.push(err.message) }
  }
  return results
}

// ── Reddit Sync ──
async function syncReddit() {
  if (!APIFY_TOKEN) return { synced: 0, errors: ['APIFY_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'reddit').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const results = { synced: 0, errors: [] }
  const startUrls = accounts.map(a => ({ url: `https://www.reddit.com/user/${a.handle.replace(/^u\//, '')}/` }))

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrls, maxItems: accounts.length, maxPostCount: 0, maxComments: 0, maxCommunitiesCount: 0, maxUserCount: accounts.length, scrollTimeout: 40, proxy: { useApifyProxy: true } }),
      }
    )
    if (!runRes.ok) { results.errors.push(`Apify ${runRes.status}`); return results }
    const items = await runRes.json()

    for (const item of items) {
      const username = (item.username || item.name || '').toLowerCase()
      if (!username) continue
      const account = accounts.find(a => a.handle.replace(/^u\//, '').toLowerCase() === username)
      if (!account) continue
      const totalKarma = item.totalKarma || item.total_karma || ((item.linkKarma || 0) + (item.commentKarma || 0))
      const snapshot = {
        account_id: account.id, snapshot_date: today,
        followers: item.subscribers || item.followers || 0,
        rd_karma_total: totalKarma, captured_by: 'API-Reddit',
        notes: `Auto-synced (scheduled)`,
      }
      const { data: existing } = await supabase.from('snapshots').select('id').eq('account_id', account.id).eq('snapshot_date', today).limit(1)
      if (existing?.length) {
        await supabase.from('snapshots').update(snapshot).eq('id', existing[0].id)
      } else {
        await supabase.from('snapshots').insert(snapshot)
      }
      results.synced++
    }
  } catch (err) { results.errors.push(err.message) }
  return results
}

// ── Instagram Sync ──
async function syncInstagram() {
  if (!APIFY_TOKEN) return { synced: 0, errors: ['APIFY_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, handle')
    .eq('platform', 'instagram')
    .eq('status', 'Active')

  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts?.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const usernames = accounts.map(a => a.handle.replace(/^@/, ''))
  const results = { synced: 0, errors: [] }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      }
    )

    if (!runRes.ok) {
      results.errors.push(`Apify ${runRes.status}`)
      return results
    }

    const items = await runRes.json()

    for (const item of items) {
      const username = (item.username || '').toLowerCase()
      if (!username) continue
      const account = accounts.find(a => a.handle.replace(/^@/, '').toLowerCase() === username)
      if (!account) continue

      const posts = item.latestPosts || []
      const posts7d = posts.filter(post => {
        const date = new Date(post.timestamp || post.takenAt || post.createdAt)
        return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo
      })
      const posts30d = posts.filter(post => {
        const date = new Date(post.timestamp || post.takenAt || post.createdAt)
        return !Number.isNaN(date.getTime()) && date >= thirtyDaysAgo
      })
      const followers = item.followersCount || item.followers || null
      const views7d = posts7d.reduce((sum, post) => sum + Number(post.videoViewCount || post.playCount || 0), 0)
      const views30d = posts30d.reduce((sum, post) => sum + Number(post.videoViewCount || post.playCount || 0), 0)
      const reels7d = posts7d.filter(post => {
        const type = String(post.type || post.productType || '').toLowerCase()
        return type.includes('video') || type.includes('clip') || type.includes('igtv') || type.includes('reel')
      }).length
      const topReelViews = posts.reduce((max, post) => Math.max(max, Number(post.videoViewCount || post.playCount || 0)), 0)

      const snapshot = {
        account_id: account.id,
        snapshot_date: today,
        followers,
        following: item.followsCount || item.followingCount || item.following || null,
        ig_views_7d: views7d || null,
        ig_views_30d: views30d || null,
        ig_reels_posted_7d: reels7d || null,
        ig_top_reel_views: topReelViews || null,
        captured_by: 'API-Instagram',
        notes: 'Auto-synced (scheduled) via Apify public Instagram profile data.',
      }

      const { data: existing } = await supabase
        .from('snapshots')
        .select('id')
        .eq('account_id', account.id)
        .eq('snapshot_date', today)
        .limit(1)

      if (existing?.length) {
        await supabase.from('snapshots').update(snapshot).eq('id', existing[0].id)
      } else {
        await supabase.from('snapshots').insert(snapshot)
      }
      results.synced++
    }
  } catch (err) {
    results.errors.push(err.message)
  }

  return results
}

// ── OnlyFans Sync ──
async function syncOnlyFans() {
  if (!OF_API_KEY) return { synced: 0, errors: ['ONLYFANS_API_KEY not configured'] }

  const results = { synced: 0, errors: [] }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    const accountsRes = await fetch(`${OF_API_BASE}/accounts`, {
      headers: { 'Authorization': `Bearer ${OF_API_KEY}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!accountsRes.ok) { results.errors.push(`OF API ${accountsRes.status}`); return results }
    const accountsData = await accountsRes.json()
    const ofAccounts = accountsData.data || accountsData

    if (!Array.isArray(ofAccounts) || !ofAccounts.length) { results.errors.push('No OF accounts connected'); return results }

    const { data: models } = await supabase.from('models').select('id, name, of_username').eq('status', 'Active').not('of_username', 'is', null)

    for (const model of (models || [])) {
      const dbUsername = (model.of_username || '').toLowerCase().replace('@', '').trim()
      if (!dbUsername) continue
      const matched = ofAccounts.find(a => {
        const u = (a.onlyfans_username || a.username || '').toLowerCase().trim()
        const ud = (a.onlyfans_user_data?.username || '').toLowerCase().trim()
        return u === dbUsername || ud === dbUsername
      })
      if (!matched) continue
      const userData = matched.onlyfans_user_data || matched
      const subs = userData.subscribersCount || userData.activeSubscribersCount || 0
      await supabase.from('models').update({ of_subs: subs }).eq('id', model.id)
      results.synced++
    }
  } catch (err) { results.errors.push(err.message) }
  return results
}

// ── Scheduled Handler ──
export const handler = schedule('0 6 * * *', async () => {
  console.log('Starting daily sync...')

  const [instagram, twitter, reddit, onlyfans] = await Promise.all([
    syncInstagram(),
    syncTwitter(),
    syncReddit(),
    syncOnlyFans(),
  ])

  // Run view syncs after follower syncs (need snapshots to exist first)
  const [twitterViews, tiktokViews] = await Promise.all([
    syncTwitterViews(),
    syncTikTokViews(),
  ])

  const summary = {
    timestamp: new Date().toISOString(),
    instagram,
    twitter,
    twitterViews,
    reddit,
    tiktokViews,
    onlyfans,
  }

  console.log('Daily sync complete:', JSON.stringify(summary))

  // Store sync log
  try {
    await supabase.from('sync_logs').insert({
      sync_type: 'scheduled',
      results: summary,
    })
  } catch {
    // sync_logs table might not exist yet, that's fine
  }

  return { statusCode: 200 }
})
