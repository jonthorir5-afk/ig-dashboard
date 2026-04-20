import { useMemo, useState } from 'react'
import { normalizeTrackingToken } from './helpers'
import { inputStyle } from './styles'

function buildDiscoveryMessage(acc, discovery, normalizedLinkCount) {
  const targetSlug = normalizeTrackingToken(
    acc?.of_username_override ||
      acc?.handle ||
      acc?.model?.of_username ||
      acc?.model?.display_name ||
      acc?.model?.name
  )

  if (!targetSlug) return null

  const connected = (discovery?.connectedAccounts || []).find(account =>
    normalizeTrackingToken(account.username) === targetSlug
  )

  if (!connected) return `No connected OF account found for @${targetSlug}.`

  const relatedError = (discovery?.errors || []).find(error => {
    const lower = error.toLowerCase()
    return lower.includes(targetSlug) || lower.includes(connected.name?.toLowerCase?.() || '')
  })

  if (relatedError && relatedError.includes('NEEDS_REAUTHENTICATION')) {
    return `@${targetSlug} needs re-authentication in OnlyFansAPI.`
  }

  if (!normalizedLinkCount) {
    return `Connected OF account found for @${targetSlug}, but 0 tracking links were returned.`
  }

  return null
}

export default function MappingInput({ acc, currentMapping, ofLinks, discovery, onSave }) {
  const [text, setText] = useState(currentMapping?.tracking_link_name || '')
  const [isOpen, setIsOpen] = useState(false)

  const normalizedLinks = useMemo(
    () =>
      ofLinks.map(link => {
        const name = (link.campaignName || link.name || link.label || '').trim()
        const url = (link.campaignUrl || link.url || link.link || '').trim()
        const normalizedUrl = url.toLowerCase().replace(/\/$/, '')
        const shortCode = normalizedUrl.match(/\/(c\d+)(?:$|[/?#])/i)?.[1]?.toLowerCase() || ''
        const modelSlug = normalizedUrl.match(/onlyfans\.com\/([^/?#]+)/i)?.[1]?.toLowerCase() || ''

        return {
          ...link,
          name,
          url,
          normalizedName: name.toLowerCase(),
          normalizedUrl,
          shortCode,
          modelSlug,
        }
      }),
    [ofLinks]
  )

  const filteredLinks = useMemo(() => {
    const query = text.toLowerCase().trim().replace(/\/$/, '')
    if (!query) return normalizedLinks.slice(0, 12)

    return normalizedLinks
      .filter(link =>
        link.normalizedName.includes(query) ||
        link.normalizedUrl.includes(query) ||
        link.shortCode.includes(query) ||
        link.modelSlug.includes(query)
      )
      .slice(0, 12)
  }, [normalizedLinks, text])

  const manualUrlOption = useMemo(() => {
    const raw = text.trim()
    if (!/^https?:\/\/(www\.)?onlyfans\.com\/[^/?#]+\/c\d+\/?$/i.test(raw)) return null

    const normalizedUrl = raw.replace(/\/$/, '')
    const existing = normalizedLinks.find(link => link.normalizedUrl === normalizedUrl.toLowerCase())
    if (existing) return null

    return {
      name: raw,
      url: raw,
      normalizedUrl: normalizedUrl.toLowerCase(),
    }
  }, [normalizedLinks, text])

  const discoveryMessage = useMemo(
    () => buildDiscoveryMessage(acc, discovery, normalizedLinks.length),
    [acc, discovery, normalizedLinks.length]
  )

  const selectLink = link => {
    setText(link.name || link.url)
    setIsOpen(false)
    onSave(link.name || link.url, link)
  }

  const handleChange = event => {
    const value = event.target.value
    setText(value)
    setIsOpen(true)

    if (value.includes('onlyfans.com') && value.length > 25) {
      console.warn('URL pasted but NOT FOUND natively in the API downloaded tracking links: ', value)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={text}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150)
        }}
        placeholder="Search & select tracking link..."
        style={inputStyle}
      />

      {isOpen && (filteredLinks.length > 0 || manualUrlOption) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: '260px',
            overflowY: 'auto',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          {manualUrlOption && (
            <button
              key={`manual-${manualUrlOption.url}`}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectLink(manualUrlOption)}
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                border: 'none',
                borderBottom: filteredLinks.length ? '1px solid var(--border-color)' : 'none',
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--text-primary)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Use pasted URL</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {manualUrlOption.url}
              </div>
            </button>
          )}

          {filteredLinks.map((link, index) => (
            <button
              key={`${link.name}-${link.url}-${index}`}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectLink(link)}
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                border: 'none',
                borderBottom: index === filteredLinks.length - 1 ? 'none' : '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{link.name || 'Unnamed link'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{link.url}</div>
            </button>
          ))}
        </div>
      )}

      {isOpen && filteredLinks.length === 0 && !manualUrlOption && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 20,
            padding: '0.8rem 0.9rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-tertiary)',
            fontSize: '0.8rem',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          No matching tracking links for this account.
        </div>
      )}

      {discoveryMessage && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {discoveryMessage}
        </div>
      )}
    </div>
  )
}
