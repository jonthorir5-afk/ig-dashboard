import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const META_APP_ID = process.env.META_APP_ID
const META_APP_SECRET = process.env.META_APP_SECRET
const META_REDIRECT_URI = process.env.META_REDIRECT_URI
const META_STATE_SECRET = process.env.META_STATE_SECRET || META_APP_SECRET
const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v24.0'

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  })
}

function redirectToApp(req, status, message, extras = {}) {
  const origin = new URL(req.url).origin
  const params = new URLSearchParams()
  params.set('instagram_meta_status', status)
  if (message) params.set('instagram_meta_message', message)
  Object.entries(extras).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value))
  })
  return redirect(`${origin}/#/accounts?${params.toString()}`)
}

function verifyState(rawState) {
  if (!rawState || !META_STATE_SECRET) throw new Error('Missing state configuration')
  const [body, sig] = rawState.split('.')
  if (!body || !sig) throw new Error('Invalid OAuth state')

  const expected = crypto
    .createHmac('sha256', META_STATE_SECRET)
    .update(body)
    .digest('base64url')

  if (sig.length !== expected.length) throw new Error('Invalid OAuth state signature')
  const isValid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!isValid) throw new Error('Invalid OAuth state signature')

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (!payload.accountId || !payload.ts) throw new Error('Invalid OAuth state payload')
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new Error('OAuth state expired')
  return payload
}

async function exchangeCodeForShortLivedToken(code) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: META_REDIRECT_URI,
    code,
  })

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Token exchange failed: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data.error_message || data.error?.message || 'Token exchange failed')
  return data
}

async function exchangeLongLivedToken(accessToken) {
  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', META_APP_SECRET)
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Long-lived token exchange failed: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data.error?.message || 'Long-lived token exchange failed')
  return data
}

async function fetchInstagramIdentity(accessToken) {
  const url = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}/me`)
  url.searchParams.set('fields', 'user_id,username')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Identity lookup failed: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data.error?.message || 'Identity lookup failed')
  return data
}

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 })
  if (!META_APP_ID || !META_APP_SECRET || !META_REDIRECT_URI || !META_STATE_SECRET) {
    return redirectToApp(req, 'error', 'Meta Instagram auth is not configured on the server')
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const rawState = url.searchParams.get('state')
    const errorReason = url.searchParams.get('error_reason') || url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    if (errorReason) {
      return redirectToApp(req, 'error', errorDescription || errorReason)
    }
    if (!code) {
      return redirectToApp(req, 'error', 'Instagram did not return an authorization code')
    }

    const state = verifyState(rawState)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, handle, platform')
      .eq('id', state.accountId)
      .eq('platform', 'instagram')
      .single()

    if (accountError || !account) {
      return redirectToApp(req, 'error', 'Instagram account not found in dashboard')
    }

    const shortLived = await exchangeCodeForShortLivedToken(code)
    const longLived = await exchangeLongLivedToken(shortLived.access_token)
    const identity = await fetchInstagramIdentity(longLived.access_token)

    const expectedHandle = String(account.handle || '').replace(/^@/, '').toLowerCase()
    const returnedHandle = String(identity.username || '').replace(/^@/, '').toLowerCase()
    if (expectedHandle && returnedHandle && expectedHandle !== returnedHandle) {
      return redirectToApp(
        req,
        'error',
        `Connected Instagram account mismatch: expected @${expectedHandle}, got @${returnedHandle}`,
        { account_id: account.id }
      )
    }

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null

    const { error: upsertError } = await supabase
      .from('instagram_connections')
      .upsert({
        account_id: account.id,
        meta_app_user_id: shortLived.user_id || identity.id || null,
        instagram_user_id: identity.user_id || identity.id,
        instagram_username: identity.username || account.handle,
        access_token: longLived.access_token,
        token_expires_at: expiresAt,
        scopes: (process.env.META_INSTAGRAM_SCOPES || 'instagram_business_basic,instagram_business_manage_insights').split(','),
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' })

    if (upsertError) {
      return redirectToApp(req, 'error', upsertError.message, { account_id: account.id })
    }

    await supabase
      .from('accounts')
      .update({ data_source: 'meta_graph' })
      .eq('id', account.id)

    return redirectToApp(req, 'connected', `Instagram connected for @${returnedHandle || expectedHandle}`, { account_id: account.id })
  } catch (err) {
    return redirectToApp(req, 'error', err.message || 'Instagram connection failed')
  }
}
