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

  let body = {}
  try { body = await req.json() } catch {}
  const action = body.action || 'discover'

  try {
    // Step 1: Get connected OF accounts
    const accountsRes = await ofFetch('/accounts')
    const ofAccounts = accountsRes.data || accountsRes
    if (!Array.isArray(ofAccounts) || ofAccounts.length === 0) {
      return new Response(JSON.stringify({
        error: 'No OnlyFans accounts connected in OnlyFansAPI. Connect an account at app.onlyfansapi.com first.',
        raw: accountsRes,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Collect tracking links from all connected accounts
    let allTrackingLinks = []
    const accountErrors = []

    for (const ofAcct of ofAccounts) {
      const acctId = ofAcct.id || ofAcct.account_id
      if (!acctId) continue
      try {
        const tlRes = await ofFetch(`/${acctId}/tracking-links`)
        let links = tlRes.data || tlRes
        if (links && Array.isArray(links.list)) links = links.list
        
        if (Array.isArray(links)) {
          allTrackingLinks.push(...links.map(l => ({ ...l, _ofAccountId: acctId, _ofAccountName: ofAcct.name || ofAcct.username || acctId })))
        } else {
          accountErrors.push(`${acctId}: Unexpected response format (no tracking links array found)`)
        }
      } catch (err) {
        accountErrors.push(`${acctId}: ${err.message}`)
      }
    }

    if (action === 'discover') {
      return new Response(JSON.stringify({
        action: 'discover',
        connectedAccounts: ofAccounts.map(a => ({ id: a.id || a.account_id, name: a.name || a.username })),
        trackingLinks: allTrackingLinks.map(l => ({
          ofAccount: l._ofAccountName,
          name: l.campaignName || l.name || l.label,
          code: l.campaignCode || l.code,
          url: l.campaignUrl || l.url || l.link,
          clicks: l.clicksCount || l.clicks || 0,
          subscribers: l.subscribersCount || l.subscribers || 0,
          revenue: l.revenue?.total || l.revenueTotal || 0,
        })),
        errors: accountErrors,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Sync mode: match tracking links to models
    const { data: mappings } = await supabase
      .from('of_link_mappings')
      .select('tracking_link_name, model_id, account_id')

    const { data: models } = await supabase.from('models').select('id, name')
    const { data: accounts } = await supabase.from('accounts').select('id, handle')

    const today = new Date().toISOString().split('T')[0]
    const results = { synced: 0, skipped: 0, errors: [...accountErrors], details: [], unmapped: [] }

    for (const link of allTrackingLinks) {
      const linkName = link.campaignName || link.name || link.label || ''
      const linkUrl = link.campaignUrl || link.url || link.link || ''

      const mapping = mappings?.find(m => m.tracking_link_name === linkName)

      if (!mapping) {
        results.unmapped.push({
          name: linkName,
          url: linkUrl,
          clicks: link.clicksCount || link.clicks || 0,
          subscribers: link.subscribersCount || link.subscribers || 0,
          revenue: link.revenue?.total || link.revenueTotal || 0,
        })
        results.skipped++
        continue
      }

      const model = models?.find(m => m.id === mapping.model_id) || { name: 'Unknown' }
      const matchedAccount = accounts?.find(a => a.id === mapping.account_id)

      const clicks = link.clicksCount || link.clicks || 0
      const subscribers = link.subscribersCount || link.subscribers || 0
      const revenueData = link.revenue || {}
      const totalRevenue = revenueData.total || link.revenueTotal || 0

      const trackingRecord = {
        model_id: mapping.model_id,
        account_id: mapping.account_id || null,
        tracking_link_name: linkName,
        tracking_link_url: linkUrl,
        snapshot_date: today,
        clicks,
        subscribers,
        revenue_total: totalRevenue,
        revenue_per_subscriber: revenueData.revenuePerSubscriber || 0,
        revenue_per_click: revenueData.revenuePerClick || 0,
      }

      const { error: upsertErr } = await supabase
        .from('of_tracking')
        .upsert(trackingRecord, { onConflict: 'model_id,tracking_link_name,snapshot_date' })

      if (upsertErr) {
        results.errors.push(`${model.name} (${link.campaignName || link.name}): ${upsertErr.message}`)
      } else {
        results.details.push({
          model: model.name,
          link: link.campaignName || link.name || link.label,
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
