import { useState } from 'react'
import MemberSearch from './MemberSearch'
import { LOGOS, getLogoPreviewPath, getDefaultLogo } from '../config/logos'

function EmailComposer({ user }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [recipients, setRecipients] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)
  const [useLetterhead, setUseLetterhead] = useState(true)
  const [selectedLogoId, setSelectedLogoId] = useState(getDefaultLogo()?.id || 'tcn-main')

  const selectedLogo = LOGOS.find(l => l.id === selectedLogoId) || getDefaultLogo()

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || recipients.length === 0) {
      setResult({ success: false, message: 'Please fill in all fields and select recipients' })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const emails = recipients.map(r => r.email).filter(Boolean)
      const letterheadConfig = useLetterhead ? { enabled: true, logoId: selectedLogoId } : { enabled: false }
      const response = await window.electronAPI.email.send(subject, message, emails, null, user.id, letterheadConfig)
      setResult(response)
      
      if (response.success) {
        setSubject('')
        setMessage('')
        setRecipients([])
      }
    } catch (error) {
      setResult({ success: false, message: error.message })
    } finally {
      setIsSending(false)
    }
  }

  const handleSelectAll = async () => {
    try {
      const response = await window.electronAPI.contacts.getAllEmails()
      if (response.success) {
        setRecipients(response.members)
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  // TEMPORARY: Load members with Profile but no fnauth (password reset notification)
  const handleLoadAffectedMembers = async () => {
    try {
      setResult({ success: true, message: 'Loading affected members...' })
      const response = await window.electronAPI.contacts.getAffectedMembers()
      if (response.success) {
        setRecipients(response.members)
        setResult({ 
          success: true, 
          message: response.message || `Loaded ${response.members.length} affected members`
        })
      } else {
        setResult({ success: false, message: response.error || 'Failed to load affected members' })
      }
    } catch (error) {
      console.error('Failed to load affected members:', error)
      setResult({ success: false, message: error.message })
    }
  }

  return (
    <div className="composer-split-layout">
      {/* LEFT PANEL - Email Composer (65%) */}
      <div className="composer-left-panel">
        <div className="panel-header">
          <h2>Compose Email</h2>
          <p>Create and send email campaigns to members</p>
        </div>

        <div className="composer-form">
          {/* Subject */}
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject line..."
            />
          </div>

          {/* Message */}
          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your email content here..."
              rows={12}
            />
          </div>

          {/* Letterhead - Compact */}
          <div className="form-group letterhead-compact">
            <div className="letterhead-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useLetterhead}
                  onChange={(e) => setUseLetterhead(e.target.checked)}
                />
                <span>Include letterhead</span>
              </label>
              
              {useLetterhead && (
                <div className="logo-select-inline">
                  <select
                    value={selectedLogoId}
                    onChange={(e) => setSelectedLogoId(e.target.value)}
                  >
                    {LOGOS.map((logo) => (
                      <option key={logo.id} value={logo.id}>{logo.name}</option>
                    ))}
                  </select>
                  <img 
                    src={getLogoPreviewPath(selectedLogo?.filename)} 
                    alt={selectedLogo?.name || 'Logo'} 
                    className="logo-preview-small"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`result-message ${result.success ? 'success' : 'error'}`}>
              {result.message}
            </div>
          )}

          {/* Send Button */}
          <div className="form-actions">
            <button 
              className="send-button"
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !message.trim() || recipients.length === 0}
            >
              {isSending ? 'Sending...' : `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Member Search (35%) */}
      <div className="composer-right-panel">
        <div className="panel-header">
          <h3>Select Recipients</h3>
          <div className="recipient-summary">
            {recipients.length > 0 ? (
              <span className="count-badge">{recipients.length} selected</span>
            ) : (
              <span className="hint">Search and select members below</span>
            )}
          </div>
        </div>
        
        <div className="recipient-quick-actions">
          <button type="button" className="quick-action-btn" onClick={handleSelectAll}>
            Select All Members
          </button>
          {/* TEMPORARY: Button for loading affected members (Profile without fnauth) */}
          <button 
            type="button" 
            className="quick-action-btn affected" 
            onClick={handleLoadAffectedMembers}
            title="Load members with Profile but no fnauth entry (password reset needed)"
          >
            Load Affected (~82)
          </button>
          {recipients.length > 0 && (
            <button type="button" className="quick-action-btn clear" onClick={() => setRecipients([])}>
              Clear All
            </button>
          )}
        </div>

        <MemberSearch 
          type="email"
          selected={recipients}
          onSelect={setRecipients}
          compact={true}
        />
      </div>
    </div>
  )
}

export default EmailComposer
