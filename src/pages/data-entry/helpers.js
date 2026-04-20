export const INSTAGRAM_SYNC_STORAGE_KEY = 'ig-dashboard-instagram-sync-runs'

export const HEALTH_OPTIONS = {
  instagram: ['Clean', 'Shadowbanned', 'Restricted', 'Action Blocked'],
  twitter: ['Clean', 'Shadowbanned', 'Suspended', 'Limited'],
  reddit: ['Clean', 'Shadowbanned', 'Suspended', 'Karma Farming'],
  tiktok: ['Clean', 'Shadowbanned', 'Suspended', 'Under Review'],
}

export function loadPendingInstagramRuns() {
  try {
    const raw = window.localStorage.getItem(INSTAGRAM_SYNC_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePendingInstagramRuns(runs) {
  try {
    if (!runs.length) {
      window.localStorage.removeItem(INSTAGRAM_SYNC_STORAGE_KEY)
    } else {
      window.localStorage.setItem(INSTAGRAM_SYNC_STORAGE_KEY, JSON.stringify(runs))
    }
  } catch {
    // Ignore localStorage failures.
  }
}

export function dedupeSyncDetails(details = []) {
  const byKey = new Map()
  for (const detail of details) {
    if (detail.action === 'started') {
      byKey.set('started', detail)
      continue
    }

    const key = [
      detail._platform || 'local',
      detail.handle || '',
      detail.action || '',
      detail.model || '',
    ].join(':')

    byKey.set(key, detail)
  }
  return Array.from(byKey.values())
}

export function dedupeStrings(values = []) {
  return Array.from(new Set(values))
}

export function getFollowerSourceLabel(source) {
  if (source === 'scraper') return 'fetched from scraper'
  if (source === 'meta_graph') return 'fetched from Meta'
  if (source === 'saved-value') return 'used saved value'
  if (source === 'previous-snapshot') return 'used previous snapshot'
  if (source === 'missing') return 'followers unavailable from scraper'
  return ''
}

export function normalizeTrackingToken(value) {
  let normalized = (value || '')
    .toLowerCase()
    .trim()
    .replace(/^@/, '')
    .replace(/\s+/g, '')

  if (normalized.startsWith('u/')) normalized = normalized.slice(2)

  return normalized
}

export function getTrackingLinkModelSlug(link) {
  const url = (link?.campaignUrl || link?.url || link?.link || '')
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')

  return url.match(/onlyfans\.com\/([^/?#]+)/i)?.[1] || ''
}

export function getScopedTrackingLinks(account, models, ofLinks) {
  const model = models.find(item => item.id === account.model_id)
  const allowedSlugs = new Set([
    normalizeTrackingToken(account?.of_username_override),
    normalizeTrackingToken(account?.handle),
    normalizeTrackingToken(model?.of_username),
    normalizeTrackingToken(model?.display_name),
    normalizeTrackingToken(model?.name),
  ].filter(Boolean))

  if (!allowedSlugs.size) return ofLinks

  return ofLinks.filter(link => allowedSlugs.has(getTrackingLinkModelSlug(link)))
}
