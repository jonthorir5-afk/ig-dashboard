import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Users, Activity, Settings, Bell, UserCircle,
  LogOut, ChevronRight, ChevronDown, Globe, AlertTriangle, ClipboardList, BarChart3, FileText,
  Database, TestTube2
} from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { isDemoMode, enableDemoMode, disableDemoMode } from './lib/mockData'
import LoginPage from './components/LoginPage'
import ExecOverview from './pages/ExecOverview'
import ModelsPage from './pages/ModelsPage'
import ModelDetailPage from './pages/ModelDetailPage'
import AccountsPage from './pages/AccountsPage'
import PlatformPage from './pages/PlatformPage'
import OperatorsPage from './pages/OperatorsPage'
import DataEntryPage from './pages/DataEntryPage'
import AlertsPage from './pages/AlertsPage'
import BenchmarkPage from './pages/BenchmarkPage'
import WeeklyDigestPage from './pages/WeeklyDigestPage'
import './App.css'

function NavItem({ to, icon: Icon, label, badge, nested, exact }) {
  const location = useLocation()
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'))

  return (
    <Link to={to} className={`nav-item ${isActive ? 'active' : ''} ${nested ? 'nav-nested' : ''}`}>
      <Icon size={nested ? 16 : 20} />
      <span>{label}</span>
      {badge && <span className="badge badge-primary">{badge}</span>}
    </Link>
  )
}

function NavDropdown({ icon: Icon, label, children, nested }) {
  const location = useLocation()
  const getAllPaths = (items) => {
    let paths = []
    for (const c of items) {
      if (c.to) paths.push(c.to)
      if (c.children) paths = paths.concat(getAllPaths(c.children))
    }
    return paths
  }
  const allPaths = getAllPaths(children)
  const isActive = allPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        className={`nav-item ${isActive ? 'active' : ''} ${nested ? 'nav-nested' : ''}`}
        onClick={() => setOpen(!open)}
        style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <Icon size={nested ? 16 : 20} />
        <span>{label}</span>
        {open ? <ChevronDown size={14} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ paddingLeft: nested ? '0.75rem' : '0' }}>
          {children.map(child =>
            child.children ? (
              <NavDropdown key={child.label} icon={child.icon} label={child.label} children={child.children} nested />
            ) : (
              <NavItem key={child.to} to={child.to} icon={child.icon} label={child.label} nested exact={child.exact} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function DataSourceToggle() {
  const [isDemo, setIsDemo] = useState(isDemoMode())

  const toggle = () => {
    if (isDemo) {
      disableDemoMode()
    } else {
      enableDemoMode()
    }
    setIsDemo(!isDemo)
    window.location.reload()
  }

  return (
    <button
      onClick={toggle}
      className="data-source-toggle"
      title={isDemo ? 'Using mock data — click to switch to real data' : 'Using real data — click to switch to mock data'}
    >
      {isDemo ? <TestTube2 size={16} /> : <Database size={16} />}
      <span>{isDemo ? 'Mock Data' : 'Real Data'}</span>
      <span className={`toggle-indicator ${isDemo ? 'mock' : 'real'}`} />
    </button>
  )
}

function AppShell() {
  const { user, profile, signOut } = useAuth()

  if (!user) return <LoginPage />

  return (
    <Router>
      <div className="app-container">
        <aside className="sidebar glass-panel">
          <div className="sidebar-header">
            <div className="logo-icon flex-center">
              <Activity size={24} color="white" />
            </div>
            <h2 className="text-gradient">Command Center</h2>
          </div>

          <nav className="sidebar-nav">
            <NavItem to="/" icon={LayoutDashboard} label="Overview" />
            <NavItem to="/models" icon={Users} label="Models" />
            <NavDropdown icon={Globe} label="Accounts" children={[
              { to: '/accounts', icon: Globe, label: 'All Accounts' },
              { to: '/platforms/twitter', icon: Activity, label: 'Twitter / X' },
              { to: '/platforms/reddit', icon: Activity, label: 'Reddit' },
              { to: '/platforms/instagram', icon: Activity, label: 'Instagram' },
              { to: '/platforms/tiktok', icon: Activity, label: 'TikTok' },
            ]} />
            <NavItem to="/operators" icon={UserCircle} label="Operators" />
            <NavItem to="/data-entry" icon={ClipboardList} label="Data Entry" />
            <NavDropdown icon={BarChart3} label="Analytics" children={[
              { icon: BarChart3, label: 'Benchmark', children: [
                { to: '/benchmark', icon: BarChart3, label: 'All Platforms', exact: true },
                { to: '/benchmark/twitter', icon: Activity, label: 'Twitter / X' },
                { to: '/benchmark/reddit', icon: Activity, label: 'Reddit' },
                { to: '/benchmark/instagram', icon: Activity, label: 'Instagram' },
                { to: '/benchmark/tiktok', icon: Activity, label: 'TikTok' },
              ]},
              { to: '/digest', icon: FileText, label: 'Weekly Digest' },
              { to: '/alerts', icon: AlertTriangle, label: 'Alerts' },
            ]} />
          </nav>

          <div className="sidebar-footer">
            <DataSourceToggle />
            <div className="user-profile">
              <div className="avatar">{(profile?.display_name || 'U').charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <h4>{profile?.display_name || 'User'}</h4>
                <p style={{ textTransform: 'capitalize' }}>{profile?.role || 'operator'}</p>
              </div>
              <button
                className="icon-btn"
                onClick={signOut}
                title="Sign out"
                style={{ marginLeft: 'auto' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-content animate-fade-in">
            <Routes>
              <Route path="/" element={<ExecOverview />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/models/:id" element={<ModelDetailPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/platforms" element={<Navigate to="/accounts" />} />
              <Route path="/platforms/:platform" element={<PlatformPage />} />
              <Route path="/operators" element={<OperatorsPage />} />
              <Route path="/data-entry" element={<DataEntryPage />} />
              <Route path="/benchmark" element={<BenchmarkPage />} />
              <Route path="/benchmark/:platform" element={<BenchmarkPage />} />
              <Route path="/digest" element={<WeeklyDigestPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
