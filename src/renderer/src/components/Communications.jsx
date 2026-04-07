import { useState } from 'react'
import SmsComposer from './SmsComposer'
import EmailComposer from './EmailComposer'
import BulletinCreator from './BulletinCreator'

function Communications({ user }) {
  const [activeTab, setActiveTab] = useState('sms')

  return (
    <div className="communications">
      <div className="comm-tabs">
        <button 
          className={`tab-button ${activeTab === 'sms' ? 'active' : ''}`}
          onClick={() => setActiveTab('sms')}
        >
          📱 SMS
        </button>
        <button 
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          📧 Email
        </button>
        <button 
          className={`tab-button ${activeTab === 'bulletin' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulletin')}
        >
          📋 Bulletin
        </button>
      </div>

      <div className="comm-content">
        {activeTab === 'sms' && <SmsComposer user={user} />}
        {activeTab === 'email' && <EmailComposer user={user} />}
        {activeTab === 'bulletin' && <BulletinCreator user={user} />}
      </div>
    </div>
  )
}

export default Communications
