import { useState } from 'react'
import MemberSearch from './MemberSearch'
import './Composer.css'

function EmailComposer({ user }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [recipients, setRecipients] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || recipients.length === 0) {
      setResult({ success: false, message: 'Please fill in all fields and select recipients' })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const emails = recipients.map(r => r.email).filter(Boolean)
      const response = await window.electronAPI.email.send(subject, message, emails, null, user.id)
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

  return (
    <div className="composer">
      <div className="composer-header">
        <h2>Send Email</h2>
        <p>Send email campaigns to community members</p>
      </div>

      <div className="composer-body">
        <div className="composer-section">
          <label>Recipients</label>
          <MemberSearch 
            type="email"
            selected={recipients}
            onSelect={setRecipients}
          />
          <div className="recipient-actions">
            <button type="button" className="link-button" onClick={handleSelectAll}>
              Select All Members
            </button>
            {recipients.length > 0 && (
              <span className="recipient-count">{recipients.length} selected</span>
            )}
          </div>
        </div>

        <div className="composer-section">
          <label htmlFor="subject">Subject</label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
          />
        </div>

        <div className="composer-section">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your email content here..."
            rows={10}
          />
        </div>

        {result && (
          <div className={`result-message ${result.success ? 'success' : 'error'}`}>
            {result.message}
          </div>
        )}

        <div className="composer-actions">
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
  )
}

export default EmailComposer
