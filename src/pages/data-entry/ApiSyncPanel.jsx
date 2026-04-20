import { RefreshCw } from 'lucide-react'

export default function ApiSyncPanel({
  syncing,
  syncResults,
  displaySyncDetails,
  displaySyncErrors,
  onSyncAll,
  onSyncPlatform,
  getFollowerSourceLabel,
}) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>API Sync</h3>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Pull follower counts and metrics from platform APIs for all active accounts. Creates a snapshot for
        today.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={onSyncAll}
          disabled={syncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            padding: '0.65rem 1.5rem',
          }}
        >
          <RefreshCw size={18} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync All Platforms'}
        </button>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>or sync individually:</span>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('instagram')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Instagram</button>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('twitter')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Twitter/X</button>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('twitter-views')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Twitter Views</button>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('reddit')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Reddit</button>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('tiktok-views')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>TikTok Views</button>
        <button className="btn btn-secondary" onClick={() => onSyncPlatform('onlyfans')} disabled={syncing} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>OnlyFans</button>
      </div>

      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
        Syncs run automatically every day at 6:00 AM UTC.
      </p>

      {syncResults && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              background:
                syncResults.errors?.length && !syncResults.synced && !syncResults.trackingLinks
                  ? 'rgba(239,68,68,0.1)'
                  : 'rgba(34,197,94,0.1)',
              border: `1px solid ${
                syncResults.errors?.length && !syncResults.synced && !syncResults.trackingLinks
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(34,197,94,0.3)'
              }`,
            }}
          >
            {syncResults.action === 'discover' && (
              <>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  OnlyFans Discovery: {syncResults.trackingLinks?.length || 0} tracking link(s) found
                </p>
                {syncResults.connectedAccounts?.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Connected accounts: {syncResults.connectedAccounts.map(account => account.name || account.id).join(', ')}
                  </p>
                )}
                {syncResults.trackingLinks?.length > 0 && (
                  <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.8rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px' }}>Link Name</th>
                          <th style={{ padding: '6px 8px' }}>Clicks</th>
                          <th style={{ padding: '6px 8px' }}>Subs</th>
                          <th style={{ padding: '6px 8px' }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncResults.trackingLinks.map((link, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 8px' }}>{link.name}</td>
                            <td style={{ padding: '6px 8px' }}>{(link.clicks || 0).toLocaleString()}</td>
                            <td style={{ padding: '6px 8px' }}>{(link.subscribers || 0).toLocaleString()}</td>
                            <td style={{ padding: '6px 8px' }}>${(link.revenue || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {syncResults.trackingLinks?.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>
                    This is discovery mode — data is not saved yet. Review the links above, then use full
                    sync to save.
                  </p>
                )}
              </>
            )}

            {syncResults.action !== 'discover' && (
              <>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  {syncResults.pending > 0 && syncResults.synced === 0
                    ? `Instagram sync started for ${syncResults.pending} account${syncResults.pending !== 1 ? 's' : ''}`
                    : syncResults.synced > 0
                      ? `Synced ${syncResults.synced} account${syncResults.synced !== 1 ? 's' : ''}`
                      : 'Sync complete'}
                  {syncResults.skipped > 0 && `, ${syncResults.skipped} skipped`}
                </p>
                {syncResults.pending > 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Instagram scraping is running in the background. Keep this page open and results will
                    import automatically.
                  </p>
                )}

                {displaySyncDetails.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Details:
                    </p>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                      {displaySyncDetails.map((detail, index) => (
                        <div key={index} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                          {detail.action === 'started' && syncResults.pending > 0 && 'Instagram background jobs queued'}
                          {detail.handle && `@${detail.handle} — ${detail.action}`}
                          {detail.followers != null && `, ${detail.followers.toLocaleString()} followers`}
                          {detail.karma != null && `, ${detail.karma.toLocaleString()} karma`}
                          {detail.views_7d != null && `, ${detail.views_7d.toLocaleString()} views (7d)`}
                          {detail.views_30d != null && `, ${detail.views_30d.toLocaleString()} views (30d)`}
                          {detail.views != null && !detail.views_7d && `, ${detail.views.toLocaleString()} views`}
                          {detail.tweets_7d != null && `, ${detail.tweets_7d} tweets`}
                          {detail.tweets != null && !detail.tweets_7d && `, ${detail.tweets} tweets`}
                          {detail.videos_7d != null && `, ${detail.videos_7d} videos`}
                          {detail.model && detail.subscribers != null && `${detail.model} (@${detail.of_username || ''}) — ${detail.subscribers.toLocaleString()} subscribers`}
                          {detail.follower_source && (
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                              ({getFollowerSourceLabel(detail.follower_source)})
                            </span>
                          )}
                          {!detail.follower_source && detail.warning && (
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                              ({detail.warning})
                            </span>
                          )}
                          {detail._platform && (
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                              [{detail._platform}]
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syncResults.connectedAccountsList?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Connected OF accounts ({syncResults.connectedAccounts}):
                    </p>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                      {syncResults.connectedAccountsList.map((account, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '4px 0',
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {account.display_name || '?'} — @{account.onlyfans_username || account.username || account.user_data_username || '?'} — {(account.subscribersCount || 0).toLocaleString()} subs
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {displaySyncErrors.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginBottom: '0.5rem' }}>
                  Errors:
                </p>
                {displaySyncErrors.map((error, index) => (
                  <p key={index} style={{ fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                    {error}
                  </p>
                ))}
              </div>
            )}

            {syncResults._debug && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  Debug info
                </summary>
                <pre
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '300px',
                    overflow: 'auto',
                    marginTop: '0.5rem',
                  }}
                >
                  {JSON.stringify(syncResults._debug, null, 2)}
                </pre>
              </details>
            )}

            {syncResults._authorsFound && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                Authors found in scrape: {syncResults._authorsFound.join(', ') || 'none'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
