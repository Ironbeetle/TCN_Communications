import { getPrisma } from './database.js'

// Twilio SMS Service
// Note: You'll need to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env

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
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // If it's 10 digits, assume US/Canada and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // If it already has country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // Return as-is with + prefix if not already
  return phone.startsWith('+') ? phone : `+${digits}`
}

export async function sendSms({ message, recipients, userId }) {
  const prisma = getPrisma()
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

    // Log to database
    await prisma.smsLog.create({
      data: {
        message,
        recipients: JSON.stringify(recipients),
        status,
        messageIds: JSON.stringify(results.messageIds),
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        userId
      }
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
    // Log failed attempt
    await prisma.smsLog.create({
      data: {
        message,
        recipients: JSON.stringify(recipients),
        status: 'failed',
        messageIds: '[]',
        error: error.message,
        userId
      }
    })

    return {
      success: false,
      message: error.message,
      results
    }
  }
}

export async function getSmsHistory(userId, limit = 50) {
  const prisma = getPrisma()
  
  try {
    const logs = await prisma.smsLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { created: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
    
    return {
      success: true,
      logs: logs.map(log => ({
        ...log,
        recipients: JSON.parse(log.recipients),
        messageIds: JSON.parse(log.messageIds)
      }))
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
