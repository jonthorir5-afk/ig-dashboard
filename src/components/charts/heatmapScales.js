export function viewsColorScale(value) {
  if (value >= 100000) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 50000) return 'rgba(16, 185, 129, 0.7)'
  if (value >= 20000) return 'rgba(16, 185, 129, 0.5)'
  if (value >= 5000) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 1000) return 'rgba(245, 158, 11, 0.3)'
  return 'rgba(239, 68, 68, 0.3)'
}

export function vtfrColorScale(value) {
  if (value >= 100) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 50) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 30) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 20) return 'rgba(249, 115, 22, 0.5)'
  return 'rgba(239, 68, 68, 0.4)'
}

export function erColorScale(value) {
  if (value >= 10) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 5) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 3) return 'rgba(245, 158, 11, 0.5)'
  return 'rgba(239, 68, 68, 0.4)'
}

export function followerGrowthColorScale(value) {
  if (value >= 20) return 'rgba(4, 120, 87, 0.8)'
  if (value >= 10) return 'rgba(16, 185, 129, 0.6)'
  if (value >= 5) return 'rgba(245, 158, 11, 0.5)'
  if (value >= 0) return 'rgba(245, 158, 11, 0.3)'
  return 'rgba(239, 68, 68, 0.5)'
}
