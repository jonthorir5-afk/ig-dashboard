export function getDisplayHandle(accountOrHandle, platform) {
  const handle = typeof accountOrHandle === 'string' ? accountOrHandle : accountOrHandle?.handle
  const resolvedPlatform = platform || (typeof accountOrHandle === 'object' ? accountOrHandle?.platform : '')

  if (resolvedPlatform === 'reddit') {
    return String(handle || '').replace(/^u\//i, '')
  }

  return handle || ''
}

export function getAccountProfileUrl(account) {
  if (!account) return null
  if (account.account_url) return account.account_url

  const handle = String(account.handle || '')

  switch (account.platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`
    case 'twitter':
      return `https://x.com/${handle}`
    case 'reddit':
      return `https://reddit.com/user/${handle.replace(/^u\//i, '')}`
    case 'tiktok':
      return `https://tiktok.com/@${handle}`
    default:
      return null
  }
}
