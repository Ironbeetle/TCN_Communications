import { useState, useEffect, lazy, Suspense } from 'react'
import HelpDrawer from './HelpDrawer'

// Lazy load heavy components
const Forms = lazy(() => import('./Forms'))

const ViewLoadingFallback = () => (
  <div className="view-loading">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
)

function FinanceDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [stats, setStats] = useState(null)
  const [timesheets, setTimesheets] = useState([])
  const [travelForms, setTravelForms] = useState([])
  const [pendingTimesheets, setPendingTimesheets] = useState([])
  const [pendingTravelForms, setPendingTravelForms] = useState([])
  const [memos, setMemos] = useState([])
  const [unreadMemoCount, setUnreadMemoCount] = useState(0)

  // Filters
  const [timesheetFilter, setTimesheetFilter] = useState('SUBMITTED')
  const [travelFormFilter, setTravelFormFilter] = useState('SUBMITTED')

  // Modals
  const [selectedTimesheet, setSelectedTimesheet] = useState(null)
  const [selectedTravelForm, setSelectedTravelForm] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectType, setRejectType] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load all timesheets (finance sees everything)
      const timesheetsResult = await window.electronAPI.timesheets?.getAll(null, null)
      if (timesheetsResult?.success) {
        const timesheetsData = Array.isArray(timesheetsResult.data) ? timesheetsResult.data : []
        setTimesheets(timesheetsData)
        setPendingTimesheets(timesheetsData.filter(t => t.status === 'SUBMITTED'))
      }

      // Load all travel forms (finance sees everything)
      const travelResult = await window.electronAPI.travelForms?.getAll(null, null)
      if (travelResult?.success) {
        const travelData = Array.isArray(travelResult.data) ? travelResult.data :
                           Array.isArray(travelResult.travelForms) ? travelResult.travelForms : []
        setTravelForms(travelData)
        setPendingTravelForms(travelData.filter(t => t.status === 'SUBMITTED'))
      }

      // Load memos
      const memosResult = await window.electronAPI.memos?.getAll()
      const memosData = Array.isArray(memosResult) ? memosResult :
                        Array.isArray(memosResult?.data) ? memosResult.data :
                        Array.isArray(memosResult?.memos) ? memosResult.memos : []
      setMemos(memosData)
      if (memosData.length > 0 && user?.id) {
        setUnreadMemoCount(memosData.filter(memo => !memo.readBy?.includes(user.id)).length)
      }

      // Calculate stats
      const timesheetsData = Array.isArray(timesheetsResult?.data) ? timesheetsResult.data : []
      const travelData = Array.isArray(travelResult?.data) ? travelResult.data :
                         Array.isArray(travelResult?.travelForms) ? travelResult.travelForms : []

      setStats({
        pendingTimesheets: timesheetsData.filter(t => t.status === 'SUBMITTED').length,
        approvedTimesheets: timesheetsData.filter(t => t.status === 'APPROVED').length,
        pendingTravelForms: travelData.filter(t => t.status === 'SUBMITTED').length,
        approvedTravelForms: travelData.filter(t => t.status === 'APPROVED').length,
        totalMemos: memosData.length
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const handleLogout = async () => {
    await window.electronAPI.auth.logout()
    onLogout()
  }

  // Timesheet Functions
  const handleApproveTimesheet = async (timesheetId) => {
    try {
      const result = await window.electronAPI.timesheets?.approve(timesheetId, user.id)
      if (result?.success) {
        loadDashboardData()
        setSelectedTimesheet(null)
      }
    } catch (error) {
      console.error('Failed to approve timesheet:', error)
    }
  }

  const handleRejectTimesheet = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    try {
      const result = await window.electronAPI.timesheets?.reject(
        selectedTimesheet.id,
        user.id,
        rejectReason
      )
      if (result?.success) {
        setShowRejectModal(false)
        setRejectReason('')
        setSelectedTimesheet(null)
        loadDashboardData()
      }
    } catch (error) {
      console.error('Failed to reject timesheet:', error)
    }
  }

  // Travel Form Functions
  const handleApproveTravelForm = async (formId) => {
    try {
      const result = await window.electronAPI.travelForms?.approve(formId, user.id)
      if (result?.success) {
        loadDashboardData()
        setSelectedTravelForm(null)
      }
    } catch (error) {
      console.error('Failed to approve travel form:', error)
    }
  }

  const handleRejectTravelForm = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    try {
      const result = await window.electronAPI.travelForms?.reject(
        selectedTravelForm.id,
        user.id,
        rejectReason
      )
      if (result?.success) {
        setShowRejectModal(false)
        setRejectReason('')
        setSelectedTravelForm(null)
        loadDashboardData()
      }
    } catch (error) {
      console.error('Failed to reject travel form:', error)
    }
  }

  const openRejectModal = (type, item) => {
    setRejectType(type)
    if (type === 'timesheet') {
      setSelectedTimesheet(item)
    } else {
      setSelectedTravelForm(item)
    }
    setShowRejectModal(true)
  }

  const markMemoAsRead = async (memoId) => {
    try {
      await window.electronAPI.memos.markAsRead(memoId, user.id)
      loadDashboardData()
    } catch (error) {
      console.error('Failed to mark memo as read:', error)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'UTC' })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0)
  }

  // Filter timesheets/travel forms by status
  const filteredTimesheets = timesheets.filter(t =>
    timesheetFilter === 'ALL' ? true : t.status === timesheetFilter
  )
  const filteredTravelForms = travelForms.filter(t =>
    travelFormFilter === 'ALL' ? true : t.status === travelFormFilter
  )

  return (
    <div className="dashboard finance-dashboard">
      <header className="dashboard-header finance-header">
        <div className="header-brand">
          <h1>TCN Finance</h1>
          <nav className="header-nav">
            <button
              className={`nav-button ${activeView === 'home' ? 'active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Dashboard
            </button>
            <button
              className={`nav-button ${activeView === 'timesheets' ? 'active' : ''}`}
              onClick={() => setActiveView('timesheets')}
            >
              Timesheets
              {pendingTimesheets.length > 0 && <span className="nav-badge">{pendingTimesheets.length}</span>}
            </button>
            <button
              className={`nav-button ${activeView === 'travel' ? 'active' : ''}`}
              onClick={() => setActiveView('travel')}
            >
              Travel Forms
              {pendingTravelForms.length > 0 && <span className="nav-badge">{pendingTravelForms.length}</span>}
            </button>
            <button
              className={`nav-button ${activeView === 'memos' ? 'active' : ''}`}
              onClick={() => setActiveView('memos')}
            >
              Memos
              {unreadMemoCount > 0 && <span className="nav-badge">{unreadMemoCount}</span>}
            </button>
          </nav>
        </div>
        <div className="header-user">
          <span className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role finance-badge">Finance</span>
          </span>
          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* HOME VIEW */}
        {activeView === 'home' && (
          <>
            <div className="welcome-section">
              <h2>Finance Dashboard</h2>
              <p>Review and manage timesheets, travel forms, and financial approvals</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card" onClick={() => setActiveView('timesheets')}>
                <div className="stat-icon">⏰</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTimesheets || 0}</span>
                  <span className="stat-label">Pending Timesheets</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.approvedTimesheets || 0}</span>
                  <span className="stat-label">Approved Timesheets</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('travel')}>
                <div className="stat-icon">✈️</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTravelForms || 0}</span>
                  <span className="stat-label">Pending Travel Forms</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.approvedTravelForms || 0}</span>
                  <span className="stat-label">Approved Travel Forms</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('timesheets')}>
                <div className="card-icon">⏰</div>
                <h3>Review Timesheets</h3>
                <p>Approve or reject staff timesheet submissions</p>
                {pendingTimesheets.length > 0 && <span className="card-badge">{pendingTimesheets.length} pending</span>}
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('travel')}>
                <div className="card-icon">✈️</div>
                <h3>Review Travel Forms</h3>
                <p>Approve or reject travel authorization requests</p>
                {pendingTravelForms.length > 0 && <span className="card-badge">{pendingTravelForms.length} pending</span>}
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('memos')}>
                <div className="card-icon">📬</div>
                <h3>Office Memos</h3>
                <p>View inter-office communications</p>
                {unreadMemoCount > 0 && <span className="card-badge">{unreadMemoCount} unread</span>}
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* TIMESHEETS VIEW */}
        {activeView === 'timesheets' && (
          <div className="review-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
              <h2>Timesheet Review</h2>
              <p>Review and approve staff timesheet submissions across all departments</p>
            </div>

            <div className="filter-bar">
              <select value={timesheetFilter} onChange={e => setTimesheetFilter(e.target.value)}>
                <option value="SUBMITTED">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </select>
              <span className="filter-count">{filteredTimesheets.length} timesheet(s)</span>
            </div>

            <div className="review-list">
              {filteredTimesheets.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <p>No timesheets matching this filter</p>
                </div>
              ) : (
                filteredTimesheets.map(ts => (
                  <div key={ts.id} className={`review-card status-${ts.status?.toLowerCase()}`}>
                    <div className="review-card-header">
                      <div className="review-card-info">
                        <h4>{ts.user?.first_name} {ts.user?.last_name}</h4>
                        <span className="dept-tag">{ts.user?.department?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className={`status-badge ${ts.status?.toLowerCase()}`}>{ts.status}</span>
                    </div>
                    <div className="review-card-details">
                      <span>Period: {formatDate(ts.payPeriodStart)} — {formatDate(ts.payPeriodEnd)}</span>
                      <span>Total Hours: <strong>{ts.grandTotal || ts.regularHours || 0}</strong></span>
                    </div>
                    {ts.status === 'SUBMITTED' && (
                      <div className="review-card-actions">
                        <button className="approve-button" onClick={() => handleApproveTimesheet(ts.id)}>
                          ✅ Approve
                        </button>
                        <button className="reject-button" onClick={() => openRejectModal('timesheet', ts)}>
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TRAVEL FORMS VIEW */}
        {activeView === 'travel' && (
          <div className="review-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
              <h2>Travel Form Review</h2>
              <p>Review and approve staff travel authorization requests across all departments</p>
            </div>

            <div className="filter-bar">
              <select value={travelFormFilter} onChange={e => setTravelFormFilter(e.target.value)}>
                <option value="SUBMITTED">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </select>
              <span className="filter-count">{filteredTravelForms.length} form(s)</span>
            </div>

            <div className="review-list">
              {filteredTravelForms.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">✈️</span>
                  <p>No travel forms matching this filter</p>
                </div>
              ) : (
                filteredTravelForms.map(tf => (
                  <div key={tf.id} className={`review-card status-${tf.status?.toLowerCase()}`}>
                    <div className="review-card-header">
                      <div className="review-card-info">
                        <h4>{tf.user?.first_name} {tf.user?.last_name}</h4>
                        <span className="dept-tag">{tf.user?.department?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className={`status-badge ${tf.status?.toLowerCase()}`}>{tf.status}</span>
                    </div>
                    <div className="review-card-details">
                      <span>Destination: {tf.destination || 'N/A'}</span>
                      <span>Dates: {formatDate(tf.departureDate)} — {formatDate(tf.returnDate)}</span>
                      <span>Total: <strong>{formatCurrency(tf.grandTotal)}</strong></span>
                    </div>
                    {tf.status === 'SUBMITTED' && (
                      <div className="review-card-actions">
                        <button className="approve-button" onClick={() => handleApproveTravelForm(tf.id)}>
                          ✅ Approve
                        </button>
                        <button className="reject-button" onClick={() => openRejectModal('travel', tf)}>
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MEMOS VIEW */}
        {activeView === 'memos' && (
          <div className="memos-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
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
      </main>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Reject {rejectType === 'timesheet' ? 'Timesheet' : 'Travel Form'}</h3>
            <p className="modal-subtitle">
              Please provide a reason for rejection.
            </p>
            <div className="form-group">
              <label>Reason</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                className="reject-confirm-button"
                onClick={rejectType === 'timesheet' ? handleRejectTimesheet : handleRejectTravelForm}
                disabled={!rejectReason.trim()}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
      <HelpDrawer activeView={activeView} />
    </div>
  )
}

export default FinanceDashboard
