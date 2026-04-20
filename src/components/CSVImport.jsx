import { useState, useRef } from 'react'
import { Upload, FileText, Check, AlertTriangle, X } from 'lucide-react'
import { createSnapshot } from '../lib/api'
import { logAudit } from '../lib/automation'

/**
 * CSV Bulk Import for snapshots.
 * Expects columns: handle, snapshot_date, followers, [platform-specific fields...]
 * Matches handles to existing accounts.
 */
export default function CSVImport({ accounts, userId, onComplete }) {
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [errors, setErrors] = useState([])
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] })
  const [rawText, setRawText] = useState('')
  const fileRef = useRef()

  const parseCSV = (text) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) { setErrors(['CSV must have a header row and at least one data row']); return }

    const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    setHeaders(hdrs)

    if (!hdrs.includes('handle')) { setErrors(['CSV must include a "handle" column']); return }
    if (!hdrs.includes('snapshot_date')) { setErrors(['CSV must include a "snapshot_date" column']); return }

    const accountByHandle = {}
    for (const a of accounts) accountByHandle[a.handle.toLowerCase()] = a

    const parsed = []
    const errs = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      // Simple CSV parse (handles quoted fields with commas)
      const vals = []
      let inQuote = false, current = ''
      for (const ch of lines[i]) {
        if (ch === '"') { inQuote = !inQuote; continue }
        if (ch === ',' && !inQuote) { vals.push(current.trim()); current = ''; continue }
        current += ch
      }
      vals.push(current.trim())

      const row = {}
      for (let j = 0; j < hdrs.length; j++) {
        row[hdrs[j]] = vals[j] || ''
      }

      const handle = row.handle?.replace('@', '').toLowerCase()
      const account = accountByHandle[handle]

      if (!account) {
        errs.push(`Row ${i + 1}: Unknown handle "@${handle}"`)
        row._status = 'error'
        row._error = `Unknown handle`
      } else if (!row.snapshot_date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        errs.push(`Row ${i + 1}: Invalid date "${row.snapshot_date}" (use YYYY-MM-DD)`)
        row._status = 'error'
        row._error = 'Invalid date'
      } else {
        row._status = 'ready'
        row._account = account
      }

      parsed.push(row)
    }

    setRows(parsed)
    setErrors(errs)
    setStep('preview')
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawText(ev.target.result)
      parseCSV(ev.target.result)
    }
    reader.readAsText(file)
  }

  const handlePaste = () => {
    if (rawText.trim()) parseCSV(rawText)
  }

  const handleImport = async () => {
    setStep('importing')
    let success = 0, failed = 0
    const importErrs = []
    const nextRows = rows.map(row => ({ ...row }))

    for (const row of nextRows) {
      if (row._status !== 'ready') { failed++; continue }

      const account = row._account

      try {
        const data = {
          account_id: account.id,
          snapshot_date: row.snapshot_date,
          captured_by: 'CSV Import',
          created_by: userId,
          followers: Number(row.followers) || null,
          following: Number(row.following) || null,
          notes: row.notes || null,
        }

        // Map platform-specific fields
        const fieldMap = {
          ig_views_7d: 'ig_views_7d', ig_views_30d: 'ig_views_30d', ig_views_90d: 'ig_views_90d',
          ig_reach_7d: 'ig_reach_7d', ig_profile_visits_7d: 'ig_profile_visits_7d',
          ig_link_clicks_7d: 'ig_link_clicks_7d', ig_reels_posted_7d: 'ig_reels_posted_7d',
          ig_stories_posted_7d: 'ig_stories_posted_7d', ig_top_reel_views: 'ig_top_reel_views',
          tw_impressions_7d: 'tw_impressions_7d', tw_views_7d: 'tw_views_7d',
          tw_retweets_7d: 'tw_retweets_7d', tw_likes_7d: 'tw_likes_7d',
          tw_replies_7d: 'tw_replies_7d', tw_link_clicks_7d: 'tw_link_clicks_7d',
          tw_tweets_posted_7d: 'tw_tweets_posted_7d', tw_dms_sent_7d: 'tw_dms_sent_7d',
          tw_dm_response_rate: 'tw_dm_response_rate',
          rd_karma_total: 'rd_karma_total', rd_posts_7d: 'rd_posts_7d',
          rd_avg_upvotes_7d: 'rd_avg_upvotes_7d', rd_total_views_7d: 'rd_total_views_7d',
          rd_comments_received_7d: 'rd_comments_received_7d', rd_top_post_upvotes: 'rd_top_post_upvotes',
          rd_link_clicks_7d: 'rd_link_clicks_7d', rd_subreddits_posted_7d: 'rd_subreddits_posted_7d',
          rd_account_age_days: 'rd_account_age_days',
          tt_views_7d: 'tt_views_7d', tt_likes_7d: 'tt_likes_7d',
          tt_comments_7d: 'tt_comments_7d', tt_shares_7d: 'tt_shares_7d',
          tt_videos_posted_7d: 'tt_videos_posted_7d', tt_avg_watch_time: 'tt_avg_watch_time',
          tt_profile_views_7d: 'tt_profile_views_7d', tt_link_clicks_7d: 'tt_link_clicks_7d',
          tt_live_hours_7d: 'tt_live_hours_7d', tt_live_peak_viewers: 'tt_live_peak_viewers',
          vtfr_weekly: 'vtfr_weekly', engagement_rate_weekly: 'engagement_rate_weekly',
        }

        for (const [csvKey, dbKey] of Object.entries(fieldMap)) {
          if (row[csvKey] != null && row[csvKey] !== '') {
            data[dbKey] = Number(row[csvKey]) || null
          }
        }

        await createSnapshot(data)
        row._status = 'imported'
        success++

        logAudit({
          action: 'csv_import_snapshot',
          entity_type: 'snapshot',
          entity_id: account.id,
          details: `Imported snapshot for @${account.handle} on ${row.snapshot_date}`,
          user_id: userId,
        })
      } catch (e) {
        row._status = 'error'
        row._error = e.message
        importErrs.push(`@${account.handle}: ${e.message}`)
        failed++
      }
    }

    setRows(nextRows)
    setImportResults({ success, failed, errors: importErrs })
    setStep('done')
    if (onComplete) onComplete(success)
  }

  const reset = () => {
    setStep('upload')
    setRows([])
    setHeaders([])
    setErrors([])
    setRawText('')
    setImportResults({ success: 0, failed: 0, errors: [] })
  }

  const readyCount = rows.filter(r => r._status === 'ready').length

  return (
    <div>
      {step === 'upload' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Upload CSV File
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
            Or paste CSV data below:
          </p>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={8}
            placeholder={`handle,snapshot_date,followers,ig_views_7d,ig_link_clicks_7d,ig_reels_posted_7d\nmy_handle,2024-03-15,15000,50000,200,5`}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px', fontFamily: 'monospace',
              border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', fontSize: '0.8rem', resize: 'vertical'
            }}
          />
          <button className="btn btn-primary" onClick={handlePaste} disabled={!rawText.trim()} style={{ marginTop: '0.75rem' }}>
            <FileText size={16} /> Parse CSV
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div>
          {errors.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {errors.length} issue(s) found:
              </p>
              {errors.map((e, i) => <p key={i} style={{ color: '#ef4444', fontSize: '0.8rem', marginLeft: '1rem' }}>{e}</p>)}
            </div>
          )}

          <p style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Preview: <strong>{readyCount}</strong> rows ready to import, <strong>{rows.length - readyCount}</strong> with errors
          </p>

          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="accounts-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Status</th>
                  {headers.slice(0, 8).map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={row._status === 'error' ? { background: 'rgba(239, 68, 68, 0.05)' } : undefined}>
                    <td>
                      {row._status === 'ready' && <Check size={14} color="#10b981" />}
                      {row._status === 'error' && (
                        <span title={row._error}><AlertTriangle size={14} color="#ef4444" /></span>
                      )}
                    </td>
                    {headers.slice(0, 8).map(h => <td key={h}>{row[h] || ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={reset}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={readyCount === 0}>
              <Upload size={16} /> Import {readyCount} Rows
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem' }}>
          <div className="loader" />
          <p style={{ color: 'var(--text-secondary)' }}>Importing snapshots...</p>
        </div>
      )}

      {step === 'done' && (
        <div>
          <div style={{
            padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem',
            background: importResults.failed === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${importResults.failed === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
          }}>
            <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              <Check size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: '#10b981' }} />
              Import Complete
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {importResults.success} imported, {importResults.failed} failed
            </p>
          </div>

          {importResults.errors.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.25rem' }}>Errors:</p>
              {importResults.errors.map((e, i) => (
                <p key={i} style={{ fontSize: '0.8rem', color: '#ef4444' }}>{e}</p>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={reset}>Import More</button>
        </div>
      )}
    </div>
  )
}
