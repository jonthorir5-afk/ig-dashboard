import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Activity, Settings, Bell, UserCircle,
  LogOut, ChevronRight, Globe, AlertTriangle, ClipboardList, BarChart3, FileText
} from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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

function NavItem({ to, icon: Icon, label, badge }) {
  const location = useLocation()
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link to={to} className={`nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={20} />
      <span>{label}</span>
      {badge && <span className="badge badge-primary">{badge}</span>}
    </Link>
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
            <NavItem to="/accounts" icon={Globe} label="Accounts" />
            <NavItem to="/platforms" icon={Activity} label="Platforms" />
            <NavItem to="/operators" icon={UserCircle} label="Operators" />
            <NavItem to="/data-entry" icon={ClipboardList} label="Data Entry" />
            <NavItem to="/benchmark" icon={BarChart3} label="Benchmark" />
            <NavItem to="/digest" icon={FileText} label="Weekly Digest" />
            <NavItem to="/alerts" icon={AlertTriangle} label="Alerts" />
          </nav>

          <div className="sidebar-footer">
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
              <Route path="/platforms" element={<PlatformPage />} />
              <Route path="/platforms/:platform" element={<PlatformPage />} />
              <Route path="/operators" element={<OperatorsPage />} />
              <Route path="/data-entry" element={<DataEntryPage />} />
              <Route path="/benchmark" element={<BenchmarkPage />} />
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
