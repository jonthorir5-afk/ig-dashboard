import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const META_APP_ID = process.env.META_APP_ID
const META_REDIRECT_URI = process.env.META_REDIRECT_URI
const META_STATE_SECRET = process.env.META_STATE_SECRET || process.env.META_APP_SECRET
const DEFAULT_SCOPES = 'instagram_business_basic,instagram_business_manage_insights'

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
    return {}
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function signState(payload) {
  const body = base64UrlEncode(JSON.stringify(payload))
  const sig = crypto
    .createHmac('sha256', META_STATE_SECRET)
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!META_APP_ID || !META_REDIRECT_URI || !META_STATE_SECRET) {
    return json({ error: 'Meta Instagram auth is not configured on the server' }, 500)
  }

  try {
    const body = await parseBody(req)
    const accountId = body.account_id
    if (!accountId) return json({ error: 'account_id is required' }, 400)

    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, handle, platform')
      .eq('id', accountId)
      .eq('platform', 'instagram')
      .single()

    if (error || !account) return json({ error: 'Instagram account not found' }, 404)

    const state = signState({
      accountId: account.id,
      handle: account.handle,
      ts: Date.now(),
    })

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: META_REDIRECT_URI,
      response_type: 'code',
      scope: process.env.META_INSTAGRAM_SCOPES || DEFAULT_SCOPES,
      state,
      force_authentication: '1',
      enable_fb_login: '0',
    })

    return json({
      authUrl: `https://www.instagram.com/oauth/authorize?${params.toString()}`,
    })
  } catch (err) {
    return json({ error: err.message || 'Failed to start Instagram auth' }, 500)
  }
}
