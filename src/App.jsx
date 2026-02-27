import { useState } from 'react'
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { LayoutDashboard, Users, Activity, Settings, Bell } from 'lucide-react'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar glass-panel">
          <div className="sidebar-header">
            <div className="logo-icon flex-center">
              <Activity size={24} color="white" />
            </div>
            <h2 className="text-gradient">Command Center</h2>
          </div>

          <nav className="sidebar-nav">
            <Link to="/" className="nav-item active">
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>
            <Link to="/accounts" className="nav-item">
              <Users size={20} />
              <span>Accounts</span>
              <span className="badge badge-primary">124</span>
            </Link>
            <Link to="/alerts" className="nav-item">
              <Bell size={20} />
              <span>Alert History</span>
            </Link>
            <Link to="/settings" className="nav-item">
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="avatar">A</div>
              <div className="user-info">
                <h4>System Admin</h4>
                <p>Scaling Ops</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <header className="topbar">
            <div className="topbar-search">
              {/* Optional global search */}
            </div>
            <div className="topbar-actions">
              <button className="icon-btn">
                <Bell size={20} />
                <span className="notification-dot"></span>
              </button>
            </div>
          </header>

          <div className="page-content animate-fade-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<div className="placeholder-page"><h2>Accounts View</h2><p>Detailed accounts management coming soon.</p></div>} />
              <Route path="/alerts" element={<div className="placeholder-page"><h2>Alert History</h2><p>Telegram alert logs coming soon.</p></div>} />
              <Route path="/settings" element={<div className="placeholder-page"><h2>Settings View</h2><p>Threshold configuration coming soon.</p></div>} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App
