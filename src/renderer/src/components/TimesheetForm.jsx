import { useState, useEffect } from 'react'
import './TimesheetForm.css'

function TimesheetForm({ user, onBack }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [timesheet, setTimesheet] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [week1Total, setWeek1Total] = useState(0)
  const [week2Total, setWeek2Total] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Pay period dates
  const [payPeriodStart, setPayPeriodStart] = useState(null)
  const [payPeriodEnd, setPayPeriodEnd] = useState(null)

  useEffect(() => {
    loadCurrentTimesheet()
  }, [])

  useEffect(() => {
    calculateTotals()
  }, [timeEntries])

  const loadCurrentTimesheet = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await window.electronAPI.timesheets.getCurrent(user.id)
      
      if (result.success) {
        const ts = result.timesheet
        setTimesheet(ts)
        setPayPeriodStart(new Date(ts.payPeriodStart))
        setPayPeriodEnd(new Date(ts.payPeriodEnd))
        
        // Initialize time entries for all 14 days
        initializeTimeEntries(ts)
      } else {
        setError(result.error || 'Failed to load timesheet')
      }
    } catch (err) {
      console.error('Error loading timesheet:', err)
      setError('Failed to load timesheet')
    } finally {
      setLoading(false)
    }
  }

  const initializeTimeEntries = (ts) => {
    const start = new Date(ts.payPeriodStart)
    const existingEntries = ts.timeEntries || []
    
    // Create entries for all 14 days
    const entries = []
    for (let i = 0; i < 14; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      // Check if entry exists for this date
      const existing = existingEntries.find(e => 
        new Date(e.date).toISOString().split('T')[0] === dateStr
      )
      
      entries.push({
        id: existing?.id || null,
        date: dateStr,
        startTime: existing?.startTime || '',
        endTime: existing?.endTime || '',
        breakMinutes: existing?.breakMinutes || 0,
        totalHours: existing?.totalHours || 0,
      })
    }
    
    setTimeEntries(entries)
  }

  const calculateTotalHours = (startTime, endTime, breakMinutes) => {
    if (!startTime || !endTime) return 0
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    let totalMinutes = endMinutes - startMinutes - breakMinutes
    if (totalMinutes < 0) totalMinutes = 0
    
    return Math.round((totalMinutes / 60) * 100) / 100
  }

  const calculateTotals = () => {
    let week1 = 0
    let week2 = 0

    timeEntries.forEach((entry, index) => {
      if (index < 7) {
        week1 += entry.totalHours
      } else {
        week2 += entry.totalHours
      }
    })

    setWeek1Total(Math.round(week1 * 100) / 100)
    setWeek2Total(Math.round(week2 * 100) / 100)
    setGrandTotal(Math.round((week1 + week2) * 100) / 100)
  }

  const updateTimeEntry = async (index, field, value) => {
    const updatedEntries = [...timeEntries]
    updatedEntries[index] = { ...updatedEntries[index], [field]: value }

    // Recalculate total hours if time fields changed
    if (field === 'startTime' || field === 'endTime' || field === 'breakMinutes') {
      const entry = updatedEntries[index]
      entry.totalHours = calculateTotalHours(entry.startTime, entry.endTime, entry.breakMinutes)
    }

    setTimeEntries(updatedEntries)
  }

  const saveEntry = async (index) => {
    if (!timesheet) return
    
    const entry = timeEntries[index]
    if (!entry.startTime || !entry.endTime) return
    
    try {
      const result = await window.electronAPI.timesheets.saveEntry({
        timesheetId: timesheet.id,
        entryId: entry.id,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes
      })
      
      if (result.success) {
        // Update entry with saved ID
        const updatedEntries = [...timeEntries]
        if (result.entry) {
          updatedEntries[index].id = result.entry.id
        }
        setTimeEntries(updatedEntries)
        
        // Update totals from response
        if (result.totals) {
          setWeek1Total(result.totals.week1Total)
          setWeek2Total(result.totals.week2Total)
          setGrandTotal(result.totals.grandTotal)
        }
      }
    } catch (err) {
      console.error('Error saving entry:', err)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      // Save all non-empty entries
      for (let i = 0; i < timeEntries.length; i++) {
        const entry = timeEntries[i]
        if (entry.startTime && entry.endTime) {
          await saveEntry(i)
        }
      }
      
      setSuccessMessage('Timesheet saved as draft!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving draft:', err)
      setError('Failed to save timesheet')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (grandTotal === 0) {
      setError('Cannot submit a timesheet with no hours logged')
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      // First save all entries
      for (let i = 0; i < timeEntries.length; i++) {
        const entry = timeEntries[i]
        if (entry.startTime && entry.endTime) {
          await saveEntry(i)
        }
      }
      
      // Then submit
      const result = await window.electronAPI.timesheets.submit(timesheet.id)
      
      if (result.success) {
        setSuccessMessage('Timesheet submitted for approval!')
        setTimesheet(result.timesheet)
      } else {
        setError(result.error || 'Failed to submit timesheet')
      }
    } catch (err) {
      console.error('Error submitting:', err)
      setError('Failed to submit timesheet')
    } finally {
      setSaving(false)
    }
  }

  const handleRevertToDraft = async () => {
    setSaving(true)
    setError(null)
    
    try {
      const result = await window.electronAPI.timesheets.revertToDraft(timesheet.id)
      
      if (result.success) {
        setTimesheet(result.timesheet)
        setSuccessMessage('Timesheet reverted to draft. You can now edit and resubmit.')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to revert timesheet')
      }
    } catch (err) {
      console.error('Error reverting:', err)
      setError('Failed to revert timesheet')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  const isViewOnly = timesheet?.status === 'SUBMITTED' || timesheet?.status === 'APPROVED'

  if (loading) {
    return (
      <div className="timesheet-form">
        <div className="timesheet-loading">
          <div className="spinner"></div>
          <p>Loading timesheet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="timesheet-form">
      {/* Header */}
      <div className="timesheet-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="header-info">
            <h1>{isViewOnly ? 'View Timesheet' : timesheet?.id ? 'Current Timesheet' : 'New Timesheet'}</h1>
            <p>
              {user.first_name} {user.last_name} • 
              {payPeriodStart && payPeriodEnd && (
                <span> {payPeriodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} - {payPeriodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
              )}
            </p>
          </div>
        </div>
        
        {!isViewOnly && (
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              💾 Save Draft
            </button>
            <button 
              className="btn-primary"
              onClick={handleSubmit}
              disabled={saving || grandTotal === 0}
            >
              📤 Submit for Approval
            </button>
          </div>
        )}
        
        {timesheet?.status === 'REJECTED' && (
          <div className="header-actions">
            <button 
              className="btn-warning"
              onClick={handleRevertToDraft}
              disabled={saving}
            >
              ✏️ Edit & Resubmit
            </button>
          </div>
        )}
      </div>

      {/* Status Banner */}
      {timesheet?.status && timesheet.status !== 'DRAFT' && (
        <div className={`status-banner status-${timesheet.status.toLowerCase()}`}>
          <strong>Status: {timesheet.status}</strong>
          {timesheet.status === 'SUBMITTED' && timesheet.submittedAt && (
            <span> • Submitted on {new Date(timesheet.submittedAt).toLocaleDateString('en-CA', { timeZone: 'UTC' })}</span>
          )}
          {timesheet.status === 'APPROVED' && timesheet.approvedAt && (
            <span> • Approved on {new Date(timesheet.approvedAt).toLocaleDateString('en-CA', { timeZone: 'UTC' })}</span>
          )}
          {timesheet.status === 'REJECTED' && (
            <>
              {timesheet.rejectedAt && <span> • Rejected on {new Date(timesheet.rejectedAt).toLocaleDateString('en-CA', { timeZone: 'UTC' })}</span>}
              {timesheet.rejectionReason && <span className="rejection-reason"> • Reason: {timesheet.rejectionReason}</span>}
            </>
          )}
        </div>
      )}

      {/* Messages */}
      {error && <div className="message error">{error}</div>}
      {successMessage && <div className="message success">{successMessage}</div>}

      {/* Week 1 */}
      <div className="week-block">
        <div className="week-header">
          <h2>Week 1</h2>
          <span className="week-total">{week1Total.toFixed(2)} hours</span>
        </div>
        <div className="time-entries">
          {timeEntries.slice(0, 7).map((entry, index) => (
            <div key={entry.date} className="time-entry-row">
              <div className="entry-date">
                <span className="day-name">{formatDate(entry.date)}</span>
              </div>
              
              <div className="entry-field">
                <label>Start Time</label>
                <input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => updateTimeEntry(index, 'startTime', e.target.value)}
                  onBlur={() => saveEntry(index)}
                  disabled={isViewOnly}
                />
              </div>
              
              <div className="entry-field">
                <label>End Time</label>
                <input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => updateTimeEntry(index, 'endTime', e.target.value)}
                  onBlur={() => saveEntry(index)}
                  disabled={isViewOnly}
                />
              </div>
              
              <div className="entry-field">
                <label>Break</label>
                <select
                  value={entry.breakMinutes}
                  onChange={(e) => {
                    updateTimeEntry(index, 'breakMinutes', parseInt(e.target.value))
                    setTimeout(() => saveEntry(index), 100)
                  }}
                  disabled={isViewOnly}
                >
                  <option value="0">No Break</option>
                  <option value="5">5 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
              
              <div className="entry-hours">
                <label>Hours</label>
                <div className="hours-display">{entry.totalHours.toFixed(2)}h</div>
              </div>
              
              {entry.totalHours > 0 && (
                <div className="entry-status logged">
                  ✓ Logged
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Week 2 */}
      <div className="week-block">
        <div className="week-header">
          <h2>Week 2</h2>
          <span className="week-total">{week2Total.toFixed(2)} hours</span>
        </div>
        <div className="time-entries">
          {timeEntries.slice(7, 14).map((entry, index) => {
            const globalIndex = index + 7
            return (
              <div key={entry.date} className="time-entry-row">
                <div className="entry-date">
                  <span className="day-name">{formatDate(entry.date)}</span>
                </div>
                
                <div className="entry-field">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={entry.startTime}
                    onChange={(e) => updateTimeEntry(globalIndex, 'startTime', e.target.value)}
                    onBlur={() => saveEntry(globalIndex)}
                    disabled={isViewOnly}
                  />
                </div>
                
                <div className="entry-field">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={entry.endTime}
                    onChange={(e) => updateTimeEntry(globalIndex, 'endTime', e.target.value)}
                    onBlur={() => saveEntry(globalIndex)}
                    disabled={isViewOnly}
                  />
                </div>
                
                <div className="entry-field">
                  <label>Break</label>
                  <select
                    value={entry.breakMinutes}
                    onChange={(e) => {
                      updateTimeEntry(globalIndex, 'breakMinutes', parseInt(e.target.value))
                      setTimeout(() => saveEntry(globalIndex), 100)
                    }}
                    disabled={isViewOnly}
                  >
                    <option value="0">No Break</option>
                    <option value="5">5 min</option>
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
                
                <div className="entry-hours">
                  <label>Hours</label>
                  <div className="hours-display">{entry.totalHours.toFixed(2)}h</div>
                </div>
                
                {entry.totalHours > 0 && (
                  <div className="entry-status logged">
                    ✓ Logged
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="timesheet-summary">
        <div className="summary-item">
          <span className="summary-label">Week 1 Total</span>
          <span className="summary-value">{week1Total.toFixed(2)}h</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Week 2 Total</span>
          <span className="summary-value">{week2Total.toFixed(2)}h</span>
        </div>
        <div className="summary-item grand-total">
          <span className="summary-label">Grand Total</span>
          <span className="summary-value">{grandTotal.toFixed(2)}h</span>
        </div>
      </div>
    </div>
  )
}

export default TimesheetForm
