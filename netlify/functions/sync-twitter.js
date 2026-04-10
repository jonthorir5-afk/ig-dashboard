import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN

function buildTwitterFollowerUpdate(metrics) {
  const update = {
    captured_by: 'API-Twitter',
    tw_impressions_7d: null,
    tw_tweets_posted_7d: null,
  }

  if (metrics.like_count != null) update.tw_likes_7d = metrics.like_count
  if (metrics.followers_count != null) update.followers = metrics.followers_count
  if (metrics.following_count != null) update.following = metrics.following_count

  const noteBits = []
  if (metrics.tweet_count != null) noteBits.push(`Total tweets: ${metrics.tweet_count}`)
  if (metrics.listed_count != null) noteBits.push(`Listed: ${metrics.listed_count}`)
  if (noteBits.length) update.notes = `Auto-synced. ${noteBits.join(', ')}`

  return update
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  if (!TWITTER_BEARER) {
    return new Response(JSON.stringify({ error: 'TWITTER_BEARER_TOKEN not configured' }), { status: 500 })
  }

  // Fetch all active Twitter accounts from the database
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, handle, model_id')
    .eq('platform', 'twitter')
    .eq('status', 'Active')

  if (accErr) {
    return new Response(JSON.stringify({ error: accErr.message }), { status: 500 })
  }

  if (!accounts.length) {
    return new Response(JSON.stringify({ message: 'No active Twitter accounts found', synced: 0 }))
  }

  const today = new Date().toISOString().split('T')[0]
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  // Process in batches of 100 (Twitter API limit for user lookup)
  for (let i = 0; i < accounts.length; i += 100) {
    const batch = accounts.slice(i, i + 100)
    const usernames = batch.map(a => a.handle.replace('@', '')).join(',')

    try {
      const res = await fetch(
        `https://api.x.com/2/users/by?usernames=${usernames}&user.fields=public_metrics,created_at`,
        { headers: { Authorization: `Bearer ${TWITTER_BEARER}` } }
      )

      if (!res.ok) {
        const errBody = await res.text()
        results.errors.push(`Twitter API ${res.status}: ${errBody}`)
        continue
      }

      const json = await res.json()
      const users = json.data || []
      const twitterErrors = json.errors || []
      const matchedHandles = new Set()

      // Log any users that couldn't be found
      for (const err of twitterErrors) {
        results.errors.push(`@${err.value}: ${err.detail}`)
        results.skipped++
      }

      // Create snapshots for each found user
      for (const tUser of users) {
        const account = batch.find(
          a => a.handle.replace('@', '').toLowerCase() === tUser.username.toLowerCase()
        )
        if (!account) continue
        matchedHandles.add(account.handle.replace('@', '').toLowerCase())

        const metrics = tUser.public_metrics
        if (!metrics || (metrics.followers_count == null && metrics.following_count == null && metrics.like_count == null)) {
          results.errors.push(`@${tUser.username}: missing public_metrics; preserved previous snapshot values`)
          results.skipped++
          continue
        }

        const snapshot = buildTwitterFollowerUpdate(metrics)

        // Check if we already have a snapshot for today
        const { data: existing } = await supabase
          .from('snapshots')
          .select('id')
          .eq('account_id', account.id)
          .eq('snapshot_date', today)
          .limit(1)

        if (existing && existing.length > 0) {
          // Update existing snapshot
          const { error: upErr } = await supabase
            .from('snapshots')
            .update(snapshot)
            .eq('id', existing[0].id)
          if (upErr) {
            results.errors.push(`@${tUser.username}: update failed — ${upErr.message}`)
          } else {
            results.details.push({ handle: tUser.username, action: 'updated', followers: metrics.followers_count })
            results.synced++
          }
        } else {
          if (snapshot.followers == null && snapshot.following == null) {
            results.errors.push(`@${tUser.username}: follower metrics unavailable for new snapshot; skipped insert to avoid zero overwrite`)
            results.skipped++
            continue
          }

          // Insert new snapshot
          const { error: insErr } = await supabase
            .from('snapshots')
            .insert({
              account_id: account.id,
              snapshot_date: today,
              ...snapshot,
            })
          if (insErr) {
            results.errors.push(`@${tUser.username}: insert failed — ${insErr.message}`)
          } else {
            results.details.push({ handle: tUser.username, action: 'created', followers: metrics.followers_count })
            results.synced++
          }
        }
      }

      for (const account of batch) {
        const normalizedHandle = account.handle.replace('@', '').toLowerCase()
        if (!matchedHandles.has(normalizedHandle) && !twitterErrors.some(err => (err.value || '').toLowerCase() === normalizedHandle)) {
          results.errors.push(`@${normalizedHandle}: no user payload returned; preserved previous snapshot values`)
          results.skipped++
        }
      }
    } catch (err) {
      results.errors.push(`Batch fetch error: ${err.message}`)
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
