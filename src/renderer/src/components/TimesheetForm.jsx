import { useEffect, useState } from 'react'
import useTimesheetStore, { SCHEDULE_PRESETS } from '../stores/timesheetStore'
import './TimesheetForm.css'

function TimesheetForm({ user, onBack }) {
  // Get state and actions from Zustand store
  const {
    loading,
    saving,
    timesheet,
    timeEntries,
    week1Total,
    week2Total,
    grandTotal,
    error,
    successMessage,
    payPeriodStart,
    payPeriodEnd,
    loadCurrentTimesheet,
    updateTimeEntry,
    applyPreset,
    clearEntry,
    saveEntry,
    handleSaveDraft,
    handleSubmit,
    handleRevertToDraft,
    reset
  } = useTimesheetStore()

  // Track which row just got updated for animation
  const [animatingRow, setAnimatingRow] = useState(null)

  useEffect(() => {
    loadCurrentTimesheet(user.id)
    
    // Reset store when component unmounts
    return () => reset()
  }, [user.id])

  const formatDayShort = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  }

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  }

  // Trigger animation when hours change
  const handleTimeChange = (index, field, value) => {
    updateTimeEntry(index, field, value)
    setAnimatingRow(index)
    setTimeout(() => setAnimatingRow(null), 600)
  }

  const handlePresetClick = (index, preset) => {
    applyPreset(index, preset)
    setAnimatingRow(index)
    setTimeout(() => {
      setAnimatingRow(null)
      saveEntry(index)
    }, 600)
  }

  const isViewOnly = timesheet?.status === 'SUBMITTED' || timesheet?.status === 'APPROVED'

  // Render a week table
  const renderWeekTable = (entries, weekNum, startIndex) => (
    <div className="week-block">
      <div className="week-header">
        <h2>Week {weekNum}</h2>
        <span className="week-total">
          {weekNum === 1 ? week1Total.toFixed(2) : week2Total.toFixed(2)} hrs
        </span>
      </div>
      
      {/* Quick-fill presets */}
      {!isViewOnly && (
        <div className="quick-fill-bar">
          <span className="quick-fill-label">Quick fill:</span>
          {SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className="preset-btn"
              onClick={() => {
                // Apply to all days in this week that are empty
                entries.forEach((entry, i) => {
                  if (!entry.startTime && !entry.endTime) {
                    handlePresetClick(startIndex + i, preset)
                  }
                })
              }}
              title={`${preset.start} - ${preset.end}, ${preset.break}min break`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Table header */}
      <div className="time-table">
        <div className="table-header">
          <div className="col-day">Day</div>
          <div className="col-start">Start</div>
          <div className="col-end">End</div>
          <div className="col-break">Break</div>
          <div className="col-hours">Hours</div>
          {!isViewOnly && <div className="col-actions">Quick</div>}
        </div>
        
        {/* Table rows */}
        {entries.map((entry, i) => {
          const globalIndex = startIndex + i
          const isAnimating = animatingRow === globalIndex
          const hasHours = entry.totalHours > 0
          
          return (
            <div 
              key={entry.date} 
              className={`table-row ${hasHours ? 'has-hours' : ''} ${isAnimating ? 'animating' : ''}`}
            >
              <div className="col-day">
                <span className="day-name">{formatDayShort(entry.date)}</span>
                <span className="day-date">{formatDateShort(entry.date)}</span>
              </div>
              
              <div className="col-start">
                <input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => handleTimeChange(globalIndex, 'startTime', e.target.value)}
                  onBlur={() => saveEntry(globalIndex)}
                  disabled={isViewOnly}
                />
              </div>
              
              <div className="col-end">
                <input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => handleTimeChange(globalIndex, 'endTime', e.target.value)}
                  onBlur={() => saveEntry(globalIndex)}
                  disabled={isViewOnly}
                />
              </div>
              
              <div className="col-break">
                <select
                  value={entry.breakMinutes}
                  onChange={(e) => {
                    handleTimeChange(globalIndex, 'breakMinutes', parseInt(e.target.value))
                    setTimeout(() => saveEntry(globalIndex), 100)
                  }}
                  disabled={isViewOnly}
                >
                  <option value="0">0</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="60">60</option>
                </select>
              </div>
              
              <div className={`col-hours ${isAnimating ? 'pulse' : ''}`}>
                <span className="hours-value">{entry.totalHours.toFixed(2)}</span>
              </div>
              
              {!isViewOnly && (
                <div className="col-actions">
                  {SCHEDULE_PRESETS.slice(0, 2).map((preset) => (
                    <button
                      key={preset.label}
                      className="mini-preset"
                      onClick={() => handlePresetClick(globalIndex, preset)}
                      title={preset.label}
                    >
                      {preset.label.split('-')[0]}
                    </button>
                  ))}
                  {hasHours && (
                    <button
                      className="clear-btn"
                      onClick={() => clearEntry(globalIndex)}
                      title="Clear"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

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
      {renderWeekTable(timeEntries.slice(0, 7), 1, 0)}

      {/* Week 2 */}
      {renderWeekTable(timeEntries.slice(7, 14), 2, 7)}

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
