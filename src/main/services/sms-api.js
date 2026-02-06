// SMS Service for TCN Communications
// Sends SMS via Twilio and logs to VPS for centralized record-keeping

import { apiRequest } from './api-helpers.js'

// Twilio client
let twilioClient = null

async function getTwilioClient() {
  if (!twilioClient) {
    const twilio = await import('twilio')
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured')
    }
    
    twilioClient = twilio.default(accountSid, authToken)
  }
  return twilioClient
}

function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '')
  
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  return phone.startsWith('+') ? phone : `+${digits}`
}

/**
 * Send SMS via Twilio and log to VPS
 */
export async function sendSms({ message, recipients, userId }) {
  const results = {
    successful: 0,
    failed: 0,
    total: recipients.length,
    messageIds: [],
    errors: []
  }

  try {
    const client = await getTwilioClient()
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!fromNumber) {
      throw new Error('Twilio phone number not configured')
    }

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        const formattedNumber = formatPhoneNumber(recipient)
        const response = await client.messages.create({
          body: message,
          from: fromNumber,
          to: formattedNumber
        })
        
        results.messageIds.push(response.sid)
        results.successful++
      } catch (error) {
        results.failed++
        results.errors.push({
          recipient,
          error: error.message
        })
      }
    }

    // Determine status
    let status = 'sent'
    if (results.failed > 0 && results.successful > 0) {
      status = 'partial'
    } else if (results.failed === results.total) {
      status = 'failed'
    }

    // Log to VPS
    await apiRequest('/api/comm/sms-logs', {
      method: 'POST',
      body: JSON.stringify({
        message,
        recipients,
        status,
        messageIds: results.messageIds,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        userId
      })
    })

    return {
      success: status !== 'failed',
      message: status === 'sent' 
        ? `Successfully sent ${results.successful} SMS messages`
        : status === 'partial'
        ? `Sent ${results.successful} of ${results.total} messages`
        : 'Failed to send messages',
      results
    }
  } catch (error) {
    // Log failed attempt to VPS
    await apiRequest('/api/comm/sms-logs', {
      method: 'POST',
      body: JSON.stringify({
        message,
        recipients,
        status: 'failed',
        messageIds: [],
        error: error.message,
        userId
      })
    })

    return {
      success: false,
      message: error.message,
      results
    }
  }
}

/**
 * Get SMS history from VPS
 */
export async function getSmsHistory(userId, limit = 50) {
  try {
    const endpoint = userId 
      ? `/api/comm/sms-logs?userId=${userId}&limit=${limit}`
      : `/api/comm/sms-logs?limit=${limit}`
    
    const result = await apiRequest(endpoint)
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch SMS history' }
    }
    
    return { success: true, logs: result.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get SMS stats for dashboard
 */
export async function getSmsStats(userId) {
  try {
    const endpoint = userId 
      ? `/api/comm/sms-logs/stats?userId=${userId}`
      : `/api/comm/sms-logs/stats`
    
    const result = await apiRequest(endpoint)
    
    if (!result.success) {
      return { sent: 0, failed: 0 }
    }
    
    return result.data
  } catch (error) {
    return { sent: 0, failed: 0 }
  }
}
