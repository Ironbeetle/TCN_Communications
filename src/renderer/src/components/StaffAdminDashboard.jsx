import { useState, useEffect } from 'react'
import Communications from './Communications'
import Forms from './Forms'
import UserEditor from './UserEditor'
import './Dashboard.css'
import './StaffAdminDashboard.css'

function StaffAdminDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [stats, setStats] = useState(null)
  const [departmentStaff, setDepartmentStaff] = useState([])
  const [memos, setMemos] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [travelForms, setTravelForms] = useState([])
  const [pendingTimesheets, setPendingTimesheets] = useState([])
  const [pendingTravelForms, setPendingTravelForms] = useState([])
  
  // Filters
  const [timesheetFilter, setTimesheetFilter] = useState('SUBMITTED')
  const [travelFormFilter, setTravelFormFilter] = useState('SUBMITTED')
  
  // Modals
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [selectedTimesheet, setSelectedTimesheet] = useState(null)
  const [selectedTravelForm, setSelectedTravelForm] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectType, setRejectType] = useState(null) // 'timesheet' or 'travel'
  
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
      // Load pending timesheets for department (use getAll with department filter)
      const timesheetsResult = await window.electronAPI.timesheets?.getAll(null, user.department)
      if (timesheetsResult?.success) {
        const timesheetsData = Array.isArray(timesheetsResult.data) ? timesheetsResult.data : []
        setTimesheets(timesheetsData)
        setPendingTimesheets(timesheetsData.filter(t => t.status === 'SUBMITTED'))
      }

      // Load pending travel forms for department (use getAll with department filter)
      const travelResult = await window.electronAPI.travelForms?.getAll(null, user.department)
      if (travelResult?.success) {
        const travelData = Array.isArray(travelResult.data) ? travelResult.data : 
                           Array.isArray(travelResult.travelForms) ? travelResult.travelForms : []
        setTravelForms(travelData)
        setPendingTravelForms(travelData.filter(t => t.status === 'SUBMITTED'))
      }

      // Load memos
      const memosResult = await window.electronAPI.memos?.getAll()
      // Handle various response formats
      const memosData = Array.isArray(memosResult) ? memosResult : 
                        Array.isArray(memosResult?.data) ? memosResult.data :
                        Array.isArray(memosResult?.memos) ? memosResult.memos : []
      setMemos(memosData)

      // Calculate stats
      const timesheetsData = Array.isArray(timesheetsResult?.data) ? timesheetsResult.data : []
      const travelData = Array.isArray(travelResult?.data) ? travelResult.data : 
                         Array.isArray(travelResult?.travelForms) ? travelResult.travelForms : []
      
      setStats({
        totalStaff: 0, // Staff list not implemented yet
        pendingTimesheets: timesheetsData.filter(t => t.status === 'SUBMITTED').length,
        pendingTravelForms: travelData.filter(t => t.status === 'SUBMITTED').length,
        activeMemos: memosData.filter(m => m.isPublished).length
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

  const handleDeleteMemo = async (memoId) => {
    if (!confirm('Are you sure you want to delete this memo?')) return
    try {
      await window.electronAPI.memos?.delete(memoId)
      loadDashboardData()
    } catch (error) {
      console.error('Failed to delete memo:', error)
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
      // Parameters: timesheetId, rejecterId, reason
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
      // Parameters: formId, rejecterId, reason
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
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount || 0)
  }

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'DRAFT': 'draft',
      'SUBMITTED': 'submitted',
      'UNDER_REVIEW': 'under-review',
      'APPROVED': 'approved',
      'REJECTED': 'rejected',
      'ISSUED': 'issued',
      'COMPLETED': 'completed'
    }
    return statusMap[status] || 'draft'
  }

  // Filter timesheets based on selected filter
  const filteredTimesheets = timesheets.filter(t => 
    timesheetFilter === 'ALL' ? true : t.status === timesheetFilter
  )

  // Filter travel forms based on selected filter
  const filteredTravelForms = travelForms.filter(t => 
    travelFormFilter === 'ALL' ? true : t.status === travelFormFilter
  )

  return (
    <div className="dashboard staff-admin-dashboard">
      <header className="dashboard-header staff-admin-header">
        <div className="header-brand">
          <h1>TCN Staff Admin</h1>
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
              {pendingTimesheets.length > 0 && (
                <span className="nav-badge">{pendingTimesheets.length}</span>
              )}
            </button>
            <button 
              className={`nav-button ${activeView === 'travel' ? 'active' : ''}`}
              onClick={() => setActiveView('travel')}
            >
              Travel Forms
              {pendingTravelForms.length > 0 && (
                <span className="nav-badge">{pendingTravelForms.length}</span>
              )}
            </button>
            <button 
              className={`nav-button ${activeView === 'memos' ? 'active' : ''}`}
              onClick={() => setActiveView('memos')}
            >
              Office Memos
            </button>
            <button 
              className={`nav-button ${activeView === 'staff' ? 'active' : ''}`}
              onClick={() => setActiveView('staff')}
            >
              Staff
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
            <span className="user-role staff-admin-badge">
              Staff Admin • {user.department.replace(/_/g, ' ')}
            </span>
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
              <h2>Staff Admin Dashboard</h2>
              <p>Manage {user.department.replace(/_/g, ' ')} department staff and approvals</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card" onClick={() => setActiveView('staff')}>
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.totalStaff || 0}</span>
                  <span className="stat-label">Department Staff</span>
                </div>
              </div>

              <div className="stat-card urgent" onClick={() => setActiveView('timesheets')}>
                <div className="stat-icon">⏰</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTimesheets || 0}</span>
                  <span className="stat-label">Pending Timesheets</span>
                </div>
              </div>

              <div className="stat-card urgent" onClick={() => setActiveView('travel')}>
                <div className="stat-icon">✈️</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.pendingTravelForms || 0}</span>
                  <span className="stat-label">Pending Travel Forms</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveView('memos')}>
                <div className="stat-icon">📬</div>
                <div className="stat-content">
                  <span className="stat-value">{stats?.activeMemos || 0}</span>
                  <span className="stat-label">Active Memos</span>
                </div>
              </div>
            </div>

            {/* Department Staff Overview */}
            <div className="admin-section">
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
            <div className="admin-section">
              <h3>Quick Actions</h3>
              <div className="dashboard-grid">
                <div className="dashboard-card" onClick={() => setActiveView('timesheets')}>
                  <div className="card-icon">⏰</div>
                  <h3>Review Timesheets</h3>
                  <p>Approve or reject staff timesheet submissions</p>
                  {pendingTimesheets.length > 0 && (
                    <span className="card-badge urgent">{pendingTimesheets.length} pending</span>
                  )}
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card" onClick={() => setActiveView('travel')}>
                  <div className="card-icon">✈️</div>
                  <h3>Travel Requests</h3>
                  <p>Review travel authorization forms</p>
                  {pendingTravelForms.length > 0 && (
                    <span className="card-badge urgent">{pendingTravelForms.length} pending</span>
                  )}
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card" onClick={() => setActiveView('memos')}>
                  <div className="card-icon">📬</div>
                  <h3>Office Memos</h3>
                  <p>Create and manage inter-office communications</p>
                  <button className="card-button">Open</button>
                </div>

                <div className="dashboard-card" onClick={() => setActiveView('communications')}>
                  <div className="card-icon">📨</div>
                  <h3>Member Communications</h3>
                  <p>Send SMS, emails, and bulletins to TCN members</p>
                  <button className="card-button">Open</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TIMESHEETS VIEW */}
        {activeView === 'timesheets' && (
          <div className="management-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>
                ← Back to Dashboard
              </button>
              <h2>Timesheet Management</h2>
              <p>Review and approve staff timesheet submissions</p>
            </div>

            {/* Status Filter */}
            <div className="filter-bar">
              {['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
                <button
                  key={status}
                  className={`filter-button ${timesheetFilter === status ? 'active' : ''}`}
                  onClick={() => setTimesheetFilter(status)}
                >
                  {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  <span className="filter-count">
                    {status === 'ALL' 
                      ? timesheets.length 
                      : timesheets.filter(t => t.status === status).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Timesheets List */}
            <div className="items-list">
              {filteredTimesheets.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">⏰</span>
                  <p>No timesheets found for this filter</p>
                </div>
              ) : (
                filteredTimesheets.map(timesheet => (
                  <div key={timesheet.id} className="item-card">
                    <div className="item-header">
                      <div className="item-user">
                        <div className="user-avatar">
                          {timesheet.user?.first_name?.[0]}{timesheet.user?.last_name?.[0]}
                        </div>
                        <div className="user-details">
                          <span className="user-name">
                            {timesheet.user?.first_name} {timesheet.user?.last_name}
                          </span>
                          <span className="user-email">{timesheet.user?.email}</span>
                        </div>
                      </div>
                      <span className={`status-badge ${getStatusBadgeClass(timesheet.status)}`}>
                        {timesheet.status}
                      </span>
                    </div>

                    <div className="item-details">
                      <div className="detail-row">
                        <span className="detail-label">Pay Period:</span>
                        <span className="detail-value">
                          {formatDate(timesheet.payPeriodStart)} - {formatDate(timesheet.payPeriodEnd)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Week 1:</span>
                        <span className="detail-value">{timesheet.week1Total}h</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Week 2:</span>
                        <span className="detail-value">{timesheet.week2Total}h</span>
                      </div>
                      <div className="detail-row highlight">
                        <span className="detail-label">Total Hours:</span>
                        <span className="detail-value">{timesheet.grandTotal}h</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Submitted:</span>
                        <span className="detail-value">{formatDate(timesheet.submittedAt)}</span>
                      </div>
                    </div>

                    {timesheet.status === 'REJECTED' && timesheet.rejectionReason && (
                      <div className="rejection-notice">
                        <strong>Rejection Reason:</strong> {timesheet.rejectionReason}
                      </div>
                    )}

                    {timesheet.status === 'SUBMITTED' && (
                      <div className="item-actions">
                        <button 
                          className="action-btn approve"
                          onClick={() => handleApproveTimesheet(timesheet.id)}
                        >
                          ✓ Approve
                        </button>
                        <button 
                          className="action-btn reject"
                          onClick={() => openRejectModal('timesheet', timesheet)}
                        >
                          ✕ Reject
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
          <div className="management-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>
                ← Back to Dashboard
              </button>
              <h2>Travel Form Management</h2>
              <p>Review and approve staff travel authorization requests</p>
            </div>

            {/* Status Filter */}
            <div className="filter-bar">
              {['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
                <button
                  key={status}
                  className={`filter-button ${travelFormFilter === status ? 'active' : ''}`}
                  onClick={() => setTravelFormFilter(status)}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ').charAt(0) + status.replace('_', ' ').slice(1).toLowerCase()}
                  <span className="filter-count">
                    {status === 'ALL' 
                      ? travelForms.length 
                      : travelForms.filter(t => t.status === status).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Travel Forms List */}
            <div className="items-list">
              {filteredTravelForms.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">✈️</span>
                  <p>No travel forms found for this filter</p>
                </div>
              ) : (
                filteredTravelForms.map(form => (
                  <div key={form.id} className="item-card travel-card">
                    <div className="item-header">
                      <div className="item-user">
                        <div className="user-avatar">
                          {form.submitter?.first_name?.[0]}{form.submitter?.last_name?.[0]}
                        </div>
                        <div className="user-details">
                          <span className="user-name">
                            {form.submitter?.first_name} {form.submitter?.last_name}
                          </span>
                          <span className="user-email">{form.submitter?.email}</span>
                        </div>
                      </div>
                      <span className={`status-badge ${getStatusBadgeClass(form.status)}`}>
                        {form.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="item-details">
                      <div className="detail-row">
                        <span className="detail-label">📍 Destination:</span>
                        <span className="detail-value">{form.destination}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">📅 Travel Dates:</span>
                        <span className="detail-value">
                          {formatDate(form.departureDate)} - {formatDate(form.returnDate)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">📝 Reason:</span>
                        <span className="detail-value reason">{form.reasonsForTravel}</span>
                      </div>
                      <div className="detail-row highlight">
                        <span className="detail-label">💰 Total Amount:</span>
                        <span className="detail-value">{formatCurrency(form.grandTotal)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Submitted:</span>
                        <span className="detail-value">{formatDate(form.submittedDate)}</span>
                      </div>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="expense-breakdown">
                      <h4>Expense Breakdown</h4>
                      <div className="expense-grid">
                        <div className="expense-item">
                          <span>Accommodation</span>
                          <span>{formatCurrency((form.hotelTotal || 0) + (form.privateTotal || 0))}</span>
                        </div>
                        <div className="expense-item">
                          <span>Meals</span>
                          <span>{formatCurrency((form.breakfastTotal || 0) + (form.lunchTotal || 0) + (form.dinnerTotal || 0))}</span>
                        </div>
                        <div className="expense-item">
                          <span>Transportation</span>
                          <span>{formatCurrency((form.oneWayWinnipegTotal || 0) + (form.oneWayThompsonTotal || 0) + (form.publicTransportTotal || 0))}</span>
                        </div>
                        <div className="expense-item">
                          <span>Other</span>
                          <span>{formatCurrency((form.incidentalTotal || 0) + (form.taxiFareTotal || 0) + (form.parkingTotal || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {form.status === 'REJECTED' && form.rejectionReason && (
                      <div className="rejection-notice">
                        <strong>Rejection Reason:</strong> {form.rejectionReason}
                      </div>
                    )}

                    {form.status === 'SUBMITTED' && (
                      <div className="item-actions">
                        <button 
                          className="action-btn approve"
                          onClick={() => handleApproveTravelForm(form.id)}
                        >
                          ✓ Approve
                        </button>
                        <button 
                          className="action-btn reject"
                          onClick={() => openRejectModal('travel', form)}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* OFFICE MEMOS VIEW */}
        {activeView === 'memos' && (
          <div className="management-view">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>
                ← Back to Dashboard
              </button>
              <div className="view-header-row">
                <div>
                  <h2>Office Memos</h2>
                  <p>Create and manage inter-office communications</p>
                </div>
                <button 
                  className="create-btn"
                  onClick={() => setShowMemoModal(true)}
                >
                  + Create Memo
                </button>
              </div>
            </div>

            <div className="memos-list">
              {memos.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📬</span>
                  <p>No memos yet. Create one to get started!</p>
                </div>
              ) : (
                memos.map(memo => (
                  <div 
                    key={memo.id} 
                    className={`memo-card admin priority-${memo.priority}`}
                  >
                    <div className="memo-header">
                      <div className="memo-badges">
                        <span className={`priority-badge ${memo.priority}`}>
                          {memo.priority}
                        </span>
                        {memo.isPinned && <span className="pinned-badge">📌 Pinned</span>}
                        {memo.department && (
                          <span className="dept-badge">
                            {memo.department.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <div className="memo-actions">
                        <button 
                          className="memo-action-btn delete"
                          onClick={() => handleDeleteMemo(memo.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <h3 className="memo-title">{memo.title}</h3>
                    <div className="memo-content">{memo.content}</div>
                    <div className="memo-footer">
                      <span className="memo-author">
                        By: {memo.author?.first_name} {memo.author?.last_name}
                      </span>
                      <span className="memo-date">{formatDate(memo.createdAt)}</span>
                    </div>
                    <div className="memo-stats">
                      <span>👁️ Read by {memo.readBy?.length || 0} staff</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* COMMUNICATIONS VIEW */}
        {activeView === 'communications' && (
          <div className="communications-wrapper">
            <div className="view-header">
              <button className="back-button" onClick={() => setActiveView('home')}>
                ← Back to Dashboard
              </button>
              <h2>Member Communications</h2>
              <p>Send messages to TCN community members</p>
            </div>
            <Communications user={user} />
          </div>
        )}

        {/* FORMS VIEW */}
        {activeView === 'forms' && (
          <Forms user={user} />
        )}

        {/* STAFF VIEW */}
        {activeView === 'staff' && (
          <UserEditor currentUser={user} />
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

              <div className="form-group">
                <label>Target Department</label>
                <select
                  value={newMemo.department || ''}
                  onChange={e => setNewMemo({ ...newMemo, department: e.target.value || null })}
                >
                  <option value="">All Departments</option>
                  <option value="BAND_OFFICE">Band Office</option>
                  <option value="J_W_HEALTH_CENTER">J.W. Health Center</option>
                  <option value="CSCMEC">CSCMEC</option>
                  <option value="COUNCIL">Council</option>
                  <option value="RECREATION">Recreation</option>
                  <option value="UTILITIES">Utilities</option>
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
              Please provide a reason for rejecting this {rejectType === 'timesheet' ? 'timesheet' : 'travel form'}.
            </p>
            
            <div className="form-group">
              <label>Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
              />
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-button" 
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
              >
                Cancel
              </button>
              <button 
                className="save-button danger"
                onClick={rejectType === 'timesheet' ? handleRejectTimesheet : handleRejectTravelForm}
                disabled={!rejectReason.trim()}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffAdminDashboard
