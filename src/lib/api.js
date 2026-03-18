import { supabase } from './supabase'

// ============================================================
// MODELS
// ============================================================
export async function getModels() {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getModel(id) {
  const { data, error } = await supabase
    .from('models')
    .select('*, accounts(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createModel(model) {
  const { data, error } = await supabase
    .from('models')
    .insert(model)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateModel(id, updates) {
  const { data, error } = await supabase
    .from('models')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteModel(id) {
  const { error } = await supabase.from('models').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// ACCOUNTS
// ============================================================
export async function getAccounts(filters = {}) {
  let query = supabase
    .from('accounts')
    .select('*, model:models(id, name, display_name), operator:profiles(id, display_name)')
    .order('created_at', { ascending: false })

  if (filters.model_id) query = query.eq('model_id', filters.model_id)
  if (filters.platform) query = query.eq('platform', filters.platform)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.assigned_operator) query = query.eq('assigned_operator', filters.assigned_operator)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAccount(id) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*, model:models(id, name, display_name), operator:profiles(id, display_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createAccount(account) {
  const { data, error } = await supabase
    .from('accounts')
    .insert(account)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(id, updates) {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// SNAPSHOTS
// ============================================================
export async function getSnapshots(accountId, limit = 30) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('account_id', accountId)
    .order('snapshot_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getLatestSnapshots() {
  // Get the most recent snapshot for each account
  const { data, error } = await supabase
    .from('snapshots')
    .select('*, account:accounts(*, model:models(id, name, display_name))')
    .order('snapshot_date', { ascending: false })
  if (error) throw error

  // Deduplicate: keep only the latest per account
  const seen = new Set()
  return data.filter(s => {
    if (seen.has(s.account_id)) return false
    seen.add(s.account_id)
    return true
  })
}

export async function createSnapshot(snapshot) {
  const { data, error } = await supabase
    .from('snapshots')
    .insert(snapshot)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSnapshot(id, updates) {
  const { data, error } = await supabase
    .from('snapshots')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// POSTS (for per-post VTFR / ER calculations)
// ============================================================
export async function getPostsBySnapshot(snapshotId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('post_index')
  if (error) throw error
  return data
}

export async function createPosts(posts) {
  const { data, error } = await supabase
    .from('posts')
    .insert(posts)
    .select()
  if (error) throw error
  return data
}

// ============================================================
// PROFILES / OPERATORS
// ============================================================
export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')
  if (error) throw error
  return data
}

// ============================================================
// EXECUTIVE OVERVIEW QUERIES
// ============================================================
export async function getExecOverview() {
  const [modelsRes, accountsRes, snapshotsRes] = await Promise.all([
    supabase.from('models').select('*').eq('status', 'Active'),
    supabase.from('accounts').select('*, model:models(id, name)'),
    supabase.from('snapshots')
      .select('*, account:accounts(id, platform, handle, health, model_id, model:models(id, name))')
      .gte('snapshot_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })
  ])

  if (modelsRes.error) throw modelsRes.error
  if (accountsRes.error) throw accountsRes.error
  if (snapshotsRes.error) throw snapshotsRes.error

  return {
    models: modelsRes.data,
    accounts: accountsRes.data,
    snapshots: snapshotsRes.data
  }
}
