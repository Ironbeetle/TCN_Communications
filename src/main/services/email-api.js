// Email Service for TCN Communications
// Sends emails via Resend and logs to VPS for centralized record-keeping

import { apiRequest } from './api-helpers.js'

// Resend client
let resendClient = null

async function getResendClient() {
  if (!resendClient) {
    const { Resend } = await import('resend')
    const apiKey = process.env.RESEND_API_KEY
    
    if (!apiKey) {
      throw new Error('Resend API key not configured')
    }
    
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

function createHtmlTemplate(message, subject) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          border-bottom: 2px solid #00d9ff;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          color: #1a1a2e;
          margin: 0;
          font-size: 24px;
        }
        .content {
          white-space: pre-wrap;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Tataskweyak Cree Nation</h2>
      </div>
      <div class="content">${message.replace(/\n/g, '<br>')}</div>
      <div class="footer">
        <p>This email was sent by the Tataskweyak Cree Nation Band Office.</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Send email via Resend and log to VPS
 */
export async function sendEmail({ subject, message, recipients, attachments, userId }) {
  const results = {
    successful: 0,
    failed: 0,
    total: recipients.length,
    messageId: null,
    errors: []
  }

  try {
    const resend = await getResendClient()
    const fromEmail = process.env.RESEND_FROM_EMAIL
    const fromName = process.env.RESEND_FROM_NAME || 'TCN Band Office'

    if (!fromEmail) {
      throw new Error('Resend from email not configured')
    }

    const htmlContent = createHtmlTemplate(message, subject)

    // Prepare attachments if any
    const emailAttachments = attachments?.map(att => ({
      filename: att.filename,
      content: att.content
    })) || []

    // Send to all recipients
    for (const recipient of recipients) {
      try {
        const response = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [recipient],
          subject,
          html: htmlContent,
          text: message,
          attachments: emailAttachments
        })

        if (response.data?.id) {
          results.messageId = response.data.id
          results.successful++
        } else {
          throw new Error(response.error?.message || 'Unknown error')
        }
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
    await apiRequest('/api/comm/email-logs', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        message,
        recipients,
        status,
        messageId: results.messageId,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        attachments: attachments ? attachments.map(a => ({ filename: a.filename, size: a.size })) : null,
        userId
      })
    })

    return {
      success: status !== 'failed',
      message: status === 'sent'
        ? `Successfully sent ${results.successful} emails`
        : status === 'partial'
        ? `Sent ${results.successful} of ${results.total} emails`
        : 'Failed to send emails',
      results
    }
  } catch (error) {
    // Log failed attempt to VPS
    await apiRequest('/api/comm/email-logs', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        message,
        recipients,
        status: 'failed',
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
 * Get email history from VPS
 */
export async function getEmailHistory(userId, limit = 50) {
  try {
    const endpoint = userId 
      ? `/api/comm/email-logs?userId=${userId}&limit=${limit}`
      : `/api/comm/email-logs?limit=${limit}`
    
    const result = await apiRequest(endpoint)
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch email history' }
    }
    
    return { success: true, logs: result.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get email stats for dashboard
 */
export async function getEmailStats(userId) {
  try {
    const endpoint = userId 
      ? `/api/comm/email-logs/stats?userId=${userId}`
      : `/api/comm/email-logs/stats`
    
    const result = await apiRequest(endpoint)
    
    if (!result.success) {
      return { sent: 0, failed: 0 }
    }
    
    return result.data
  } catch (error) {
    return { sent: 0, failed: 0 }
  }
}


// ==================== STAFF EMAIL ====================
// Staff email is internal communication between staff members

/**
 * Send staff email (internal)
 */
export async function sendStaffEmail({ subject, message, recipients, attachments, userId }) {
  // Staff emails use same Resend infrastructure
  const result = await sendEmail({ subject, message, recipients, attachments, userId })
  
  // Additionally log as staff email on VPS
  if (result.success || result.results?.successful > 0) {
    await apiRequest('/api/comm/staff-email-logs', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        message,
        recipients,
        status: result.results?.failed === 0 ? 'sent' : 'partial',
        messageId: result.results?.messageId,
        error: result.results?.errors?.length > 0 ? JSON.stringify(result.results.errors) : null,
        attachments: attachments ? attachments.map(a => ({ filename: a.filename, size: a.size })) : null,
        userId
      })
    })
  }
  
  return result
}

/**
 * Get staff email history from VPS
 */
export async function getStaffEmailHistory(userId, limit = 50) {
  try {
    const endpoint = userId 
      ? `/api/comm/staff-email-logs?userId=${userId}&limit=${limit}`
      : `/api/comm/staff-email-logs?limit=${limit}`
    
    const result = await apiRequest(endpoint)
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch staff email history' }
    }
    
    return { success: true, logs: result.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
