import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const OF_API_KEY = process.env.ONLYFANS_API_KEY
const OF_API_BASE = 'https://app.onlyfansapi.com/api'

async function ofFetch(path, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${OF_API_BASE}${path}`, {
      headers: {
        'Authorization': `Bearer ${OF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OF API ${res.status}: ${text.slice(0, 300)}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error(`OF API timeout after ${timeoutMs / 1000}s on ${path}`)
    throw err
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405)
  }

  if (!OF_API_KEY) {
    return jsonResponse({ error: 'ONLYFANS_API_KEY not configured' }, 500)
  }

  let body = {}
  try { body = await req.json() } catch {}
  const action = body.action || 'discover'

  try {
    // Test mode: just check if the API key works
    if (action === 'test') {
      const start = Date.now()
      const accountsRes = await ofFetch('/accounts', 20000)
      const elapsed = Date.now() - start
      return jsonResponse({
        action: 'test',
        ok: true,
        elapsed: `${elapsed}ms`,
        raw: accountsRes,
      })
    }

    // Step 1: Get connected OF accounts
    const accountsRes = await ofFetch('/accounts', 20000)
    const ofAccounts = accountsRes.data || accountsRes
    if (!Array.isArray(ofAccounts) || ofAccounts.length === 0) {
      return jsonResponse({
        error: 'No OnlyFans accounts connected in OnlyFansAPI. Connect an account at app.onlyfansapi.com first.',
        raw: accountsRes,
      })
    }

    // Step 2: Collect tracking links from all connected accounts
    let allTrackingLinks = []
    const accountErrors = []

    for (const ofAcct of ofAccounts) {
      const acctId = ofAcct.id || ofAcct.account_id
      if (!acctId) continue
      try {
        const tlRes = await ofFetch(`/${acctId}/tracking-links`, 20000)
        let links = tlRes.data || tlRes
        if (links && Array.isArray(links.list)) links = links.list
        if (Array.isArray(links)) {
          allTrackingLinks.push(...links.map(l => ({
            ...l,
            _ofAccountId: acctId,
            _ofAccountName: ofAcct.display_name || ofAcct.onlyfans_username || ofAcct.name || ofAcct.username || acctId,
          })))
        }
      } catch (err) {
        accountErrors.push(`${acctId}: ${err.message}`)
      }
    }

    // Discovery mode: return raw data for inspection
    if (action === 'discover') {
      return jsonResponse({
        action: 'discover',
        connectedAccounts: ofAccounts.map(a => ({
          id: a.id || a.account_id,
          name: a.display_name || a.onlyfans_username || a.name || a.username,
          subscribersCount: a.onlyfans_user_data?.subscribersCount || a.subscribersCount || 0,
        })),
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
      })
    }

    // Sync mode: match tracking links to models by name
    const { data: models } = await supabase
      .from('models')
      .select('id, name, display_name, of_username')
      .eq('status', 'Active')

    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('id, handle, platform, model_id')

    const today = new Date().toISOString().split('T')[0]
    const results = { synced: 0, skipped: 0, errors: [...accountErrors], details: [], unmapped: [] }

    for (const link of allTrackingLinks) {
      const linkName = (link.campaignName || link.name || link.label || '').toLowerCase()
      const linkUrl = (link.campaignUrl || link.url || link.link || '').toLowerCase()

      const model = models?.find(m => {
        const name = (m.name || '').toLowerCase()
        const displayName = (m.display_name || '').toLowerCase()
        const ofUser = (m.of_username || '').toLowerCase()
        return (
          (name && linkName.includes(name)) ||
          (displayName && linkName.includes(displayName)) ||
          (ofUser && linkName.includes(ofUser)) ||
          (ofUser && linkUrl.includes(ofUser))
        )
      })

      if (!model) {
        results.unmapped.push({
          name: link.campaignName || link.name || link.label,
          url: link.campaignUrl || link.url || link.link,
          clicks: link.clicksCount || link.clicks || 0,
          subscribers: link.subscribersCount || link.subscribers || 0,
          revenue: link.revenue?.total || link.revenueTotal || 0,
        })
        results.skipped++
        continue
      }

      const modelAccounts = allAccounts?.filter(a => a.model_id === model.id) || []
      let matchedAccount = null
      for (const acc of modelAccounts) {
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

      const trackingRecord = {
        model_id: model.id,
        account_id: matchedAccount?.id || null,
        tracking_link_name: link.campaignName || link.name || link.label,
        tracking_link_url: link.campaignUrl || link.url || link.link,
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

    return jsonResponse(results)

  } catch (err) {
    return jsonResponse({ synced: 0, errors: [err.message] })
  }
}
