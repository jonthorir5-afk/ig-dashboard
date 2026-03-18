import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Filter, X, Download, Edit2, Trash2 } from 'lucide-react'
import { getAccounts, getModels, getProfiles, createAccount, updateAccount, deleteAccount } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { healthColor, exportToCSV } from '../lib/metrics'

const PLATFORMS = ['instagram', 'twitter', 'reddit', 'tiktok']
const ACCOUNT_TYPES = ['Primary', 'Secondary', 'Backup', 'Farm']
const ACCOUNT_STATUSES = ['Active', 'Shadowbanned', 'Suspended', 'Warming Up']
const HEALTH_OPTIONS = ['Clean', 'Shadowbanned', 'Restricted', 'Action Blocked', 'Suspended', 'Limited', 'Under Review', 'Karma Farming']

export default function AccountsPage() {
  const { canManage } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [models, setModels] = useState([])
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [form, setForm] = useState({
    model_id: '', platform: 'instagram', handle: '', account_url: '',
    account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: ''
  })

  const load = async () => {
    setLoading(true)
    const [accs, mods, ops] = await Promise.all([getAccounts(), getModels(), getProfiles()])
    setAccounts(accs)
    setModels(mods)
    setOperators(ops)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = accounts
    if (search) result = result.filter(a => a.handle.toLowerCase().includes(search.toLowerCase()) || a.model?.name?.toLowerCase().includes(search.toLowerCase()))
    if (filterPlatform) result = result.filter(a => a.platform === filterPlatform)
    if (filterModel) result = result.filter(a => a.model_id === filterModel)
    if (filterStatus) result = result.filter(a => a.status === filterStatus)
    return result
  }, [accounts, search, filterPlatform, filterModel, filterStatus])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.assigned_operator) delete payload.assigned_operator
    if (editing) {
      await updateAccount(editing, payload)
    } else {
      await createAccount(payload)
    }
    setShowForm(false)
    setEditing(null)
    load()
  }

  const handleEdit = (acc) => {
    setForm({
      model_id: acc.model_id, platform: acc.platform, handle: acc.handle,
      account_url: acc.account_url || '', account_type: acc.account_type,
      status: acc.status, health: acc.health, assigned_operator: acc.assigned_operator || ''
    })
    setEditing(acc.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this account and all its data?')) return
    await deleteAccount(id)
    load()
  }

  const handleExport = () => {
    const rows = filtered.map(a => ({
      handle: a.handle, platform: a.platform, model: a.model?.name,
      type: a.account_type, status: a.status, health: a.health,
      operator: a.operator?.display_name || '', created: a.created_at
    }))
    exportToCSV(rows, 'accounts.csv')
  }

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Accounts</h1>
          <p>{accounts.length} total across all platforms</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={16} /> CSV</button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => {
              setShowForm(true); setEditing(null)
              setForm({ model_id: models[0]?.id || '', platform: 'instagram', handle: '', account_url: '', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: '' })
            }}>
              <Plus size={16} /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ maxWidth: '300px' }}>
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search handles or models..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={selectStyle}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={selectStyle}>
          <option value="">All Models</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="accounts-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Handle</th>
                <th>Platform</th>
                <th>Model</th>
                <th>Type</th>
                <th>Status</th>
                <th>Health</th>
                <th>Operator</th>
                <th>Added</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const hc = healthColor(a.health)
                return (
                  <tr key={a.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{a.platform === 'twitter' ? 'Twitter / X' : a.platform}</td>
                    <td>{a.model?.name || '—'}</td>
                    <td>{a.account_type}</td>
                    <td>{a.status}</td>
                    <td>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                        {a.health}
                      </span>
                    </td>
                    <td>{a.operator?.display_name || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="icon-btn" onClick={() => handleEdit(a)}><Edit2 size={14} /></button>
                          <button className="icon-btn" onClick={() => handleDelete(a.id)} style={{ color: 'var(--accent-danger)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={canManage ? 9 : 8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No accounts match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '90%', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{editing ? 'Edit Account' : 'Add New Account'}</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Model *</label>
                <select required value={form.model_id} onChange={e => setForm({ ...form, model_id: e.target.value })} style={inputStyle}>
                  <option value="">Select a model</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Platform *</label>
                <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={inputStyle}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Handle / Username *</label>
                <input required value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="e.g. rose.model" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Account URL</label>
                <input value={form.account_url} onChange={e => setForm({ ...form, account_url: e.target.value })} placeholder="https://instagram.com/..." style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Account Type</label>
                  <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} style={inputStyle}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    {ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Account Health</label>
                <select value={form.health} onChange={e => setForm({ ...form, health: e.target.value })} style={inputStyle}>
                  {HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assigned Operator</label>
                <select value={form.assigned_operator} onChange={e => setForm({ ...form, assigned_operator: e.target.value })} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editing ? 'Save' : 'Add Account'}</button>
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
const selectStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer'
}
