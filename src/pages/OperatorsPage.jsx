import { useState, useEffect, useMemo } from 'react'
import { Plus, Check, Clock, X, ChevronDown, ChevronUp } from 'lucide-react'
import { getProfiles, getAccounts, getLatestSnapshots } from '../lib/api'
import { formatNumber, healthColor, getSnapshotViews } from '../lib/metrics'
import { getTasks, createTask, updateTask, deleteTask, logAudit } from '../lib/automation'
import { useAuth } from '../contexts/AuthContext'

const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low']
const PRIORITY_COLORS = {
  urgent: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  high: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  normal: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  low: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
}

export default function OperatorsPage() {
  const { user } = useAuth()
  const [operators, setOperators] = useState([])
  const [accounts, setAccounts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskFilter, setTaskFilter] = useState('all') // all | open | done

  // New task form
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', account_id: '' })

  useEffect(() => {
    Promise.all([getProfiles(), getAccounts(), getLatestSnapshots(), getTasks()])
      .then(([ops, accs, snaps, t]) => {
        setOperators(ops); setAccounts(accs); setSnapshots(snaps); setTasks(t)
      })
      .finally(() => setLoading(false))
  }, [])

  const operatorData = useMemo(() => {
    const snapByAccount = {}
    for (const s of snapshots) snapByAccount[s.account_id] = s

    return operators.map(op => {
      const assignedAccounts = accounts.filter(a => a.assigned_operator === op.id)
      const assignedWithSnaps = assignedAccounts.map(a => ({ ...a, snapshot: snapByAccount[a.id] || null }))

      const totalPosts = assignedWithSnaps.reduce((sum, a) => {
        const s = a.snapshot
        if (!s) return sum
        return sum + (s.ig_reels_posted_7d || 0) + (s.ig_stories_posted_7d || 0)
          + (s.tw_tweets_posted_7d || 0) + (s.rd_posts_7d || 0) + (s.tt_videos_posted_7d || 0)
      }, 0)

      const healthIssues = assignedAccounts.filter(a => a.health !== 'Clean')
      const opTasks = tasks.filter(t => t.assignee_id === op.id)
      const openTasks = opTasks.filter(t => t.status !== 'done')
      const doneTasks = opTasks.filter(t => t.status === 'done')

      return {
        ...op,
        accounts: assignedWithSnaps,
        accountCount: assignedAccounts.length,
        totalPosts,
        healthIssues: healthIssues.length,
        postsPerAccount: assignedAccounts.length ? (totalPosts / assignedAccounts.length).toFixed(1) : 0,
        tasks: opTasks,
        openTasks: openTasks.length,
        doneTasks: doneTasks.length,
      }
    })
  }, [operators, accounts, snapshots, tasks])

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !selected) return
    const task = await createTask({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      assignee_id: selected,
      account_id: newTask.account_id || null,
      status: 'open',
      created_by: user?.id,
    })
    if (task) {
      setTasks([task, ...tasks])
      logAudit({ action: 'create_task', entity_type: 'task', entity_id: task.id, details: `Assigned "${newTask.title}" to operator`, user_id: user?.id })
    }
    setNewTask({ title: '', description: '', priority: 'normal', account_id: '' })
    setShowTaskForm(false)
  }

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'open' : 'done'
    const updated = await updateTask(task.id, { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
    if (updated) {
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    }
  }

  const handleDeleteTask = async (taskId) => {
    await deleteTask(taskId)
    setTasks(tasks.filter(t => t.id !== taskId))
  }

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><div className="loader" /></div>

  const selectedOp = selected ? operatorData.find(o => o.id === selected) : null
  const selectedAccounts = selectedOp?.accounts || []
  const filteredTasks = selectedOp?.tasks?.filter(t => {
    if (taskFilter === 'open') return t.status !== 'done'
    if (taskFilter === 'done') return t.status === 'done'
    return true
  }) || []

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Operators</h1>
          <p>{operators.length} team members, {tasks.filter(t => t.status !== 'done').length} open tasks</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOp ? '300px 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Operator list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {operatorData.map(op => (
            <div
              key={op.id}
              className="glass-panel"
              onClick={() => setSelected(op.id === selected ? null : op.id)}
              style={{ padding: '1rem', cursor: 'pointer', border: op.id === selected ? '1px solid var(--accent-primary)' : undefined }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="avatar">{op.display_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{op.display_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{op.role}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{op.accountCount}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>accounts</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                {op.openTasks > 0 && (
                  <span style={{ color: '#f59e0b' }}>{op.openTasks} open task(s)</span>
                )}
                {op.healthIssues > 0 && (
                  <span style={{ color: 'var(--accent-warning)' }}>{op.healthIssues} health issue(s)</span>
                )}
              </div>
            </div>
          ))}
          {operatorData.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', padding: '2rem', textAlign: 'center' }}>No operators yet.</p>
          )}
        </div>

        {/* Selected operator detail */}
        {selectedOp && (
          <div>
            {/* Stats */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>{selectedOp.display_name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Accounts</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.accountCount}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Posts (7d)</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.totalPosts}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Posts/Acct</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOp.postsPerAccount}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Open Tasks</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: selectedOp.openTasks > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                    {selectedOp.openTasks}
                  </p>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem' }}>Tasks</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['all', 'open', 'done'].map(f => (
                      <button
                        key={f}
                        className={`btn ${taskFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: '16px', padding: '4px 12px', fontSize: '0.75rem', textTransform: 'capitalize' }}
                        onClick={() => setTaskFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setShowTaskForm(!showTaskForm)}>
                    <Plus size={14} /> Add Task
                  </button>
                </div>
              </div>

              {/* New task form */}
              {showTaskForm && (
                <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text" placeholder="Task title..."
                      value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                      style={taskInputStyle}
                    />
                    <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={{ ...taskInputStyle, width: '100px' }}>
                      {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={newTask.account_id} onChange={e => setNewTask({ ...newTask, account_id: e.target.value })} style={{ ...taskInputStyle, width: '160px' }}>
                      <option value="">No account</option>
                      {selectedAccounts.map(a => <option key={a.id} value={a.id}>@{a.handle}{a.account_type ? ` (${a.account_type})` : ''}</option>)}
                    </select>
                  </div>
                  <textarea
                    placeholder="Description (optional)..."
                    value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    rows={2} style={{ ...taskInputStyle, resize: 'vertical', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setShowTaskForm(false)}>Cancel</button>
                    <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={handleCreateTask} disabled={!newTask.title.trim()}>
                      <Check size={14} /> Create
                    </button>
                  </div>
                </div>
              )}

              {/* Task list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredTasks.map(task => {
                  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal
                  const isDone = task.status === 'done'
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem',
                      borderRadius: '8px', background: 'var(--bg-tertiary)', opacity: isDone ? 0.6 : 1,
                    }}>
                      <button
                        onClick={() => handleToggleTask(task)}
                        style={{
                          width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isDone ? '#10b981' : 'var(--border-color)'}`,
                          background: isDone ? '#10b981' : 'transparent', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isDone && <Check size={12} color="white" />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none' }}>
                          {task.title}
                        </p>
                        {task.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{task.description}</p>}
                        {task.account && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>@{task.account.handle}</span>}
                      </div>
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: pc.color, background: pc.bg }}>
                        {task.priority}
                      </span>
                      <button className="icon-btn" onClick={() => handleDeleteTask(task.id)} style={{ color: 'var(--text-tertiary)' }} title="Delete task">
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
                {filteredTasks.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    {taskFilter === 'all' ? 'No tasks yet' : `No ${taskFilter} tasks`}
                  </p>
                )}
              </div>
            </div>

            {/* Accounts table */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Platform</th>
                    <th>Type</th>
                    <th>Health</th>
                    <th className="numeric">Followers</th>
                    <th className="numeric">Views 7d</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOp.accounts.map(a => {
                    const hc = healthColor(a.health)
                    return (
                      <tr key={a.id}>
                        <td><strong style={{ color: 'var(--text-primary)' }}>@{a.handle}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{a.platform}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.account_type || '—'}</td>
                        <td>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: hc.color, background: hc.bg }}>
                            {a.health}
                          </span>
                        </td>
                        <td className="numeric">{formatNumber(a.snapshot?.followers)}</td>
                        <td className="numeric">{formatNumber(getSnapshotViews(a.snapshot))}</td>
                      </tr>
                    )
                  })}
                  {selectedOp.accounts.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>No accounts assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const taskInputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '6px',
  border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', fontSize: '0.8rem',
}
