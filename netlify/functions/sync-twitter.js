import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN

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

        const metrics = tUser.public_metrics || {}

        const snapshot = {
          account_id: account.id,
          snapshot_date: today,
          followers: metrics.followers_count || 0,
          following: metrics.following_count || 0,
          tw_impressions_7d: null,  // Not available from user lookup
          tw_likes_7d: metrics.like_count || 0,
          tw_tweets_posted_7d: null,
          captured_by: 'API-Twitter',
          notes: `Auto-synced. Total tweets: ${metrics.tweet_count || 0}, Listed: ${metrics.listed_count || 0}`,
        }

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
          // Insert new snapshot
          const { error: insErr } = await supabase
            .from('snapshots')
            .insert(snapshot)
          if (insErr) {
            results.errors.push(`@${tUser.username}: insert failed — ${insErr.message}`)
          } else {
            results.details.push({ handle: tUser.username, action: 'created', followers: metrics.followers_count })
            results.synced++
          }
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
