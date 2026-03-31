import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APIFY_TOKEN = process.env.APIFY_TOKEN

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: 'APIFY_TOKEN not configured' }), { status: 500 })
  }

  // Fetch all active Twitter accounts
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  // Build search terms: "from:username" for each account
  const searchTerms = accounts.map(a => `from:${a.handle.replace('@', '')}`)

  try {
    // Use apidojo/tweet-scraper to get recent tweets with view counts
    // Process in batches of 5 handles to stay within actor limits
    const batchSize = 5
    for (let i = 0; i < searchTerms.length; i += batchSize) {
      const batchTerms = searchTerms.slice(i, i + batchSize)
      const batchAccounts = accounts.slice(i, i + batchSize)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000) // 90s timeout

      try {
        const runRes = await fetch(
          `https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              searchTerms: batchTerms,
              maxItems: batchTerms.length * 50, // ~50 tweets per handle
              sort: 'Latest',
              includeSearchTerms: false,
            }),
          }
        )
        clearTimeout(timer)

        if (!runRes.ok) {
          const errText = await runRes.text()
          results.errors.push(`Apify error ${runRes.status}: ${errText.slice(0, 200)}`)
          continue
        }

        const tweets = await runRes.json()

        // Group tweets by author username and sum views for last 7 days
        const viewsByUser = {}
        for (const tweet of tweets) {
          const author = (tweet.author?.userName || tweet.user?.screen_name || '').toLowerCase()
          if (!author) continue

          // Check if tweet is within last 7 days
          const tweetDate = tweet.createdAt || tweet.created_at
          if (tweetDate) {
            const dateStr = new Date(tweetDate).toISOString().split('T')[0]
            if (dateStr < sevenDaysAgo) continue
          }

          const views = parseInt(tweet.viewCount || tweet.views || 0, 10) || 0
          if (!viewsByUser[author]) viewsByUser[author] = { views: 0, tweetCount: 0 }
          viewsByUser[author].views += views
          viewsByUser[author].tweetCount++
        }

        // Update snapshots for each account in this batch
        for (const account of batchAccounts) {
          const handle = account.handle.replace('@', '').toLowerCase()
          const userData = viewsByUser[handle]

          if (!userData) {
            results.skipped++
            results.errors.push(`@${handle}: no tweets found in Apify results`)
            continue
          }

          // Update today's snapshot with view data
          const { data: existing } = await supabase
            .from('snapshots')
            .select('id')
            .eq('account_id', account.id)
            .eq('snapshot_date', today)
            .limit(1)

          const viewData = {
            tw_views_7d: userData.views,
            tw_tweets_posted_7d: userData.tweetCount,
          }

          if (existing && existing.length > 0) {
            const { error: upErr } = await supabase
              .from('snapshots')
              .update(viewData)
              .eq('id', existing[0].id)
            if (upErr) {
              results.errors.push(`@${handle}: update failed — ${upErr.message}`)
            } else {
              results.details.push({ handle, action: 'updated', views: userData.views, tweets: userData.tweetCount })
              results.synced++
            }
          } else {
            // Create a new snapshot with just view data
            const { error: insErr } = await supabase
              .from('snapshots')
              .insert({
                account_id: account.id,
                snapshot_date: today,
                captured_by: 'API-Twitter-Views',
                ...viewData,
              })
            if (insErr) {
              results.errors.push(`@${handle}: insert failed — ${insErr.message}`)
            } else {
              results.details.push({ handle, action: 'created', views: userData.views, tweets: userData.tweetCount })
              results.synced++
            }
          }
        }
      } catch (err) {
        clearTimeout(timer)
        if (err.name === 'AbortError') {
          results.errors.push(`Batch ${i / batchSize + 1} timed out after 90s`)
        } else {
          results.errors.push(`Batch ${i / batchSize + 1} error: ${err.message}`)
        }
      }
    }
  } catch (err) {
    results.errors.push(`Request failed: ${err.message}`)
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
