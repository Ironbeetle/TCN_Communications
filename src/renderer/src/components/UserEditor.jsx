import { useState, useEffect } from 'react'

const ROLES = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'DEPARTMENT_ADMIN', label: 'Department Admin' },
  { value: 'STAFF_ADMIN', label: 'Staff Admin' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'COUNCIL', label: 'Council' }
]

const DEPARTMENTS = [
  // Land & Treaty
  { value: 'TREATY_LAND_ENTITLEMENT', label: 'Treaty Land Entitlement' },
  { value: 'ADVERSE_AFFECTS', label: 'Adverse Affects' },
  { value: 'TRSC', label: 'TRSC' },
  // Cultural & Spiritual
  { value: 'CHURCH', label: 'Church' },
  { value: 'TRADITIONAL_LIFESTYLE', label: 'Traditional Lifestyle' },
  // Education
  { value: 'EDUCATION_AUTHORITY', label: 'Education Authority' },
  { value: 'CSCMEC', label: 'CSCMEC' },
  { value: 'TRADITIONAL_KNOWLEDGE', label: 'Traditional Knowledge' },
  { value: 'ADULT_ED', label: 'Adult Education' },
  // Employment
  { value: 'ISETS_TRAINING_EMPLOYMENT', label: 'ISETS Training & Employment' },
  { value: 'ON_GOING_JOBS_MB_HYDRO', label: 'On-Going Jobs MB Hydro' },
  // Health & Family
  { value: 'TCN_HEALTH', label: 'TCN Health' },
  { value: 'TCN_PREVENTION', label: 'TCN Prevention' },
  { value: 'JORDANS_PRINCIPLE', label: "Jordan's Principle" },
  { value: 'WAWATAY', label: 'Wawatay' },
  { value: 'KEEKINOW', label: 'Keekinow' },
  { value: 'HEADSTART', label: 'Headstart' },
  // Public Works
  { value: 'HOUSING', label: 'Housing' },
  { value: 'PUBLIC_UTILITIES', label: 'Public Utilities' },
  { value: 'FIRE_DEPARTMENT', label: 'Fire Department' },
  { value: 'IRON_NORTH', label: 'Iron North' },
  { value: 'WATER_TREATMENT_PLANT', label: 'Water Treatment Plant' },
  { value: 'NAT_RESOURCES_HELI_PAD', label: 'Natural Resources (Helicopter Pad)' },
  { value: 'IT_COMMUNICATIONS', label: 'IT & Communications' },
  { value: 'BAND_HALL', label: 'Band Hall' },
  // Recreation
  { value: 'TCN_RECREATION', label: 'TCN Recreation' },
  { value: 'TCN_GAMING', label: 'TCN Gaming' },
  { value: 'ARENA', label: 'Arena' },
  // Community Admin
  { value: 'PUBLIC_SAFETY_POLICE', label: 'Public Safety & Police' },
  { value: 'SOCIAL_WELFARE', label: 'Social Welfare' },
  { value: 'JUSTICE_PROGRAM', label: 'Justice Program' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'TCN_TRUST', label: 'TCN Trust' },
  { value: 'BAND_OFFICE', label: 'Band Office' }
]

function UserEditor({ currentUser }) {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'STAFF',
    department: 'BAND_OFFICE'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.auth.getAllUsers()
      if (result.success) {
        setUsers(result.users)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase()
    return (
      (user.email || '').toLowerCase().includes(search) ||
      (user.first_name || '').toLowerCase().includes(search) ||
      (user.last_name || '').toLowerCase().includes(search)
    )
  })

  const openAddModal = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'STAFF',
      department: 'BAND_OFFICE'
    })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '', // Don't show password
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      department: user.department
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.email || !formData.first_name || !formData.last_name) {
      setError('Please fill in all required fields')
      return
    }

    if (!editingUser && !formData.password) {
      setError('Password is required for new users')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const result = await window.electronAPI.auth.createUser({
        ...formData,
        id: editingUser?.id // Pass ID if editing
      })

      if (result.success) {
        setShowModal(false)
        loadUsers()
      } else {
        setError(result.message || 'Failed to save user')
      }
    } catch (error) {
      setError(error.message || 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN': return 'admin'
      case 'COUNCIL': return 'council'
      case 'STAFF_ADMIN': return 'staff-admin'
      case 'FINANCE': return 'finance'
      case 'DEPARTMENT_ADMIN': return 'dept-admin'
      default: return 'staff'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
  }

  if (isLoading) {
    return (
      <div className="user-editor">
        <div className="empty-state">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="user-editor">
      <h2>User Management</h2>
      <p>Manage staff accounts and permissions</p>

      <div className="user-actions">
        <input
          type="text"
          className="search-input"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="add-user-button" onClick={openAddModal}>
          + Add User
        </button>
      </div>

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.first_name} {user.last_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                      {ROLES.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td>{DEPARTMENTS.find(d => d.value === user.department)?.label || (user.department || '').replace(/_/g, ' ')}</td>
                  <td>
                    <span className={`status-badge ${user.lockedUntil ? 'locked' : 'active'}`}>
                      {user.lockedUntil ? 'Locked' : 'Active'}
                    </span>
                  </td>
                  <td>{formatDate(user.lastLogin)}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="action-button"
                        onClick={() => openEditModal(user)}
                      >
                        Edit
                      </button>
                      {user.id !== currentUser.id && (
                        <button className="action-button danger">
                          {user.lockedUntil ? 'Unlock' : 'Lock'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? '••••••••' : ''}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="result-message error">{error}</div>
            )}

            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button 
                className="save-button" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserEditor
