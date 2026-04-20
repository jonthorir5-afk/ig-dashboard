import { Check, ChevronRight, Plus, Save, Trash2 } from 'lucide-react'
import { getDisplayHandle } from '../../lib/accountDisplay'
import { erGrade, vtfrGrade } from '../../lib/metrics'
import { HEALTH_OPTIONS } from './helpers'
import NumField from './NumField'
import { cellInputStyle, inputStyle, labelStyle } from './styles'

const PLATFORM_FIELDS = {
  instagram: [
    ['Following', 'following'],
    ['Views (7d)', 'ig_views_7d'],
    ['Views (30d)', 'ig_views_30d'],
    ['Views (90d)', 'ig_views_90d'],
    ['Reach (7d)', 'ig_reach_7d'],
    ['Profile Visits (7d)', 'ig_profile_visits_7d'],
    ['Link Clicks (7d)', 'ig_link_clicks_7d'],
    ['Reels Posted (7d)', 'ig_reels_posted_7d'],
    ['Stories Posted (7d)', 'ig_stories_posted_7d'],
    ['Top Reel Views', 'ig_top_reel_views'],
    ['Likes (7d)', 'ig_likes_7d'],
    ['Comments (7d)', 'ig_comments_7d'],
    ['Shares (7d)', 'ig_shares_7d'],
    ['Saves (7d)', 'ig_saves_7d'],
  ],
  twitter: [
    ['Impressions (7d)', 'tw_impressions_7d'],
    ['Views (7d)', 'tw_views_7d'],
    ['Retweets (7d)', 'tw_retweets_7d'],
    ['Likes (7d)', 'tw_likes_7d'],
    ['Replies (7d)', 'tw_replies_7d'],
    ['Bookmarks (7d)', 'tw_bookmarks_7d'],
    ['Link Clicks (7d)', 'tw_link_clicks_7d'],
    ['Tweets Posted (7d)', 'tw_tweets_posted_7d'],
    ['DMs Sent (7d)', 'tw_dms_sent_7d'],
    ['DM Response Rate %', 'tw_dm_response_rate'],
  ],
  reddit: [
    ['Karma (Total)', 'rd_karma_total'],
    ['Posts (1d)', 'rd_posts_1d'],
    ['Posts (7d)', 'rd_posts_7d'],
    ['Upvotes (1d)', 'rd_upvotes_1d'],
    ['Upvotes (7d)', 'rd_upvotes_7d'],
    ['Avg Upvotes (1d)', 'rd_avg_upvotes_1d'],
    ['Avg Upvotes (7d)', 'rd_avg_upvotes_7d'],
    ['Total Views (7d)', 'rd_total_views_7d'],
    ['Replies (1d)', 'rd_comments_received_1d'],
    ['Comments Received (7d)', 'rd_comments_received_7d'],
    ['Top Post Upvotes', 'rd_top_post_upvotes'],
    ['Link Clicks (7d)', 'rd_link_clicks_7d'],
    ['Subreddits Posted (7d)', 'rd_subreddits_posted_7d'],
    ['Account Age (Days)', 'rd_account_age_days'],
  ],
  tiktok: [
    ['Views (7d)', 'tt_views_7d'],
    ['Likes (7d)', 'tt_likes_7d'],
    ['Comments (7d)', 'tt_comments_7d'],
    ['Shares (7d)', 'tt_shares_7d'],
    ['Videos Posted (7d)', 'tt_videos_posted_7d'],
    ['Avg Watch Time (sec)', 'tt_avg_watch_time'],
    ['Profile Views (7d)', 'tt_profile_views_7d'],
    ['Link Clicks (7d)', 'tt_link_clicks_7d'],
    ['Live Hours (7d)', 'tt_live_hours_7d'],
    ['Live Peak Viewers', 'tt_live_peak_viewers'],
  ],
}

function updateField(setFields, key, value) {
  setFields(prev => ({ ...prev, [key]: value }))
}

export default function ManualEntryPanel({
  models,
  filteredAccounts,
  selectedModel,
  setSelectedModel,
  selectedAccount,
  setSelectedAccount,
  snapshotDate,
  setSnapshotDate,
  currentAccount,
  previousSnapshot,
  health,
  setHealth,
  fields,
  setFields,
  platform,
  posts,
  postCalcs,
  weeklyVTFR,
  weeklyER,
  notes,
  setNotes,
  saved,
  saving,
  onAddPost,
  onUpdatePost,
  onRemovePost,
  onSave,
  onSaveAndNext,
}) {
  return (
    <>
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Model</label>
          <select
            value={selectedModel}
            onChange={event => {
              setSelectedModel(event.target.value)
              setSelectedAccount('')
            }}
            style={inputStyle}
          >
            <option value="">All Models</option>
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 2, minWidth: '250px' }}>
          <label style={labelStyle}>Account</label>
          <select value={selectedAccount} onChange={event => setSelectedAccount(event.target.value)} style={inputStyle}>
            <option value="">Select an account</option>
            {filteredAccounts.map(account => (
              <option key={account.id} value={account.id}>
                @{getDisplayHandle(account)} ({account.platform}
                {account.account_type ? ` · ${account.account_type}` : ''})
                {account.model?.name ? ` — ${account.model.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '160px' }}>
          <label style={labelStyle}>Snapshot Date</label>
          <input type="date" value={snapshotDate} onChange={event => setSnapshotDate(event.target.value)} style={inputStyle} />
        </div>
      </div>

      {!selectedAccount && (
        <div className="glass-panel flex-center" style={{ padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>
            Select a model and account to begin entering data.
          </p>
        </div>
      )}

      {selectedAccount && currentAccount && (
        <>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <label style={{ ...labelStyle, fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
              Account Health
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(HEALTH_OPTIONS[platform] || ['Clean']).map(option => (
                <button
                  key={option}
                  className={`btn ${health === option ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', padding: '6px 16px' }}
                  onClick={() => setHealth(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>{platform} Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <NumField
                label="Followers"
                value={fields.followers}
                prev={previousSnapshot?.followers}
                onChange={value => updateField(setFields, 'followers', value)}
              />

              {(PLATFORM_FIELDS[platform] || []).map(([label, key]) => (
                <NumField
                  key={key}
                  label={label}
                  value={fields[key]}
                  prev={previousSnapshot?.[key]}
                  onChange={value => updateField(setFields, key, value)}
                />
              ))}
            </div>
          </div>

          {platform === 'reddit' && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <label style={labelStyle}>Ban Log</label>
              <textarea
                value={fields.rd_ban_log || ''}
                onChange={event => updateField(setFields, 'rd_ban_log', event.target.value)}
                rows={3}
                placeholder="Subreddit, date, reason, permanent/temp..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3>
                  Post-Level Data{' '}
                  {platform === 'instagram' && (
                    <span style={{ color: 'var(--accent-warning)', fontSize: '0.75rem' }}>
                      (Required for VTFR/ER)
                    </span>
                  )}
                </h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Enter each post published this week. System calculates VTFR and ER per post + weekly averages.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={onAddPost}>
                <Plus size={16} /> Add Post
              </button>
            </div>

            {posts.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="accounts-table" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Shares</th>
                      <th>Saves</th>
                      <th className="numeric">VTFR</th>
                      <th className="numeric">ER</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post, index) => {
                      const calc = postCalcs[index] || {}
                      const vtfr = vtfrGrade(calc.vtfr || 0)
                      const er = erGrade(calc.er || 0)

                      return (
                        <tr key={index}>
                          <td style={{ color: 'var(--text-tertiary)' }}>{index + 1}</td>
                          <td><input type="number" min="0" value={post.views} onChange={event => onUpdatePost(index, 'views', event.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.likes} onChange={event => onUpdatePost(index, 'likes', event.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.comments} onChange={event => onUpdatePost(index, 'comments', event.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.shares} onChange={event => onUpdatePost(index, 'shares', event.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td><input type="number" min="0" value={post.saves} onChange={event => onUpdatePost(index, 'saves', event.target.value)} style={cellInputStyle} placeholder="0" /></td>
                          <td className="numeric">
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: vtfr.color, background: vtfr.bg }}>
                              {(calc.vtfr || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="numeric">
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: er.color, background: er.bg }}>
                              {(calc.er || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td>
                            <button className="icon-btn" onClick={() => onRemovePost(index)} style={{ color: 'var(--accent-danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {posts.length > 0 && (
              <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Weekly Avg VTFR</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: vtfrGrade(weeklyVTFR).color }}>
                    {weeklyVTFR.toFixed(1)}%
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                      {vtfrGrade(weeklyVTFR).label}
                    </span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Weekly Avg ER</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: erGrade(weeklyER).color }}>
                    {weeklyER.toFixed(2)}%
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                      {erGrade(weeklyER).label}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <label style={labelStyle}>Notes (anomalies, bans, context)</label>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={3}
              placeholder="Any context for this snapshot..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {saved && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--accent-success)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <Check size={18} /> Saved!
              </span>
            )}
            <button className="btn btn-secondary" onClick={onSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-primary" onClick={onSaveAndNext} disabled={saving}>
              <ChevronRight size={16} /> {saving ? 'Saving...' : 'Save & Next'}
            </button>
          </div>
        </>
      )}
    </>
  )
}
