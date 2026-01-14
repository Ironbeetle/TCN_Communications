import { getPrisma } from './database.js'

// Resend Email Service
// Note: You'll need to set RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME in .env

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

export async function sendEmail({ subject, message, recipients, attachments, userId }) {
  const prisma = getPrisma()
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
      content: att.content // Base64 encoded content
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

    // Log to database
    await prisma.emailLog.create({
      data: {
        subject,
        message,
        recipients: JSON.stringify(recipients),
        status,
        messageId: results.messageId,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        attachments: attachments ? JSON.stringify({ files: attachments.map(a => ({ filename: a.filename, size: a.size })) }) : null,
        userId
      }
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
    // Log failed attempt
    await prisma.emailLog.create({
      data: {
        subject,
        message,
        recipients: JSON.stringify(recipients),
        status: 'failed',
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

export async function getEmailHistory(userId, limit = 50) {
  const prisma = getPrisma()
  
  try {
    const logs = await prisma.emailLog.findMany({
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
        attachments: log.attachments ? JSON.parse(log.attachments) : null
      }))
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
