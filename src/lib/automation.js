import { supabase } from './supabase'
import { isDemoMode, mockTasks } from './mockData'

/**
 * Log an action to the audit_log table.
 * Falls back silently if the table doesn't exist yet (client-side only).
 */
export async function logAudit({ action, entity_type, entity_id, details, user_id }) {
  if (isDemoMode()) return
  try {
    await supabase.from('audit_log').insert({
      action,
      entity_type,
      entity_id,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      user_id,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Silently fail — audit log is best-effort
    console.warn('Audit log insert failed (table may not exist yet)')
  }
}

/**
 * Fetch recent audit log entries.
 */
export async function getAuditLog(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, user:profiles(id, display_name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  } catch {
    // Return empty if table doesn't exist
    return []
  }
}

/**
 * Alert rule configuration — stored in localStorage for now.
 * Rules: { vtfr_min, er_min, growth_min_pct, missing_data_days, enabled }
 */
const ALERT_RULES_KEY = 'ig_dashboard_alert_rules'

export const DEFAULT_ALERT_RULES = {
  vtfr_min: 20,
  er_min: 3,
  growth_min_pct: -5,
  missing_data_days: 7,
  zero_posts_enabled: true,
  stale_account_days: 14,
  health_enabled: true,
}

export function getAlertRules() {
  try {
    const stored = localStorage.getItem(ALERT_RULES_KEY)
    if (stored) return { ...DEFAULT_ALERT_RULES, ...JSON.parse(stored) }
  } catch {}
  return { ...DEFAULT_ALERT_RULES }
}

export function saveAlertRules(rules) {
  localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(rules))
}

/**
 * Operator tasks — stored in Supabase tasks table.
 * Falls back to empty if table doesn't exist.
 */
export async function getTasks(filters = {}) {
  if (isDemoMode()) {
    let tasks = [...mockTasks]
    if (filters.assignee_id) tasks = tasks.filter(t => t.assignee_id === filters.assignee_id)
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status)
    if (filters.account_id) tasks = tasks.filter(t => t.account_id === filters.account_id)
    return tasks
  }
  try {
    let query = supabase
      .from('tasks')
      .select('*, assignee:profiles(id, display_name), account:accounts(id, handle, platform)')
      .order('created_at', { ascending: false })

    if (filters.assignee_id) query = query.eq('assignee_id', filters.assignee_id)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.account_id) query = query.eq('account_id', filters.account_id)

    const { data, error } = await query
    if (error) throw error
    return data
  } catch {
    return []
  }
}

export async function createTask(task) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (e) {
    console.warn('Task creation failed (table may not exist):', e.message)
    return null
  }
}

export async function updateTask(id, updates) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (e) {
    console.warn('Task update failed:', e.message)
    return null
  }
}

export async function deleteTask(id) {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  } catch (e) {
    console.warn('Task delete failed:', e.message)
  }
}
