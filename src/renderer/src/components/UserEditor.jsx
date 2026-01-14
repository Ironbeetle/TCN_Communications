import { useState, useEffect } from 'react'
import './AdminDashboard.css'

const ROLES = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'STAFF_ADMIN', label: 'Staff Admin' },
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'CHIEF_COUNCIL', label: 'Chief & Council' }
]

const DEPARTMENTS = [
  { value: 'BAND_OFFICE', label: 'Band Office' },
  { value: 'J_W_HEALTH_CENTER', label: 'JW Health Center' },
  { value: 'CSCMEC', label: 'CSCMEC' },
  { value: 'COUNCIL', label: 'Council' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'UTILITIES', label: 'Utilities' }
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
      user.email.toLowerCase().includes(search) ||
      user.first_name.toLowerCase().includes(search) ||
      user.last_name.toLowerCase().includes(search)
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
      case 'STAFF_ADMIN': return 'staff-admin'
      default: return 'staff'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
                  <td>{DEPARTMENTS.find(d => d.value === user.department)?.label || user.department.replace(/_/g, ' ')}</td>
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
