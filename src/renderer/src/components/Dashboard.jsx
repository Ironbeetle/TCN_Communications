import { useState } from 'react'
import SmsComposer from './SmsComposer'
import EmailComposer from './EmailComposer'
import BulletinCreator from './BulletinCreator'
import Forms from './Forms'
import './Dashboard.css'

function Dashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')

  const handleLogout = async () => {
    await window.electronAPI.auth.logout()
    onLogout()
  }

  // Helper to go back to home
  const goHome = () => setActiveView('home')

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <h1>TCN Communications</h1>
          <nav className="header-nav">
            <button 
              className={`nav-button ${activeView === 'home' || activeView === 'sms' || activeView === 'email' || activeView === 'bulletin' ? 'active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Home
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
            <span className="user-role">{user.role} • {user.department.replace(/_/g, ' ')}</span>
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
              <h2>Welcome back, {user.first_name}!</h2>
              <p>What would you like to do today?</p>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('sms')}>
                <div className="card-icon">📱</div>
                <h3>SMS</h3>
                <p>Send text messages to community members</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('email')}>
                <div className="card-icon">📧</div>
                <h3>Email</h3>
                <p>Send email campaigns with attachments</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('bulletin')}>
                <div className="card-icon">📋</div>
                <h3>Bulletins</h3>
                <p>Post announcements <br/>to the portal</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('forms')}>
                <div className="card-icon">📝</div>
                <h3>Sign-Up Forms</h3>
                <p>Create and manage community forms</p>
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {activeView === 'sms' && (
          <div className="composer-view">
            <button className="back-button" onClick={goHome}>← Back to Home</button>
            <SmsComposer user={user} />
          </div>
        )}

        {activeView === 'email' && (
          <div className="composer-view">
            <button className="back-button" onClick={goHome}>← Back to Home</button>
            <EmailComposer user={user} />
          </div>
        )}

        {activeView === 'bulletin' && (
          <div className="composer-view">
            <button className="back-button" onClick={goHome}>← Back to Home</button>
            <BulletinCreator user={user} />
          </div>
        )}

        {activeView === 'forms' && (
          <Forms user={user} />
        )}
      </main>
    </div>
  )
}

export default Dashboard
