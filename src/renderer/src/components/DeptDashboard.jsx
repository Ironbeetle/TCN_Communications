import { useState, useEffect } from 'react'
import SmsComposer from './SmsComposer'
import EmailComposer from './EmailComposer'
import BulletinCreator from './BulletinCreator'
import TimesheetForm from './TimesheetForm'
import TravelForm from './TravelForm'

function DeptDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [stats, setStats] = useState(null)
  const [departmentStaff, setDepartmentStaff] = useState([])
  const [memos, setMemos] = useState([])
  const [unreadMemoCount, setUnreadMemoCount] = useState(0)
  const [timesheets, setTimesheets] = useState([])
  const [travelForms, setTravelForms] = useState([])
  const [pendingTimesheets, setPendingTimesheets] = useState([])
  const [pendingTravelForms, setPendingTravelForms] = useState([])

  // Filters
  const [timesheetFilter, setTimesheetFilter] = useState('SUBMITTED')
  const [travelFormFilter, setTravelFormFilter] = useState('SUBMITTED')

  // Modals
  const [selectedTimesheet, setSelectedTimesheet] = useState(null)
  const [selectedTravelForm, setSelectedTravelForm] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectType, setRejectType] = useState(null)
  const [showMemoModal, setShowMemoModal] = useState(false)

  // New memo form
  const [newMemo, setNewMemo] = useState({
    title: '',
    content: '',
    priority: 'low',
    department: user.department,
    isPinned: false
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const deptFilter = user.department

      // Load department staff
      const usersResult = await window.electronAPI.auth.getAllUsers()
      let staffList = []
      if (usersResult?.success) {
        const allUsers = Array.isArray(usersResult.users) ? usersResult.users : []
        staffList = allUsers.filter(u => u.department === deptFilter)
        setDepartmentStaff(staffList)
      }

      // Load department timesheets
      const timesheetsResult = await window.electronAPI.timesheets?.getAll(null, deptFilter)
      if (timesheetsResult?.success) {
        const timesheetsData = Array.isArray(timesheetsResult.data) ? timesheetsResult.data : []
        setTimesheets(timesheetsData)
        setPendingTimesheets(timesheetsData.filter(t => t.status === 'SUBMITTED'))
      }

      // Load department travel forms
      const travelResult = await window.electronAPI.travelForms?.getAll(null, deptFilter)
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
        totalStaff: staffList.length,
        pendingTimesheets: timesheetsData.filter(t => t.status === 'SUBMITTED').length,
        pendingTravelForms: travelData.filter(t => t.status === 'SUBMITTED').length,
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

  // Memo Functions
  const handleCreateMemo = async () => {
    try {
      const result = await window.electronAPI.memos?.create({
        ...newMemo,
        authorId: user.id
      })
      if (result?.success) {
        setShowMemoModal(false)
        setNewMemo({
          title: '',
          content: '',
          priority: 'low',
          department: user.department,
          isPinned: false
        })
        loadDashboardData()
      }
    } catch (error) {
      console.error('Failed to create memo:', error)
    }
  }

  const markMemoAsRead = async (memoId) => {
    try {
      await window.electronAPI.memos.markAsRead(memoId, user.id)
      loadDashboardData()
    } catch (error) {
      console.error('Failed to mark memo as read:', error)
    }
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'UTC' })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0)
  }

  const deptName = user.department?.replace(/_/g, ' ') || 'Department'

  // Filter timesheets/travel forms by status
  const filteredTimesheets = timesheets.filter(t =>
    timesheetFilter === 'ALL' ? true : t.status === timesheetFilter
  )
  const filteredTravelForms = travelForms.filter(t =>
    travelFormFilter === 'ALL' ? true : t.status === travelFormFilter
  )

  return (
    <div className="dashboard dept-dashboard">
      <header className="dashboard-header dept-header">
        <div className="header-brand">
          <h1>TCN {deptName}</h1>
          <nav className="header-nav">
            <button
              className={`nav-button ${activeView === 'home' ? 'active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Dashboard
            </button>
            <button
              className={`nav-button ${activeView === 'communications' || activeView === 'sms' || activeView === 'email' || activeView === 'bulletin' ? 'active' : ''}`}
              onClick={() => setActiveView('communications')}
            >
              Communications
            </button>
            <button
              className={`nav-button ${activeView === 'approvals' || activeView === 'review-timesheets' || activeView === 'review-travel' ? 'active' : ''}`}
              onClick={() => setActiveView('approvals')}
            >
              Approvals
              {(pendingTimesheets.length + pendingTravelForms.length) > 0 && (
                <span className="nav-badge">{pendingTimesheets.length + pendingTravelForms.length}</span>
              )}
            </button>
            <button
              className={`nav-button ${activeView === 'staff-tools' || activeView === 'timesheets' || activeView === 'travel' || activeView === 'memos' ? 'active' : ''}`}
              onClick={() => setActiveView('staff-tools')}
            >
              Staff Tools
              {unreadMemoCount > 0 && <span className="nav-badge">{unreadMemoCount}</span>}
            </button>
          </nav>
        </div>
        <div className="header-user">
          <span className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role dept-badge">Dept Admin • {deptName}</span>
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
              <h2>{deptName} Dashboard</h2>
              <p>Manage your department staff, approvals, and communications</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.totalStaff || 0}</span>
                  <span className="stat-label">Department Staff</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('approvals')}>
                <div className="stat-icon">⏰</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTimesheets || 0}</span>
                  <span className="stat-label">Pending Timesheets</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('approvals')}>
                <div className="stat-icon">✈️</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTravelForms || 0}</span>
                  <span className="stat-label">Pending Travel Forms</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('memos')}>
                <div className="stat-icon">📬</div>
                <div className="stat-content">
                  <span className="stat-value">{unreadMemoCount}</span>
                  <span className="stat-label">Unread Memos</span>
                </div>
              </div>
            </div>

            {/* Department Staff Overview */}
            <div className="dept-section">
              <div className="section-header">
                <h3>👥 Department Staff</h3>
              </div>
              <div className="staff-overview">
                {departmentStaff.length === 0 ? (
                  <p className="empty-message">No staff members in this department</p>
                ) : (
                  <div className="staff-grid">
                    {departmentStaff.map(staff => (
                      <div key={staff.id} className="staff-card">
                        <div className="staff-avatar">
                          {staff.first_name?.[0]}{staff.last_name?.[0]}
                        </div>
                        <div className="staff-info">
                          <span className="staff-name">
                            {staff.first_name} {staff.last_name}
                          </span>
                          <span className="staff-email">{staff.email}</span>
                          <span className={`role-badge ${staff.role?.toLowerCase()}`}>
                            {staff.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('approvals')}>
                <div className="card-icon">📋</div>
                <h3>Review Approvals</h3>
                <p>Approve or reject department timesheets and travel forms</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('communications')}>
                <div className="card-icon">📨</div>
                <h3>Communications</h3>
                <p>Send SMS, emails, and bulletins to members</p>
                <button className="card-button">Open</button>
              </div>

              <div className="dashboard-card" onClick={() => setActiveView('staff-tools')}>
                <div className="card-icon">🏢</div>
                <h3>Staff Tools</h3>
                <p>Timesheets, travel forms, and office memos</p>
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* COMMUNICATIONS HUB */}
        {activeView === 'communications' && (
          <>
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
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

        {/* APPROVALS HUB */}
        {activeView === 'approvals' && (
          <>
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
              <h2>Department Approvals</h2>
              <p>Review and manage {deptName} staff submissions</p>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('review-timesheets')}>
                <div className="card-icon">⏰</div>
                <h3>Timesheets</h3>
                <p>Review department timesheet submissions</p>
                {pendingTimesheets.length > 0 && <span className="card-badge">{pendingTimesheets.length} pending</span>}
                <button className="card-button">Open</button>
              </div>
              <div className="dashboard-card" onClick={() => setActiveView('review-travel')}>
                <div className="card-icon">✈️</div>
                <h3>Travel Forms</h3>
                <p>Review department travel authorization requests</p>
                {pendingTravelForms.length > 0 && <span className="card-badge">{pendingTravelForms.length} pending</span>}
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* REVIEW TIMESHEETS */}
        {activeView === 'review-timesheets' && (
          <div className="review-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('approvals')}>← Back to Approvals</button>
              <h2>Timesheet Review</h2>
              <p>Review {deptName} staff timesheet submissions</p>
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

        {/* REVIEW TRAVEL FORMS */}
        {activeView === 'review-travel' && (
          <div className="review-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('approvals')}>← Back to Approvals</button>
              <h2>Travel Form Review</h2>
              <p>Review {deptName} travel authorization requests</p>
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

        {/* STAFF TOOLS HUB */}
        {activeView === 'staff-tools' && (
          <>
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>← Back to Dashboard</button>
              <h2>Staff Tools</h2>
              <p>Internal tools for {deptName} staff</p>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card" onClick={() => setActiveView('memos')}>
                <div className="card-icon">📬</div>
                <h3>Office Memos</h3>
                <p>View and create inter-office communications</p>
                {unreadMemoCount > 0 && <span className="card-badge">{unreadMemoCount} unread</span>}
                <button className="card-button">Open</button>
              </div>
              <div className="dashboard-card" onClick={() => setActiveView('timesheets')}>
                <div className="card-icon">⏰</div>
                <h3>My Timesheets</h3>
                <p>Submit and track your bi-weekly timesheets</p>
                <button className="card-button">Open</button>
              </div>
              <div className="dashboard-card" onClick={() => setActiveView('travel')}>
                <div className="card-icon">✈️</div>
                <h3>My Travel Requests</h3>
                <p>Submit travel authorization forms</p>
                <button className="card-button">Open</button>
              </div>
            </div>
          </>
        )}

        {/* MEMOS VIEW */}
        {activeView === 'memos' && (
          <div className="memos-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('staff-tools')}>← Back to Staff Tools</button>
              <h2>Office Memos</h2>
              <p>Inter-office communications and announcements</p>
              <button className="create-button" onClick={() => setShowMemoModal(true)}>+ Create Memo</button>
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

        {/* MY TIMESHEETS */}
        {activeView === 'timesheets' && (
          <TimesheetForm
            user={user}
            onBack={() => setActiveView('staff-tools')}
          />
        )}

        {/* MY TRAVEL FORMS */}
        {activeView === 'travel' && (
          <TravelForm
            user={user}
            onBack={() => setActiveView('staff-tools')}
          />
        )}

        {/* COMMUNICATION VIEWS */}
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
      </main>

      {/* CREATE MEMO MODAL */}
      {showMemoModal && (
        <div className="modal-overlay" onClick={() => setShowMemoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Office Memo</h3>

            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={newMemo.title}
                onChange={e => setNewMemo({ ...newMemo, title: e.target.value })}
                placeholder="Enter memo title..."
              />
            </div>

            <div className="form-group">
              <label>Content</label>
              <textarea
                value={newMemo.content}
                onChange={e => setNewMemo({ ...newMemo, content: e.target.value })}
                placeholder="Enter memo content..."
                rows={6}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={newMemo.priority}
                  onChange={e => setNewMemo({ ...newMemo, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newMemo.isPinned}
                  onChange={e => setNewMemo({ ...newMemo, isPinned: e.target.checked })}
                />
                Pin this memo to the top
              </label>
            </div>

            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowMemoModal(false)}>
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleCreateMemo}
                disabled={!newMemo.title.trim() || !newMemo.content.trim()}
              >
                Create Memo
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default DeptDashboard
