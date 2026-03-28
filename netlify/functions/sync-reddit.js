import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
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

  for (const account of accounts) {
    const username = account.handle.replace(/^u\//, '')

    try {
      // Use old.reddit.com — less restrictive with serverless IPs
      const res = await fetch(`https://old.reddit.com/user/${username}/about.json`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ig-dashboard/1.0; social media metrics)',
          'Accept': 'application/json',
        },
      })

      if (res.status === 404) {
        results.errors.push(`u/${username}: account not found`)
        results.skipped++
        continue
      }

      if (res.status === 403 || res.status === 429) {
        results.errors.push(`u/${username}: rate limited or blocked (${res.status})`)
        results.skipped++
        continue
      }

      if (!res.ok) {
        results.errors.push(`u/${username}: Reddit returned ${res.status}`)
        results.skipped++
        continue
      }

      const json = await res.json()
      const user = json.data

      if (!user) {
        results.errors.push(`u/${username}: no user data returned`)
        results.skipped++
        continue
      }

      // Calculate account age in days
      let accountAgeDays = null
      if (user.created_utc) {
        accountAgeDays = Math.floor((Date.now() / 1000 - user.created_utc) / 86400)
      }

      const totalKarma = (user.link_karma || 0) + (user.comment_karma || 0)

      const snapshot = {
        account_id: account.id,
        snapshot_date: today,
        followers: user.subreddit?.subscribers || 0,
        rd_karma_total: user.total_karma || totalKarma,
        rd_account_age_days: accountAgeDays,
        captured_by: 'API-Reddit',
        notes: `Auto-synced. Post karma: ${user.link_karma || 0}, Comment karma: ${user.comment_karma || 0}`,
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
          results.details.push({ handle: username, action: 'updated', karma: snapshot.rd_karma_total })
          results.synced++
        }
      } else {
        const { error: insErr } = await supabase
          .from('snapshots')
          .insert(snapshot)
        if (insErr) {
          results.errors.push(`u/${username}: insert failed — ${insErr.message}`)
        } else {
          results.details.push({ handle: username, action: 'created', karma: snapshot.rd_karma_total })
          results.synced++
        }
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000))

    } catch (err) {
      results.errors.push(`u/${username}: ${err.message}`)
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
