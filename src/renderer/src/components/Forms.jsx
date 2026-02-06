import { useState, useEffect } from 'react'
import FormBuilder from './FormBuilder'
import SubmissionsViewer from './SubmissionsViewer'
import './Forms.css'

function Forms({ user }) {
  const [forms, setForms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeView, setActiveView] = useState('list') // list, create, edit, submissions
  const [selectedForm, setSelectedForm] = useState(null)

  useEffect(() => {
    loadForms()
  }, [])

  const loadForms = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.forms.getAll()
      if (result.success) {
        setForms(result.forms || [])
      } else {
        console.error('Forms load failed:', result.message)
        setError(result.message || 'Failed to load forms')
        setForms([])
      }
    } catch (error) {
      console.error('Failed to load forms:', error)
      setError('Failed to connect to server. Please try again.')
      setForms([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNew = () => {
    setSelectedForm(null)
    setActiveView('create')
  }

  const handleEditForm = (form) => {
    setSelectedForm(form)
    setActiveView('edit')
  }

  const handleViewSubmissions = (form) => {
    setSelectedForm(form)
    setActiveView('submissions')
  }

  const handleDeleteForm = async (formId) => {
    if (!confirm('Are you sure you want to delete this form? All submissions will be lost.')) {
      return
    }

    try {
      const result = await window.electronAPI.forms.delete(formId)
      if (result.success) {
        loadForms()
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleFormSaved = () => {
    setActiveView('list')
    loadForms()
  }

  const handleBack = () => {
    setActiveView('list')
    setSelectedForm(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline'
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (activeView === 'create' || activeView === 'edit') {
    return (
      <FormBuilder 
        form={selectedForm}
        user={user}
        onSave={handleFormSaved}
        onCancel={handleBack}
      />
    )
  }

  if (activeView === 'submissions') {
    return (
      <SubmissionsViewer 
        form={selectedForm}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="forms-container">
      <div className="forms-header">
        <div>
          <h2>Sign-Up Forms</h2>
          <p>Create and manage community sign-up forms</p>
        </div>
        <button className="create-form-button" onClick={handleCreateNew}>
          + New Form
        </button>
      </div>

      {isLoading ? (
        <div className="forms-loading">Loading forms...</div>
      ) : error ? (
        <div className="forms-error">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Forms</h3>
          <p>{error}</p>
          <button className="create-form-button" onClick={loadForms}>
            Try Again
          </button>
        </div>
      ) : !Array.isArray(forms) || forms.length === 0 ? (
        <div className="forms-empty">
          <div className="empty-icon">📝</div>
          <h3>No forms yet</h3>
          <p>Create your first sign-up form to get started</p>
          <button className="create-form-button" onClick={handleCreateNew}>
            Create Form
          </button>
        </div>
      ) : (
        <div className="forms-grid">
          {forms.map(form => (
            <div key={form.id} className={`form-card ${!form.isActive ? 'inactive' : ''}`}>
              <div className="form-card-header">
                <h3>{form.title}</h3>
                <span className={`form-status ${form.isActive ? 'active' : 'inactive'}`}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {form.description && (
                <p className="form-description">{form.description}</p>
              )}

              <div className="form-meta">
                <div className="meta-item">
                  <span className="meta-icon">📋</span>
                  <span>{form.fields?.length || 0} fields</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">👥</span>
                  <span>{form._count?.submissions || 0} submissions</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">📅</span>
                  <span>{formatDate(form.deadline)}</span>
                </div>
              </div>

              <div className="form-card-actions">
                <button 
                  className="form-action-button"
                  onClick={() => handleViewSubmissions(form)}
                >
                  View Submissions
                </button>
                <button 
                  className="form-action-button secondary"
                  onClick={() => handleEditForm(form)}
                >
                  Edit
                </button>
                <button 
                  className="form-action-button danger"
                  onClick={() => handleDeleteForm(form.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Forms
