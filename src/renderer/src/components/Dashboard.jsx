import { useState, useEffect, lazy, Suspense } from 'react'
import SmsComposer from './SmsComposer'
import EmailComposer from './EmailComposer'
import BulletinCreator from './BulletinCreator'
import TimesheetForm from './TimesheetForm'
import TravelForm from './TravelForm'
import './Dashboard.css'

// Lazy load Forms component (heavy)
const Forms = lazy(() => import('./Forms'))

const ViewLoadingFallback = () => (
  <div className="view-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
)

function Dashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [memos, setMemos] = useState([])
  const [unreadMemoCount, setUnreadMemoCount] = useState(0)
  const [timesheetStats, setTimesheetStats] = useState({ pending: 0, currentPeriod: null })
  const [travelFormStats, setTravelFormStats] = useState({ pending: 0, drafts: 0 })

  const handleLogout = async () => {
    await window.electronAPI.auth.logout()
    onLogout()
  }

  // Helper to go back to home
  const goHome = () => setActiveView('home')

  // Fetch office memos on mount
  useEffect(() => {
    fetchMemos()
    fetchTimesheetStats()
    fetchTravelFormStats()
  }, [])

  const fetchMemos = async () => {
    try {
      const result = await window.electronAPI.memos.getAll()
      // Handle various response formats - could be array directly or wrapped
      const memosArray = Array.isArray(result) ? result : 
                         Array.isArray(result?.data) ? result.data :
                         Array.isArray(result?.memos) ? result.memos : []
      
      setMemos(memosArray)
      if (memosArray.length > 0 && user?.id) {
        const unread = memosArray.filter(memo => !memo.readBy?.includes(user.id)).length
        setUnreadMemoCount(unread)
      } else {
        setUnreadMemoCount(0)
      }
    } catch (error) {
      console.error('Failed to fetch memos:', error)
      setMemos([])
      setUnreadMemoCount(0)
    }
  }

  const fetchTimesheetStats = async () => {
    try {
      const result = await window.electronAPI.timesheets.getStats(user.id)
      if (result) {
        setTimesheetStats(result)
      }
    } catch (error) {
      console.error('Failed to fetch timesheet stats:', error)
    }
  }

  const fetchTravelFormStats = async () => {
    try {
      const result = await window.electronAPI.travelForms.getStats(user.id)
      if (result) {
        setTravelFormStats(result)
      }
    } catch (error) {
      console.error('Failed to fetch travel form stats:', error)
    }
  }

  const markMemoAsRead = async (memoId) => {
    try {
      await window.electronAPI.memos.markAsRead(memoId, user.id)
      fetchMemos()
    } catch (error) {
      console.error('Failed to mark memo as read:', error)
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <h1>TCN Communications</h1>
          <nav className="header-nav">
            <button 
              className={`nav-button ${activeView === 'home' ? 'active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Home
            </button>
            <button 
              className={`nav-button ${activeView === 'communications' || activeView === 'sms' || activeView === 'email' || activeView === 'bulletin' ? 'active' : ''}`}
              onClick={() => setActiveView('communications')}
            >
              Communications
            </button>
            <button 
              className={`nav-button ${activeView === 'staff' || activeView === 'timesheets' || activeView === 'travel' || activeView === 'memos' ? 'active' : ''}`}
              onClick={() => setActiveView('staff')}
            >
              Staff Tools
              {unreadMemoCount > 0 && <span className="nav-badge">{unreadMemoCount}</span>}
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
            <span className="user-role">{user.role}{user.department ? ` • ${user.department.replace(/_/g, ' ')}` : ''}</span>
          </span>
          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* HOME VIEW - Quick Overview */}
        {activeView === 'home' && (
          <>
            <div className="welcome-section">
              <h2>Welcome back, {user.first_name}!</h2>
              <p>Here's your quick overview for today</p>
            </div>

            {/* Quick Stats Bar */}
            <div className="quick-stats">
              {unreadMemoCount > 0 && (
                <div className="stat-item urgent" onClick={() => setActiveView('memos')}>
                  <span className="stat-icon">📬</span>
                  <span className="stat-text">{unreadMemoCount} unread memo{unreadMemoCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {timesheetStats.currentPeriod && (
                <div className="stat-item" onClick={() => setActiveView('timesheets')}>
                  <span className="stat-icon">⏰</span>
                  <span className="stat-text">Current timesheet due {timesheetStats.currentPeriod}</span>
                </div>
              )}
              {travelFormStats.drafts > 0 && (
                <div className="stat-item" onClick={() => setActiveView('travel')}>
                  <span className="stat-icon">✈️</span>
                  <span className="stat-text">{travelFormStats.drafts} draft travel form{travelFormStats.drafts > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Main Dashboard Sections */}
            <div className="dashboard-sections">
              {/* Communications Section */}
              <div className="dashboard-section">
                <div className="section-header">
                  <h3>📡 Member Communications</h3>
                  <button className="section-link" onClick={() => setActiveView('communications')}>View All →</button>
                </div>
                <div className="section-grid">
                  <div className="mini-card" onClick={() => setActiveView('sms')}>
                    <span className="mini-icon">📱</span>
                    <span className="mini-label">SMS</span>
                  </div>
                  <div className="mini-card" onClick={() => setActiveView('email')}>
                    <span className="mini-icon">📧</span>
                    <span className="mini-label">Email</span>
                  </div>
                  <div className="mini-card" onClick={() => setActiveView('bulletin')}>
                    <span className="mini-icon">📋</span>
                    <span className="mini-label">Bulletins</span>
                  </div>
                </div>
              </div>

              {/* Staff Tools Section */}
              <div className="dashboard-section">
                <div className="section-header">
                  <h3>🏢 Staff Tools</h3>
                  <button className="section-link" onClick={() => setActiveView('staff')}>View All →</button>
                </div>
                <div className="section-grid">
                  <div className="mini-card" onClick={() => setActiveView('memos')}>
                    <span className="mini-icon">📬</span>
                    <span className="mini-label">Office Memos</span>
                    {unreadMemoCount > 0 && <span className="mini-badge">{unreadMemoCount}</span>}
                  </div>
                  <div className="mini-card" onClick={() => setActiveView('timesheets')}>
                    <span className="mini-icon">⏰</span>
                    <span className="mini-label">Timesheets</span>
                  </div>
                  <div className="mini-card" onClick={() => setActiveView('travel')}>
                    <span className="mini-icon">✈️</span>
                    <span className="mini-label">Travel Forms</span>
                  </div>
                </div>
              </div>

              {/* Recent Memos Preview */}
              {memos.length > 0 && (
                <div className="dashboard-section full-width">
                  <div className="section-header">
                    <h3>📌 Recent Office Memos</h3>
                    <button className="section-link" onClick={() => setActiveView('memos')}>View All →</button>
                  </div>
                  <div className="memos-preview">
                    {memos.slice(0, 3).map(memo => (
                      <div 
                        key={memo.id} 
                        className={`memo-preview-card ${!memo.readBy?.includes(user.id) ? 'unread' : ''} priority-${memo.priority}`}
                        onClick={() => {
                          markMemoAsRead(memo.id)
                          setActiveView('memos')
                        }}
                      >
                        <div className="memo-preview-header">
                          <span className={`priority-badge ${memo.priority}`}>{memo.priority}</span>
                          {memo.isPinned && <span className="pinned-badge">📌</span>}
                        </div>
                        <h4>{memo.title}</h4>
                        <p className="memo-preview-content">{memo.content.substring(0, 100)}...</p>
                        <div className="memo-preview-footer">
                          <span className="memo-author">From: {memo.author?.first_name} {memo.author?.last_name}</span>
                          <span className="memo-date">{new Date(memo.createdAt).toLocaleDateString('en-CA', { timeZone: 'UTC' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* COMMUNICATIONS HUB */}
        {activeView === 'communications' && (
          <>
            <div className="view-header">
              <button className="back-button" onClick={goHome}>← Back to Home</button>
              <h2>Member Communications</h2>
              <p>Send messages to TCN community members</p>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('sms')}>
                <div className="card-icon">📱</div>
                <h3>SMS Messages</h3>
                <p>Send text messages to community members via SMS</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('email')}>
                <div className="card-icon">📧</div>
                <h3>Email Campaigns</h3>
                <p>Send email campaigns with attachments to members</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('bulletin')}>
                <div className="card-icon">📋</div>
                <h3>Portal Bulletins</h3>
                <p>Post announcements to the member portal</p>
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* STAFF TOOLS HUB */}
        {activeView === 'staff' && (
          <>
            <div className="view-header">
              <button className="back-button" onClick={goHome}>← Back to Home</button>
              <h2>Staff Tools</h2>
              <p>Internal tools for band office staff</p>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('memos')}>
                <div className="card-icon">📬</div>
                <h3>Office Memos</h3>
                <p>View inter-office communications and announcements</p>
                {unreadMemoCount > 0 && <span className="card-badge">{unreadMemoCount} unread</span>}
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('timesheets')}>
                <div className="card-icon">⏰</div>
                <h3>Timesheets</h3>
                <p>Submit and track your bi-weekly timesheets</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('travel')}>
                <div className="card-icon">✈️</div>
                <h3>Travel Requests</h3>
                <p>Submit travel authorization forms</p>
                {travelFormStats.drafts > 0 && <span className="card-badge">{travelFormStats.drafts} drafts</span>}
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* OFFICE MEMOS VIEW */}
        {activeView === 'memos' && (
          <div className="memos-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('staff')}>← Back to Staff Tools</button>
              <h2>Office Memos</h2>
              <p>Inter-office communications and announcements</p>
            </div>
            <div className="memos-list">
              {memos.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📭</span>
                  <p>No office memos at this time</p>
                </div>
              ) : (
                memos.map(memo => (
                  <div 
                    key={memo.id} 
                    className={`memo-card ${!memo.readBy?.includes(user.id) ? 'unread' : ''} priority-${memo.priority}`}
                    onClick={() => markMemoAsRead(memo.id)}
                  >
                    <div className="memo-header">
                      <div className="memo-badges">
                        <span className={`priority-badge ${memo.priority}`}>{memo.priority}</span>
                        {memo.isPinned && <span className="pinned-badge">📌 Pinned</span>}
                        {!memo.readBy?.includes(user.id) && <span className="unread-badge">New</span>}
                      </div>
                      <span className="memo-date">{new Date(memo.createdAt).toLocaleString()}</span>
                    </div>
                    <h3 className="memo-title">{memo.title}</h3>
                    <div className="memo-content">{memo.content}</div>
                    <div className="memo-footer">
                      <span className="memo-author">
                        From: {memo.author?.first_name} {memo.author?.last_name} 
                        {memo.author?.department && ` • ${memo.author.department.replace(/_/g, ' ')}`}
                      </span>
                      {memo.department && <span className="memo-dept">For: {memo.department.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TIMESHEETS VIEW */}
        {activeView === 'timesheets' && (
          <TimesheetForm 
            user={user} 
            onBack={() => setActiveView('staff')} 
          />
        )}

        {/* TRAVEL FORMS VIEW */}
        {activeView === 'travel' && (
          <TravelForm 
            user={user} 
            onBack={() => setActiveView('staff')} 
          />
        )}

        {/* EXISTING VIEWS */}
        {activeView === 'sms' && (
          <div className="composer-view">
            <button className="back-button" onClick={() => setActiveView('communications')}>← Back to Communications</button>
            <SmsComposer user={user} />
          </div>
        )}

        {activeView === 'email' && (
          <div className="composer-view">
            <button className="back-button" onClick={() => setActiveView('communications')}>← Back to Communications</button>
            <EmailComposer user={user} />
          </div>
        )}

        {activeView === 'bulletin' && (
          <div className="composer-view">
            <button className="back-button" onClick={() => setActiveView('communications')}>← Back to Communications</button>
            <BulletinCreator user={user} />
          </div>
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

export default Dashboard
