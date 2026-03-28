import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { getModels, getAccounts, getLatestSnapshots, createModel, updateModel, deleteModel } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const STATUS_OPTIONS = ['Active', 'Onboarding', 'Paused', 'Terminated']
const statusColor = (s) => {
  switch (s) {
    case 'Active': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
    case 'Onboarding': return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' }
    case 'Paused': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    case 'Terminated': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
    default: return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  }
}

const PLATFORMS = [
  { key: 'twitter', label: 'X', icon: '𝕏' },
  { key: 'reddit', label: 'Reddit', icon: 'R' },
  { key: 'instagram', label: 'IG', icon: 'IG' },
  { key: 'tiktok', label: 'TikTok', icon: 'TT' },
  { key: 'of', label: 'OF Subs', icon: 'OF' },
]

const fmt = (n) => {
  if (n == null || n === 0) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}

export default function ModelsPage() {
  const { canManage } = useAuth()
  const [models, setModels] = useState([])
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', display_name: '', status: 'Active', of_username: '', notes: '' })

  const load = () => {
    setLoading(true)
    Promise.all([getModels(), getAccounts(), getLatestSnapshots()])
      .then(([m, a, s]) => { setModels(m); setAccounts(a); setSnapshots(s) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Build per-model, per-platform aggregated metrics
  const modelMetrics = useMemo(() => {
    const metrics = {}
    for (const model of models) {
      metrics[model.id] = { twitter: null, reddit: null, instagram: null, tiktok: null, of: null, totalAccounts: 0 }
      const modelAccounts = accounts.filter(a => a.model_id === model.id)
      metrics[model.id].totalAccounts = modelAccounts.length

      for (const platform of ['twitter', 'reddit', 'instagram', 'tiktok']) {
        const platAccounts = modelAccounts.filter(a => a.platform === platform)
        if (platAccounts.length === 0) continue

        let totalFollowers = 0
        let hasData = false
        for (const acc of platAccounts) {
          const snap = snapshots.find(s => s.account_id === acc.id)
          if (snap) {
            totalFollowers += snap.followers || 0
            hasData = true
          }
        }
        metrics[model.id][platform] = {
          accounts: platAccounts.length,
          followers: hasData ? totalFollowers : null,
        }
      }
    }
    return metrics
  }, [models, accounts, snapshots])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, display_name: form.display_name || form.name }
    if (editing) {
      await updateModel(editing, payload)
    } else {
      await createModel(payload)
    }
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', display_name: '', status: 'Active', of_username: '', notes: '' })
    load()
  }

  const handleEdit = (model) => {
    setForm({ name: model.name, display_name: model.display_name || '', status: model.status, of_username: model.of_username || '', notes: model.notes || '' })
    setEditing(model.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this model and all associated accounts/data?')) return
    await deleteModel(id)
    load()
  }

  if (loading) {
    return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Models</h1>
          <p>{models.length} creator(s) managed</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', display_name: '', status: 'Active', of_username: '', notes: '' }) }}>
            <Plus size={16} /> Add Model
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: '180px' }}>Creator</th>
                {PLATFORMS.map(p => (
                  <th key={p.key} style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{p.icon}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>{p.label}</span>
                    </div>
                  </th>
                ))}
                <th style={{ textAlign: 'center', minWidth: '90px' }}>Status</th>
                {canManage && <th style={{ width: '80px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {models.map(model => {
                const sc = statusColor(model.status)
                const m = modelMetrics[model.id] || {}
                return (
                  <tr key={model.id} style={{ cursor: 'pointer' }}>
                    <td>
                      <Link to={`/models/${model.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {model.display_name || model.name}
                        </span>
                        {model.of_username && (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>OF: @{model.of_username}</span>
                        )}
                      </Link>
                    </td>
                    {PLATFORMS.map(p => {
                      const platData = m[p.key]
                      if (p.key === 'of') {
                        return (
                          <td key={p.key} style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                          </td>
                        )
                      }
                      if (!platData) {
                        return (
                          <td key={p.key} style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                          </td>
                        )
                      }
                      return (
                        <td key={p.key} style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {fmt(platData.followers)}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                              {platData.accounts} acct{platData.accounts !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600, color: sc.color, background: sc.bg }}>
                        {model.status}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleEdit(model) }} title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDelete(model.id) }} title="Delete" style={{ color: 'var(--accent-danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {models.length === 0 && (
        <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '4rem 0' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>No models yet. Add your first creator to get started.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '90%', padding: '30px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{editing ? 'Edit Model' : 'Add New Model'}</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormField label="Model Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} required placeholder="e.g. Rose" />
              <FormField label="Display Name" value={form.display_name} onChange={v => setForm({ ...form, display_name: v })} placeholder="Optional display name" />
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <FormField label="OnlyFans Username" value={form.of_username} onChange={v => setForm({ ...form, of_username: v })} placeholder="e.g. rosemodel" />
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Any notes..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editing ? 'Save Changes' : 'Add Model'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '0.875rem'
}

function FormField({ label, value, onChange, required, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}
