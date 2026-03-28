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

  // Fetch all active Reddit accounts
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, handle, model_id')
    .eq('platform', 'reddit')
    .eq('status', 'Active')

  if (accErr) {
    return new Response(JSON.stringify({ error: accErr.message }), { status: 500 })
  }

  if (!accounts.length) {
    return new Response(JSON.stringify({ message: 'No active Reddit accounts found', synced: 0 }))
  }

  const today = new Date().toISOString().split('T')[0]
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  // Build start URLs for all Reddit accounts
  const startUrls = accounts.map(a => ({
    url: `https://www.reddit.com/user/${a.handle.replace(/^u\//, '')}/`
  }))

  try {
    // Run trudax/reddit-scraper-lite (pay-per-usage, no rental needed)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          maxItems: accounts.length,
          maxPostCount: 0,
          maxComments: 0,
          maxCommunitiesCount: 0,
          maxUserCount: accounts.length,
          scrollTimeout: 40,
          proxy: {
            useApifyProxy: true,
          },
        }),
      }
    )

    if (!runRes.ok) {
      const errText = await runRes.text()
      return new Response(JSON.stringify({ synced: 0, errors: [`Apify error ${runRes.status}: ${errText}`] }), { status: 200 })
    }

    const items = await runRes.json()

    for (const item of items) {
      // Try to match by username from the scraped data
      const username = (item.username || item.name || item.displayName || '').toLowerCase()
      if (!username) continue

      const account = accounts.find(
        a => a.handle.replace(/^u\//, '').toLowerCase() === username
      )
      if (!account) continue

      // Calculate account age in days
      const createdUtc = item.createdAt || item.created_utc || item.created
      let accountAgeDays = null
      if (createdUtc) {
        const created = new Date(typeof createdUtc === 'number' ? createdUtc * 1000 : createdUtc)
        if (!isNaN(created.getTime())) {
          accountAgeDays = Math.floor((Date.now() - created.getTime()) / 86400000)
        }
      }

      const postKarma = item.linkKarma || item.link_karma || 0
      const commentKarma = item.commentKarma || item.comment_karma || 0
      const totalKarma = item.totalKarma || item.total_karma || (postKarma + commentKarma)

      const snapshot = {
        account_id: account.id,
        snapshot_date: today,
        followers: item.subscribers || item.followers || 0,
        rd_karma_total: totalKarma,
        rd_account_age_days: accountAgeDays,
        captured_by: 'API-Reddit',
        notes: `Auto-synced via Apify. Post karma: ${postKarma}, Comment karma: ${commentKarma}`,
      }

      // Check if we already have a snapshot for today
      const { data: existing } = await supabase
        .from('snapshots')
        .select('id')
        .eq('account_id', account.id)
        .eq('snapshot_date', today)
        .limit(1)

      if (existing && existing.length > 0) {
        const { error: upErr } = await supabase
          .from('snapshots')
          .update(snapshot)
          .eq('id', existing[0].id)
        if (upErr) {
          results.errors.push(`u/${username}: update failed — ${upErr.message}`)
        } else {
          results.details.push({ handle: username, action: 'updated', karma: totalKarma })
          results.synced++
        }
      } else {
        const { error: insErr } = await supabase
          .from('snapshots')
          .insert(snapshot)
        if (insErr) {
          results.errors.push(`u/${username}: insert failed — ${insErr.message}`)
        } else {
          results.details.push({ handle: username, action: 'created', karma: totalKarma })
          results.synced++
        }
      }
    }

    // Check for accounts that weren't found
    const syncedHandles = results.details.map(d => d.handle.toLowerCase())
    for (const acc of accounts) {
      const handle = acc.handle.replace(/^u\//, '').toLowerCase()
      if (!syncedHandles.includes(handle)) {
        results.errors.push(`u/${handle}: not found in scraper results`)
        results.skipped++
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
