import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const OF_API_KEY = process.env.ONLYFANS_API_KEY
const OF_API_BASE = 'https://app.onlyfansapi.com/api'

async function ofFetch(path) {
  const res = await fetch(`${OF_API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${OF_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OF API ${res.status}: ${text}`)
  }
  return res.json()
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  if (!OF_API_KEY) {
    return new Response(JSON.stringify({ error: 'ONLYFANS_API_KEY not configured' }), { status: 500 })
  }

  // Check what action is requested
  let body = {}
  try { body = await req.json() } catch {}
  const action = body.action || 'sync'

  try {
    if (action === 'discover') {
      // Discovery mode: just fetch and return tracking links so user can see the data
      const data = await ofFetch('/tracking-links')
      return new Response(JSON.stringify({
        action: 'discover',
        trackingLinks: data.data || data,
        _meta: data._meta || null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Sync mode: fetch tracking links and match to models
    const [trackingRes, { data: models }] = await Promise.all([
      ofFetch('/tracking-links'),
      supabase.from('models').select('id, name, display_name, of_username').eq('status', 'Active'),
    ])

    const trackingLinks = trackingRes.data || trackingRes
    if (!Array.isArray(trackingLinks)) {
      return new Response(JSON.stringify({
        error: 'Unexpected tracking links response',
        raw: trackingLinks,
      }), { status: 200 })
    }

    const today = new Date().toISOString().split('T')[0]
    const results = { synced: 0, skipped: 0, errors: [], details: [], unmapped: [] }

    // Try to match each tracking link to a model by name/label
    for (const link of trackingLinks) {
      const linkName = (link.name || link.label || '').toLowerCase()
      const linkUrl = (link.url || link.link || '').toLowerCase()

      // Try matching by model name, display_name, or of_username
      const model = models?.find(m => {
        const name = (m.name || '').toLowerCase()
        const displayName = (m.display_name || '').toLowerCase()
        const ofUser = (m.of_username || '').toLowerCase()
        return (
          linkName.includes(name) ||
          linkName.includes(displayName) ||
          (ofUser && linkName.includes(ofUser)) ||
          (ofUser && linkUrl.includes(ofUser))
        )
      })

      if (!model) {
        results.unmapped.push({
          name: link.name || link.label,
          url: link.url || link.link,
          clicks: link.clicksCount || link.clicks || 0,
          subscribers: link.subscribersCount || link.subscribers || 0,
          revenue: link.revenue?.total || link.revenueTotal || 0,
        })
        results.skipped++
        continue
      }

      // Get accounts for this model to find the right one
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, handle, platform')
        .eq('model_id', model.id)

      // Try to match the tracking link to a specific account by platform in the link name
      let matchedAccount = null
      for (const acc of (accounts || [])) {
        const handle = acc.handle.toLowerCase()
        const platform = acc.platform.toLowerCase()
        if (linkName.includes(handle) || linkName.includes(platform)) {
          matchedAccount = acc
          break
        }
      }

      const clicks = link.clicksCount || link.clicks || 0
      const subscribers = link.subscribersCount || link.subscribers || 0
      const revenueData = link.revenue || {}
      const totalRevenue = revenueData.total || link.revenueTotal || 0

      // Store as a snapshot note or update existing snapshot
      // For now, store at the model level in a dedicated tracking record
      const trackingRecord = {
        model_id: model.id,
        account_id: matchedAccount?.id || null,
        tracking_link_name: link.name || link.label,
        tracking_link_url: link.url || link.link,
        snapshot_date: today,
        clicks,
        subscribers,
        revenue_total: totalRevenue,
        revenue_per_subscriber: revenueData.revenuePerSubscriber || 0,
        revenue_per_click: revenueData.revenuePerClick || 0,
      }

      // Upsert into of_tracking table
      const { error: upsertErr } = await supabase
        .from('of_tracking')
        .upsert(trackingRecord, { onConflict: 'model_id,tracking_link_name,snapshot_date' })

      if (upsertErr) {
        // Table might not exist yet — store in notes instead
        results.errors.push(`${model.name} (${link.name}): ${upsertErr.message}`)
      } else {
        results.details.push({
          model: model.name,
          link: link.name || link.label,
          account: matchedAccount ? `@${matchedAccount.handle}` : null,
          clicks,
          subscribers,
          revenue: totalRevenue,
        })
        results.synced++
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ synced: 0, errors: [err.message] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
