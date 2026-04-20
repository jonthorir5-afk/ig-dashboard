import { getAccountProfileUrl, getDisplayHandle } from '../../lib/accountDisplay'
import { getScopedTrackingLinks } from './helpers'
import MappingInput from './MappingInput'

export default function OnlyFansMappingPanel({
  accounts,
  ofMappings,
  models,
  ofLinks,
  discovery,
  loadingLinks,
  onSaveMapping,
}) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Map OnlyFans Tracking Links</h3>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Assign tracking links to your social media accounts. Search by tracking name or URL. Only mapped
        links are synced.
      </p>

      {loadingLinks ? (
        <div className="flex-center" style={{ padding: '3rem' }}>
          <div className="loader" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {accounts.map(account => {
            const currentMapping = ofMappings.find(mapping => mapping.account_id === account.id)

            return (
              <div
                key={account.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    @{getDisplayHandle(account)}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {account.platform} • {account.model?.name || 'Unknown Model'}
                  </span>
                  {getAccountProfileUrl(account) && (
                    <a
                      href={getAccountProfileUrl(account)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        marginTop: '2px',
                      }}
                    >
                      View Profile ↗
                    </a>
                  )}
                </div>

                <div style={{ flex: 2 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '4px',
                    }}
                  >
                    OF Tracking Link
                  </label>
                  <MappingInput
                    key={`${account.id}:${currentMapping?.tracking_link_name || ''}`}
                    acc={account}
                    currentMapping={currentMapping}
                    ofLinks={getScopedTrackingLinks(account, models, ofLinks)}
                    discovery={discovery}
                    onSave={(linkName, linkDetails) => onSaveMapping(account, linkName, linkDetails)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
