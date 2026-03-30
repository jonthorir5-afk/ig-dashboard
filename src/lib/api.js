import { supabase } from './supabase'
import { isDemoMode, mockModels, mockAccounts, mockSnapshots, mockProfiles } from './mockData'

// ============================================================
// MODELS
// ============================================================
export async function getModels() {
  if (isDemoMode()) return [...mockModels].sort((a, b) => a.name.localeCompare(b.name))
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getModel(id) {
  if (isDemoMode()) {
    const m = mockModels.find(m => m.id === id)
    if (!m) throw new Error('Not found')
    return { ...m, accounts: mockAccounts.filter(a => a.model_id === id) }
  }
  const { data, error } = await supabase
    .from('models')
    .select('*, accounts(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createModel(model) {
  if (isDemoMode()) return { id: crypto.randomUUID(), ...model, created_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('models')
    .insert(model)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateModel(id, updates) {
  if (isDemoMode()) return { ...mockModels.find(m => m.id === id), ...updates }
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
  if (isDemoMode()) return
  const { error } = await supabase.from('models').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// ACCOUNTS
// ============================================================
export async function getAccounts(filters = {}) {
  if (isDemoMode()) {
    let accs = [...mockAccounts]
    if (filters.model_id) accs = accs.filter(a => a.model_id === filters.model_id)
    if (filters.platform) accs = accs.filter(a => a.platform === filters.platform)
    if (filters.status) accs = accs.filter(a => a.status === filters.status)
    if (filters.assigned_operator) accs = accs.filter(a => a.assigned_operator === filters.assigned_operator)
    return accs
  }
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
  if (isDemoMode()) {
    const a = mockAccounts.find(a => a.id === id)
    if (!a) throw new Error('Not found')
    return a
  }
  const { data, error } = await supabase
    .from('accounts')
    .select('*, model:models(id, name, display_name), operator:profiles(id, display_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createAccount(account) {
  if (isDemoMode()) return { id: crypto.randomUUID(), ...account, created_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('accounts')
    .insert(account)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(id, updates) {
  if (isDemoMode()) return { ...mockAccounts.find(a => a.id === id), ...updates }
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
  if (isDemoMode()) return
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// SNAPSHOTS
// ============================================================
export async function getSnapshots(accountId, limit = 30) {
  if (isDemoMode()) {
    return mockSnapshots
      .filter(s => s.account_id === accountId)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
      .slice(0, limit)
  }
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
  if (isDemoMode()) {
    const sorted = [...mockSnapshots].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
    const seen = new Set()
    return sorted.filter(s => {
      if (seen.has(s.account_id)) return false
      seen.add(s.account_id)
      return true
    })
  }
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
  if (isDemoMode()) return { id: crypto.randomUUID(), ...snapshot, created_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('snapshots')
    .insert(snapshot)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSnapshot(id, updates) {
  if (isDemoMode()) return { id, ...updates }
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
  if (isDemoMode()) return []
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('post_index')
  if (error) throw error
  return data
}

export async function createPosts(posts) {
  if (isDemoMode()) return posts.map(p => ({ id: crypto.randomUUID(), ...p }))
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
  if (isDemoMode()) return [...mockProfiles].sort((a, b) => a.display_name.localeCompare(b.display_name))
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')
  if (error) throw error
  return data
}

// ============================================================
// ANALYTICS — Snapshot history for trend charts
// ============================================================
export async function getSnapshotHistory(accountIds, days = 90) {
  if (isDemoMode()) {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    return mockSnapshots
      .filter(s => accountIds.includes(s.account_id) && s.snapshot_date >= since)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  }
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('snapshots')
    .select('*, account:accounts(id, platform, handle, model_id, model:models(id, name))')
    .in('account_id', accountIds)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllSnapshotHistory(days = 90) {
  if (isDemoMode()) {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    return mockSnapshots
      .filter(s => s.snapshot_date >= since)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  }
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('snapshots')
    .select('*, account:accounts(id, platform, handle, model_id, model:models(id, name))')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
  if (error) throw error
  return data
}

export async function getPostsForAccounts(accountIds, days = 90) {
  if (isDemoMode()) return []
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('posts')
    .select('*, snapshot:snapshots(id, snapshot_date, account_id)')
    .in('account_id', accountIds)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ============================================================
// EXECUTIVE OVERVIEW QUERIES
// ============================================================
export async function getExecOverview() {
  if (isDemoMode()) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
    return {
      models: mockModels.filter(m => m.status === 'Active'),
      accounts: mockAccounts,
      snapshots: mockSnapshots
        .filter(s => s.snapshot_date >= since)
        .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date)),
    }
  }
  const [modelsRes, accountsRes, snapshotsRes, ofTrackingRes] = await Promise.all([
    supabase.from('models').select('*').eq('status', 'Active'),
    supabase.from('accounts').select('*, model:models(id, name)'),
    supabase.from('snapshots')
      .select('*, account:accounts(id, platform, handle, health, model_id, model:models(id, name))')
      .gte('snapshot_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false }),
    supabase.from('of_tracking')
      .select('model_id, subscribers, clicks, revenue_total, tracking_link_name, snapshot_date')
      .order('snapshot_date', { ascending: false })
  ])

  if (modelsRes.error) throw modelsRes.error
  if (accountsRes.error) throw accountsRes.error
  if (snapshotsRes.error) throw snapshotsRes.error
  if (ofTrackingRes.error) throw ofTrackingRes.error

  return {
    models: modelsRes.data,
    accounts: accountsRes.data,
    snapshots: snapshotsRes.data,
    ofTracking: ofTrackingRes.data || [],
  }
}

// ============================================================
// ONLYFANS MAPPINGS
// ============================================================
export async function getLinkMappings() {
  if (isDemoMode()) return []
  const { data, error } = await supabase
    .from('of_link_mappings')
    .select('*')
  if (error) throw error
  return data
}

export async function saveLinkMapping(mapping) {
  if (isDemoMode()) return mapping
  const { data, error } = await supabase
    .from('of_link_mappings')
    .upsert(mapping, { onConflict: 'tracking_link_name' })
    .select()
    .single()
  if (error) throw error
  return data
}

