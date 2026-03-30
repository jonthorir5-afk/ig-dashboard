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
    // Step 1: Get all connected OF accounts (these have real subscriber data)
    const accountsRes = await ofFetch('/accounts')
    const ofAccounts = accountsRes.data || accountsRes
    if (!Array.isArray(ofAccounts) || ofAccounts.length === 0) {
      return json({ synced: 0, errors: ['No OF accounts connected at app.onlyfansapi.com'] })
    }

    // Step 2: Get all models with an of_username
    const { data: models, error: modelsErr } = await supabase
      .from('models')
      .select('id, name, of_username')
      .eq('status', 'Active')
      .not('of_username', 'is', null)
    if (modelsErr) throw modelsErr

    const results = { synced: 0, errors: [], details: [] }

    // Step 3: Match connected OF accounts to models by username
    for (const model of models) {
      if (!model.of_username) continue
      const dbUsername = model.of_username.toLowerCase().replace('@', '').trim()
      if (!dbUsername) continue

      // Find matching connected account
      const matchedAccount = ofAccounts.find(a => {
        const apiUsername = (a.onlyfans_username || a.username || '').toLowerCase().trim()
        const apiUserData = a.onlyfans_user_data?.username?.toLowerCase().trim() || ''
        const apiName = (a.display_name || a.name || '').toLowerCase().trim()
        return apiUsername === dbUsername || apiUserData === dbUsername || apiName.includes(dbUsername)
      })

      if (!matchedAccount) {
        results.errors.push(`${model.name} (@${dbUsername}): No matching connected OF account found`)
        continue
      }

      // Get subscriber count from the connected account data
      const userData = matchedAccount.onlyfans_user_data || matchedAccount
      const subs = userData.subscribersCount
        || userData.activeSubscribersCount
        || userData.subscribedCount
        || userData.fans_count
        || matchedAccount.subscribersCount
        || 0

      const { error: updateErr } = await supabase
        .from('models')
        .update({ of_subs: subs })
        .eq('id', model.id)

      if (updateErr) {
        results.errors.push(`${model.name}: DB error - ${updateErr.message}`)
      } else {
        results.details.push({
          model: model.name,
          of_username: dbUsername,
          matched_to: matchedAccount.display_name || matchedAccount.onlyfans_username || 'unknown',
          subscribers: subs,
        })
        results.synced++
      }
    }

    // Also list unmatched OF accounts for reference
    const matchedUsernames = new Set(results.details.map(d => d.of_username))
    const unmatchedOF = ofAccounts.filter(a => {
      const u = (a.onlyfans_username || a.username || '').toLowerCase()
      return u && !matchedUsernames.has(u)
    }).map(a => ({
      name: a.display_name || a.name,
      username: a.onlyfans_username || a.username,
      subscribers: a.onlyfans_user_data?.subscribersCount || 0,
    }))

    return json({
      ...results,
      connectedAccounts: ofAccounts.length,
      // Debug: show all connected accounts with their username fields
      connectedAccountsList: ofAccounts.map(a => ({
        id: a.id,
        display_name: a.display_name,
        onlyfans_username: a.onlyfans_username,
        username: a.username,
        user_data_username: a.onlyfans_user_data?.username,
        subscribersCount: a.onlyfans_user_data?.subscribersCount || a.subscribersCount || 0,
      })),
      unmatchedOF,
    })
  } catch (err) {
    return json({ synced: 0, errors: [err.message] })
  }
}
