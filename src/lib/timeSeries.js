function parseDate(value) {
  return new Date(`${value}T00:00:00`)
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function buildDateRange(startDate, endDate) {
  const dates = []
  const current = parseDate(startDate)
  const end = parseDate(endDate)
  while (current <= end) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export function fillDailySeries(rows, {
  keys,
  startDate,
  endDate,
  zeroIsMissingKeys = [],
  treatAllZeroRowAsMissing = false,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const from = startDate || sorted[0]?.date
  const to = endDate || sorted[sorted.length - 1]?.date
  if (!from || !to) return []

  const byDate = new Map(sorted.map(row => [row.date, row]))
  const lastKnown = Object.fromEntries(keys.map(key => [key, null]))

  return buildDateRange(from, to).map(date => {
    const source = byDate.get(date)
    const normalized = {}

    for (const key of keys) {
      const value = source?.[key]
      normalized[key] = zeroIsMissingKeys.includes(key) && (value == null || value === 0)
        ? null
        : value ?? null
    }

    const rowShouldCarry = Boolean(source) && treatAllZeroRowAsMissing && keys.every(key => {
      const value = normalized[key]
      return value == null || value === 0
    })

    const row = { date }
    for (const key of keys) {
      const actual = rowShouldCarry ? null : normalized[key]
      row[key] = actual != null ? actual : lastKnown[key]
      if (row[key] != null) lastKnown[key] = row[key]
    }
    return row
  })
}
