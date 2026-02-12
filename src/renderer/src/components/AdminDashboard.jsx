import { useState, useEffect, lazy, Suspense } from 'react'
import './Dashboard.css'
import './AdminDashboard.css'

// Lazy load heavy components
const Communications = lazy(() => import('./Communications'))
const UserEditor = lazy(() => import('./UserEditor'))
const Forms = lazy(() => import('./Forms'))

const ViewLoadingFallback = () => (
  <div className="view-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
)

function AdminDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    // Load dashboard stats
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Get users count
      const usersResult = await window.electronAPI.auth.getAllUsers()
      const users = usersResult.success ? usersResult.users : []
      
      // Get message history
      const smsHistory = await window.electronAPI.sms.getHistory(null, 100)
      const emailHistory = await window.electronAPI.email.getHistory(null, 100)
      const bulletinHistory = await window.electronAPI.bulletin.getHistory(null, 100)
      const formsResult = await window.electronAPI.forms.getAll()
      
      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => !u.lockedUntil).length,
        smsCount: smsHistory.logs?.length || 0,
        emailCount: emailHistory.logs?.length || 0,
        bulletinCount: bulletinHistory.logs?.length || 0,
        formsCount: formsResult.forms?.length || 0
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleLogout = async () => {
    await window.electronAPI.auth.logout()
    onLogout()
  }

  return (
    <div className="dashboard admin-dashboard">
      <header className="dashboard-header admin-header">
        <div className="header-brand">
          <h1>TCN Admin</h1>
          <nav className="header-nav">
            <button 
              className={`nav-button ${activeView === 'home' ? 'active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Dashboard
            </button>
            <button 
              className={`nav-button ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              Users
            </button>
            <button 
              className={`nav-button ${activeView === 'communications' ? 'active' : ''}`}
              onClick={() => setActiveView('communications')}
            >
              Communications
            </button>
            <button 
              className={`nav-button ${activeView === 'forms' ? 'active' : ''}`}
              onClick={() => setActiveView('forms')}
            >
              Forms
            </button>
          </nav>
        </div>
        <div className="header-user">
          <span className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role admin-badge">Administrator</span>
          </span>
          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {activeView === 'home' && (
          <>
            <div className="welcome-section">
              <h2>Admin Dashboard</h2>
              <p>System overview and management</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card" onClick={() => setActiveView('users')}>
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.totalUsers || '-'}</span>
                  <span className="stat-label">Total Users</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.activeUsers || '-'}</span>
                  <span className="stat-label">Active Users</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📱</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.smsCount || '-'}</span>
                  <span className="stat-label">SMS Sent</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📧</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.emailCount || '-'}</span>
                  <span className="stat-label">Emails Sent</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.bulletinCount || '-'}</span>
                  <span className="stat-label">Bulletins</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('forms')}>
                <div className="stat-icon">📝</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.formsCount || '-'}</span>
                  <span className="stat-label">Forms</span>
                </div>
              </div>
            </div>

            <div className="admin-actions">
              <h3>Quick Actions</h3>
              <div className="dashboard-grid">
                <div className="dashboard-card" onClick={() => setActiveView('users')}>
                  <div className="card-icon">👤</div>
                  <h3>Manage Users</h3>
                  <p>Add, edit, or deactivate staff accounts</p>
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card" onClick={() => setActiveView('communications')}>
                  <div className="card-icon">📨</div>
                  <h3>Communications</h3>
                  <p>Send SMS, emails, and bulletins</p>
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card" onClick={() => setActiveView('forms')}>
                  <div className="card-icon">📝</div>
                  <h3>Sign-Up Forms</h3>
                  <p>Create and manage community forms</p>
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card">
                  <div className="card-icon">⚙️</div>
                  <h3>Settings</h3>
                  <p>Configure system settings</p>
                  <button className="card-button" disabled>Coming Soon</button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === 'users' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <UserEditor currentUser={user} />
          </Suspense>
        )}

        {activeView === 'communications' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <Communications user={user} />
          </Suspense>
        )}

        {activeView === 'forms' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <Forms user={user} />
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
