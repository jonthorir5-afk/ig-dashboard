export function getDisplayHandle(accountOrHandle, platform) {
  const handle = typeof accountOrHandle === 'string' ? accountOrHandle : accountOrHandle?.handle
  const resolvedPlatform = platform || (typeof accountOrHandle === 'object' ? accountOrHandle?.platform : '')

  if (resolvedPlatform === 'reddit') {
    return String(handle || '').replace(/^u\//i, '')
  }

  return handle || ''
}
