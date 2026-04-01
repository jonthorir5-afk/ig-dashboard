import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const OF_API_KEY = process.env.ONLYFANS_API_KEY
const OF_API_BASE = 'https://app.onlyfansapi.com/api'

async function ofFetch(path, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${OF_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${OF_API_KEY}`,
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
    if (err.name === 'AbortError') throw new Error(`OF API timeout on ${path}`)
    throw err
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function parseBody(req) {
  try {
    return await req.json()
  } catch {
    try {
      const text = await req.text()
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }
}

function normalizeUsername(value) {
  return (value || '').toLowerCase().trim().replace(/^@/, '')
}

function getSubscriberCount(account) {
  const userData = account.onlyfans_user_data || account
  return userData.subscribersCount
    || userData.activeSubscribersCount
    || userData.subscribedCount
    || userData.fans_count
    || account.subscribersCount
    || 0
}

async function listTrackingLinksForAccount(accountId) {
  const links = []
  let offset = 0
  const limit = 100

  while (true) {
    const res = await ofFetch(`/${accountId}/tracking-links?limit=${limit}&offset=${offset}`)
    const payload = res.data || res
    const batch = payload.list || payload.items || payload.data || payload.results || []

    if (!Array.isArray(batch) || batch.length === 0) break

    links.push(...batch)

    const hasMore = Boolean(payload.hasMore) || Boolean(payload.has_more)
    if (!hasMore && batch.length < limit) break
    offset += batch.length
  }

  return links
}

function normalizeTrackingLink(link, account) {
  const url = (link.campaignUrl || link.url || link.link || link.tracking_url || '').trim()
  const name = (link.campaignName || link.name || link.label || link.campaign_code || '').trim()

  return {
    ...link,
    accountId: account.id,
    accountName: account.display_name || account.name || account.onlyfans_username || account.username || '',
    accountUsername: account.onlyfans_username || account.username || account.onlyfans_user_data?.username || '',
    id: link.id || link.trackingLinkId || link.tracking_link_id || `${account.id}:${name || url}`,
    campaignName: name,
    campaignUrl: url,
    clicks: Number(link.clicks ?? link.click_count ?? link.clicksCount ?? 0),
    subscribers: Number(link.subscribers ?? link.subscriber_count ?? link.subscribersCount ?? 0),
    revenue: Number(link.revenue ?? link.totalRevenue ?? link.revenue_total ?? 0),
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!OF_API_KEY) return json({ error: 'ONLYFANS_API_KEY not configured' }, 500)

  try {
    const body = await parseBody(req)
    const action = body.action || 'sync'

    const accountsRes = await ofFetch('/accounts')
    const ofAccounts = accountsRes.data || accountsRes

    if (!Array.isArray(ofAccounts) || ofAccounts.length === 0) {
      return json({ synced: 0, errors: ['No OF accounts connected at app.onlyfansapi.com'] })
    }

    const { data: models, error: modelsErr } = await supabase
      .from('models')
      .select('id, name, display_name, of_username')
      .eq('status', 'Active')
      .not('of_username', 'is', null)

    if (modelsErr) throw modelsErr

    const results = { action, synced: 0, errors: [], details: [] }
    const today = new Date().toISOString().split('T')[0]

    const trackingLinks = []
    for (const account of ofAccounts) {
      try {
        const links = await listTrackingLinksForAccount(account.id)
        trackingLinks.push(...links.map(link => normalizeTrackingLink(link, account)))
      } catch (err) {
        results.errors.push(`Tracking links for ${account.display_name || account.id}: ${err.message}`)
      }
    }

    if (action === 'discover') {
      return json({
        action,
        synced: 0,
        errors: results.errors,
        trackingLinks,
        connectedAccounts: ofAccounts.map(account => ({
          id: account.id,
          name: account.display_name || account.name || account.onlyfans_username || account.username || account.id,
          username: account.onlyfans_username || account.username || account.onlyfans_user_data?.username || '',
        })),
      })
    }

    for (const model of models) {
      const dbUsername = normalizeUsername(model.of_username)
      if (!dbUsername) continue

      const matchedAccount = ofAccounts.find(account => {
        const apiUsername = normalizeUsername(account.onlyfans_username || account.username)
        const apiUserData = normalizeUsername(account.onlyfans_user_data?.username)
        const apiName = normalizeUsername(account.display_name || account.name)
        return apiUsername === dbUsername || apiUserData === dbUsername || apiName.includes(dbUsername)
      })

      if (!matchedAccount) {
        results.errors.push(`${model.name} (@${dbUsername}): No matching connected OF account found`)
        continue
      }

      const subs = getSubscriberCount(matchedAccount)
      const { error: updateErr } = await supabase
        .from('models')
        .update({ of_subs: subs })
        .eq('id', model.id)

      if (updateErr) {
        results.errors.push(`${model.name}: DB error - ${updateErr.message}`)
        continue
      }

      const { data: existingSnapshot } = await supabase
        .from('model_snapshots')
        .select('id')
        .eq('model_id', model.id)
        .eq('snapshot_date', today)
        .limit(1)

      if (existingSnapshot && existingSnapshot.length > 0) {
        await supabase
          .from('model_snapshots')
          .update({ of_subs: subs })
          .eq('id', existingSnapshot[0].id)
      } else {
        await supabase
          .from('model_snapshots')
          .insert({
            model_id: model.id,
            snapshot_date: today,
            of_subs: subs,
            notes: 'Auto-synced via OF API',
          })
      }

      results.details.push({
        model: model.name,
        of_username: dbUsername,
        matched_to: matchedAccount.display_name || matchedAccount.onlyfans_username || 'unknown',
        subscribers: subs,
      })
      results.synced++
    }

    const { data: mappings, error: mappingsErr } = await supabase
      .from('of_link_mappings')
      .select('model_id, account_id, tracking_link_name, tracking_link_url')

    if (mappingsErr) throw mappingsErr

    for (const mapping of mappings || []) {
      const matchedLink = trackingLinks.find(link =>
        (mapping.tracking_link_name && link.campaignName === mapping.tracking_link_name) ||
        (mapping.tracking_link_url && link.campaignUrl === mapping.tracking_link_url)
      )

      if (!matchedLink) continue

      await supabase
        .from('of_tracking')
        .upsert({
          model_id: mapping.model_id,
          account_id: mapping.account_id,
          tracking_link_name: mapping.tracking_link_name,
          tracking_link_url: matchedLink.campaignUrl,
          snapshot_date: today,
          clicks: matchedLink.clicks,
          subscribers: matchedLink.subscribers,
          revenue_total: matchedLink.revenue,
          revenue_per_subscriber: matchedLink.subscribers > 0 ? matchedLink.revenue / matchedLink.subscribers : 0,
          revenue_per_click: matchedLink.clicks > 0 ? matchedLink.revenue / matchedLink.clicks : 0,
        }, { onConflict: 'model_id,tracking_link_name,snapshot_date' })
    }

    return json({
      ...results,
      trackingLinks,
      connectedAccounts: ofAccounts.length,
      connectedAccountsList: ofAccounts.map(account => ({
        id: account.id,
        display_name: account.display_name,
        onlyfans_username: account.onlyfans_username,
        username: account.username,
        user_data_username: account.onlyfans_user_data?.username,
        subscribersCount: getSubscriberCount(account),
      })),
    })
  } catch (err) {
    return json({ synced: 0, errors: [err.message] })
  }
}
