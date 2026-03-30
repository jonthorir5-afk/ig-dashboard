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
    if (err.name === 'AbortError') throw new Error(`OF API timeout on ${path}`)
    throw err
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!OF_API_KEY) return json({ error: 'ONLYFANS_API_KEY not configured' }, 500)

  try {
    // Step 1: Get a connected OF account ID (needed for API calls)
    const accountsRes = await ofFetch('/accounts')
    const ofAccounts = accountsRes.data || accountsRes
    if (!Array.isArray(ofAccounts) || ofAccounts.length === 0) {
      return json({ synced: 0, errors: ['No OF accounts connected at app.onlyfansapi.com'] })
    }
    const acctId = ofAccounts[0].id || ofAccounts[0].account_id

    // Step 2: Get all models with an of_username
    const { data: models, error: modelsErr } = await supabase
      .from('models')
      .select('id, name, of_username')
      .eq('status', 'Active')
      .not('of_username', 'is', null)
    if (modelsErr) throw modelsErr

    const results = { synced: 0, errors: [], details: [] }

    // Step 3: For each model, look up their OF profile subscriber count
    for (const model of models) {
      if (!model.of_username) continue
      const username = model.of_username.replace('@', '').trim()
      if (!username) continue

      try {
        const profileRes = await ofFetch(`/${acctId}/users/${username}`)
        const profile = profileRes.data || profileRes
        const subs = profile.subscribersCount || profile.subscribedCount || profile.fans_count || 0

        // Update model's of_subs column
        const { error: updateErr } = await supabase
          .from('models')
          .update({ of_subs: subs })
          .eq('id', model.id)

        if (updateErr) {
          results.errors.push(`${model.name}: DB error - ${updateErr.message}`)
        } else {
          results.details.push({ model: model.name, of_username: username, subscribers: subs })
          results.synced++
        }
      } catch (err) {
        results.errors.push(`${model.name} (@${username}): ${err.message}`)
      }
    }

    return json(results)
  } catch (err) {
    return json({ synced: 0, errors: [err.message] })
  }
}
