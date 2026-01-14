import { useState } from 'react'
import MemberSearch from './MemberSearch'
import './Composer.css'

function SmsComposer({ user }) {
  const [message, setMessage] = useState('')
  const [recipients, setRecipients] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)

  const charCount = message.length
  const segmentCount = Math.ceil(charCount / 160) || 1

  const handleSend = async () => {
    if (!message.trim() || recipients.length === 0) {
      setResult({ success: false, message: 'Please enter a message and select recipients' })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const phoneNumbers = recipients.map(r => r.phone).filter(Boolean)
      const response = await window.electronAPI.sms.send(message, phoneNumbers, user.id)
      setResult(response)
      
      if (response.success) {
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
      const response = await window.electronAPI.contacts.getAllPhones()
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
        <h2>Send SMS</h2>
        <p>Send text messages to community members</p>
      </div>

      <div className="composer-body">
        <div className="composer-section">
          <label>Recipients</label>
          <MemberSearch 
            type="phone"
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
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows={6}
          />
          <div className="char-count">
            {charCount} characters • {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
          </div>
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
            disabled={isSending || !message.trim() || recipients.length === 0}
          >
            {isSending ? 'Sending...' : `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SmsComposer
