import { useState, useEffect } from 'react'
import './Forms.css'

function SubmissionsViewer({ form, onBack }) {
  const [submissions, setSubmissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [formDetails, setFormDetails] = useState(null)
  const [syncMessage, setSyncMessage] = useState(null)

  useEffect(() => {
    loadFormAndSubmissions()
  }, [form.id])

  const loadFormAndSubmissions = async () => {
    setIsLoading(true)
    try {
      // Get full form details with fields
      const formResult = await window.electronAPI.forms.get(form.id)
      if (formResult.success) {
        setFormDetails(formResult.form)
      }

      // Get submissions (local only on initial load)
      const result = await window.electronAPI.forms.getSubmissions(form.id)
      if (result.success) {
        setSubmissions(result.submissions)
      }
    } catch (error) {
      console.error('Failed to load submissions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Manual sync from portal
  const handleSyncFromPortal = async () => {
    setIsSyncing(true)
    setSyncMessage(null)
    try {
      const syncResult = await window.electronAPI.forms.syncSubmissions(form.id)
      console.log('Sync result:', syncResult)
      
      if (syncResult.success) {
        setSyncMessage({
          type: 'success',
          text: syncResult.message || `Synced ${syncResult.synced} submissions`
        })
        // Reload submissions after sync
        const result = await window.electronAPI.forms.getSubmissions(form.id)
        if (result.success) {
          setSubmissions(result.submissions)
        }
      } else {
        setSyncMessage({
          type: 'error',
          text: syncResult.error || 'Sync failed'
        })
      }
    } catch (syncError) {
      console.error('Portal sync failed:', syncError)
      setSyncMessage({
        type: 'error',
        text: syncError.message || 'Failed to sync from portal'
      })
    } finally {
      setIsSyncing(false)
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000)
    }
  }

  const handleDelete = async (submissionId) => {
    if (!confirm('Are you sure you want to delete this submission?')) {
      return
    }

    try {
      const result = await window.electronAPI.forms.deleteSubmission(submissionId)
      if (result.success) {
        setSubmissions(submissions.filter(s => s.id !== submissionId))
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const exportToCSV = () => {
    if (!formDetails || submissions.length === 0) return

    const headers = ['Name', 'Email', 'Phone', 'Submitted At', ...formDetails.fields.map(f => f.label)]
    const rows = submissions.map(sub => {
      const responses = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : sub.responses
      return [
        sub.name,
        sub.email || '',
        sub.phone || '',
        new Date(sub.submittedAt).toLocaleString(),
        ...formDetails.fields.map(f => responses[f.id] || responses[f.label] || '')
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.title.replace(/[^a-z0-9]/gi, '_')}_submissions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getResponseValue = (submission, field) => {
    const responses = typeof submission.responses === 'string' 
      ? JSON.parse(submission.responses) 
      : submission.responses
    return responses[field.id] || responses[field.label] || '-'
  }

  if (isLoading) {
    return (
      <div className="submissions-viewer">
        <div className="submissions-loading">Loading submissions...</div>
      </div>
    )
  }

  return (
    <div className="submissions-viewer">
      <div className="submissions-header">
        <div>
          <h2>{form.title}</h2>
          <p>Form submissions {form.portalFormId && <span className="synced-badge">● Portal Synced</span>}</p>
        </div>
        <div style={{ display: 'flex',justifyContent:"center"  ,gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="sync-button" 
            onClick={handleSyncFromPortal}
            disabled={isSyncing}
            title="Sync submissions from portal"
          >
            {isSyncing ? '⟳ Syncing...' : '⟳ Sync from Portal'}
          </button>
          {submissions.length > 0 && (
            <button className="export-button" onClick={exportToCSV}>
              Export CSV
            </button>

          )}
          <button className="back-button" onClick={onBack}>← Back to Forms</button>
        </div>
      </div>

      {syncMessage && (
        <div className={`sync-message ${syncMessage.type}`}>
          {syncMessage.text}
        </div>
      )}

      <div className="submissions-stats">
        <div className="stat-box">
          <div className="value">{submissions.length}</div>
          <div className="label">Total Submissions</div>
        </div>
        {form.maxEntries && (
          <div className="stat-box">
            <div className="value">{form.maxEntries - submissions.length}</div>
            <div className="label">Spots Remaining</div>
          </div>
        )}
        {form.deadline && (
          <div className="stat-box">
            <div className="value">{new Date(form.deadline) > new Date() ? 'Open' : 'Closed'}</div>
            <div className="label">Deadline: {formatDate(form.deadline).split(',')[0]}</div>
          </div>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="submissions-empty">
          <p>No submissions yet</p>
        </div>
      ) : (
        <div className="submissions-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                {formDetails?.fields.slice(0, 3).map(field => (
                  <th key={field.id}>{field.label}</th>
                ))}
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(submission => (
                <tr key={submission.id}>
                  <td>{submission.name}</td>
                  <td>{submission.email || '-'}</td>
                  <td>{submission.phone || '-'}</td>
                  {formDetails?.fields.slice(0, 3).map(field => (
                    <td key={field.id}>{getResponseValue(submission, field)}</td>
                  ))}
                  <td>{formatDate(submission.submittedAt)}</td>
                  <td>
                    <button 
                      className="form-action-button danger"
                      onClick={() => handleDelete(submission.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default SubmissionsViewer
