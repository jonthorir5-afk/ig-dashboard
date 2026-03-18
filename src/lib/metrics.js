// ============================================================
// Metric calculation utilities
// ============================================================

/**
 * Calculate VTFR for a single post.
 * VTFR = (Post Views / Account Followers) * 100
 */
export function calcPostVTFR(views, followers) {
  if (!followers || followers === 0) return 0
  return (views / followers) * 100
}

/**
 * Calculate Engagement Rate for a single post.
 * ER = (Likes + Comments + Shares + Saves) / Views * 100
 */
export function calcPostER(post) {
  const views = post.views || 0
  if (views === 0) return 0
  const engagements = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0)
  return (engagements / views) * 100
}

/**
 * Calculate weekly average VTFR from array of posts.
 * Per-post first, then average. NOT sum-then-divide.
 */
export function calcWeeklyVTFR(posts, followers) {
  if (!posts.length || !followers) return 0
  const vtfrs = posts.map(p => calcPostVTFR(p.views, followers))
  return vtfrs.reduce((sum, v) => sum + v, 0) / vtfrs.length
}

/**
 * Calculate weekly average ER from array of posts.
 * Per-post first, then average.
 */
export function calcWeeklyER(posts) {
  if (!posts.length) return 0
  const ers = posts.map(p => calcPostER(p))
  return ers.reduce((sum, v) => sum + v, 0) / ers.length
}

/**
 * VTFR grade + color
 */
export function vtfrGrade(vtfr) {
  if (vtfr >= 1000) return { label: 'Viral', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' }
  if (vtfr >= 100) return { label: 'A', color: '#047857', bg: 'rgba(4, 120, 87, 0.15)' }
  if (vtfr >= 50) return { label: 'B', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
  if (vtfr >= 30) return { label: 'C', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
  if (vtfr >= 20) return { label: 'Below Avg', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' }
  return { label: 'Flop', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
}

/**
 * Engagement Rate grade + color
 */
export function erGrade(er) {
  if (er >= 10) return { label: 'Exceptional', color: '#047857', bg: 'rgba(4, 120, 87, 0.15)' }
  if (er >= 5) return { label: 'On Target', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
  if (er >= 3) return { label: 'Acceptable', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
  return { label: 'Below Target', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
}

/**
 * Week-over-week percentage change
 */
export function wowChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Format large numbers (1.2K, 3.5M, etc.)
 */
export function formatNumber(num) {
  if (num == null) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

/**
 * Get total views from a snapshot depending on platform
 */
export function getSnapshotViews(snapshot) {
  if (!snapshot) return 0
  const platform = snapshot.account?.platform
  switch (platform) {
    case 'instagram': return snapshot.ig_views_7d || 0
    case 'twitter': return snapshot.tw_views_7d || 0
    case 'reddit': return snapshot.rd_total_views_7d || 0
    case 'tiktok': return snapshot.tt_views_7d || 0
    default: return 0
  }
}

/**
 * Get total link clicks from a snapshot depending on platform
 */
export function getSnapshotClicks(snapshot) {
  if (!snapshot) return 0
  const platform = snapshot.account?.platform
  switch (platform) {
    case 'instagram': return snapshot.ig_link_clicks_7d || 0
    case 'twitter': return snapshot.tw_link_clicks_7d || 0
    case 'reddit': return snapshot.rd_link_clicks_7d || 0
    case 'tiktok': return snapshot.tt_link_clicks_7d || 0
    default: return 0
  }
}

/**
 * Health status color mapping
 */
export function healthColor(health) {
  switch (health) {
    case 'Clean': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
    case 'Shadowbanned': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
    case 'Restricted': return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' }
    case 'Action Blocked': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    case 'Suspended': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
    case 'Limited': return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' }
    case 'Under Review': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    case 'Karma Farming': return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
    default: return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  }
}

/**
 * Export array of objects to CSV and trigger download
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val == null) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    )
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
