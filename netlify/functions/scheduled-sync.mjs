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

// ── Twitter Views Sync (via Apify) ──
async function syncTwitterViews() {
  if (!APIFY_TOKEN) return { synced: 0, errors: ['APIFY_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'twitter').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
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
            maxItems: batchTerms.length * 50,
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
        if (tweetDate) {
          const dateStr = new Date(tweetDate).toISOString().split('T')[0]
          if (dateStr < sevenDaysAgo) continue
        }
        const views = parseInt(tweet.viewCount || 0, 10) || 0
        if (!viewsByUser[author]) viewsByUser[author] = { views: 0, tweetCount: 0 }
        viewsByUser[author].views += views
        viewsByUser[author].tweetCount++
      }

      for (const account of batchAccounts) {
        const handle = account.handle.replace('@', '').toLowerCase()
        const userData = viewsByUser[handle]
        if (!userData) continue
        const viewData = { tw_views_7d: userData.views, tw_tweets_posted_7d: userData.tweetCount }
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

// ── Twitter Sync ──
async function syncTwitter() {
  if (!TWITTER_BEARER) return { synced: 0, errors: ['TWITTER_BEARER_TOKEN not configured'] }

  const { data: accounts, error: accErr } = await supabase
    .from('accounts').select('id, handle, model_id').eq('platform', 'twitter').eq('status', 'Active')
  if (accErr) return { synced: 0, errors: [accErr.message] }
  if (!accounts.length) return { synced: 0, errors: [] }

  const today = new Date().toISOString().split('T')[0]
  const results = { synced: 0, errors: [] }

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
      for (const tUser of (json.data || [])) {
        const account = batch.find(a => a.handle.replace('@', '').toLowerCase() === tUser.username.toLowerCase())
        if (!account) continue
        const metrics = tUser.public_metrics || {}
        const snapshot = {
          account_id: account.id, snapshot_date: today,
          followers: metrics.followers_count || 0, following: metrics.following_count || 0,
          tw_likes_7d: metrics.like_count || 0, captured_by: 'API-Twitter',
          notes: `Auto-synced (scheduled). Tweets: ${metrics.tweet_count || 0}`,
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

  const [twitter, reddit, onlyfans] = await Promise.all([
    syncTwitter(),
    syncReddit(),
    syncOnlyFans(),
  ])

  // Run Twitter views sync after follower sync (needs snapshots to exist)
  const twitterViews = await syncTwitterViews()

  const summary = {
    timestamp: new Date().toISOString(),
    twitter,
    twitterViews,
    reddit,
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
