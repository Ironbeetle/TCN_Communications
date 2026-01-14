import { getPrisma } from './database.js'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

// Bulletin Service - Posts to TCN Portal
// API Reference: See REFERENCE/BULLETIN_SYNC_API.md
// 
// Flow:
// 1. Create local BulletinApiLog to get sourceId
// 2. Upload poster to portal: POST /api/sync/poster (multipart/form-data)
// 3. Sync bulletin to portal: POST /api/sync/bulletin (JSON)

const getPortalConfig = () => {
  const baseUrl = process.env.PORTAL_API_URL || process.env.TCN_PORTAL_URL
  const apiKey = process.env.PORTAL_API_KEY || process.env.TCN_PORTAL_API_KEY
  
  return { baseUrl, apiKey }
}

// Helper to create multipart form data manually
function createMultipartFormData(fields, file) {
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2)
  const parts = []
  
  // Add text fields
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    )
  }
  
  // Add file field
  if (file) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`
    )
  }
  
  const header = Buffer.from(parts.join(''), 'utf8')
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  
  // Combine: header + file data + footer
  const body = Buffer.concat([header, file.data, footer])
  
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

// Upload poster image to portal
// Endpoint: POST /api/sync/poster
// Content-Type: multipart/form-data
// Returns: { success, data: { poster_url } }
export async function uploadPoster({ sourceId, filename, data, mimeType }) {
  const { baseUrl, apiKey } = getPortalConfig()
  
  try {
    if (!baseUrl || !apiKey) {
      // Fallback: save locally if portal not configured
      const uploadsDir = join(app.getPath('userData'), 'uploads', 'posters')
      await mkdir(uploadsDir, { recursive: true })
      
      // Extract base64 data
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      
      // Use sourceId as filename for consistency
      const ext = filename.split('.').pop() || 'jpg'
      const localFilename = `${sourceId}.${ext}`
      const filePath = join(uploadsDir, localFilename)
      
      await writeFile(filePath, buffer)
      
      return {
        success: true,
        poster_url: `local://${filePath}`,
        message: 'Poster saved locally (portal not configured)'
      }
    }

    // Extract base64 data and create buffer
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Get file extension
    const ext = filename.split('.').pop() || 'jpg'
    const uploadFilename = `${sourceId}.${ext}`
    
    // Create multipart form data
    const { body, contentType } = createMultipartFormData(
      {
        sourceId: sourceId,
        filename: filename
      },
      {
        filename: uploadFilename,
        contentType: mimeType || 'image/jpeg',
        data: buffer
      }
    )

    // Upload to portal: POST /api/sync/poster
    const response = await fetch(`${baseUrl}/poster`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': contentType
      },
      body: body
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || 'Upload failed')
    }
    
    return {
      success: true,
      poster_url: result.data.poster_url,
      message: 'Poster uploaded successfully'
    }
  } catch (error) {
    console.error('Upload poster error:', error)
    return {
      success: false,
      message: error.message || 'Failed to upload poster'
    }
  }
}

// Sync bulletin to portal
// Endpoint: POST /api/sync/bulletin
// Content-Type: application/json
export async function syncBulletinToPortal({ sourceId, title, subject, poster_url, category, userId, created }) {
  const { baseUrl, apiKey } = getPortalConfig()
  
  if (!baseUrl || !apiKey) {
    return { success: false, message: 'Portal API not configured' }
  }

  try {
    const response = await fetch(`${baseUrl}/bulletin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        sourceId,
        title,
        subject,
        poster_url,
        category,
        userId,
        created
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Sync failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || 'Sync failed')
    }
    
    return {
      success: true,
      data: result.data,
      message: 'Bulletin synced successfully'
    }
  } catch (error) {
    console.error('Sync bulletin error:', error)
    return {
      success: false,
      message: error.message || 'Failed to sync bulletin'
    }
  }
}

// Main function to create bulletin
// This handles the full flow: create local record -> upload poster -> sync to portal
export async function createBulletin({ title, subject, category, posterFile, userId }) {
  const prisma = getPrisma()

  // posterFile should be: { filename, data (base64), mimeType }
  if (!posterFile || !posterFile.data) {
    return {
      success: false,
      message: 'Poster image is required'
    }
  }

  try {
    // Step 1: Create local bulletin record first to get sourceId
    const localBulletin = await prisma.bulletinApiLog.create({
      data: {
        title,
        subject,
        poster_url: '', // Will update after upload
        category: category || 'ANNOUNCEMENTS',
        userId
      }
    })

    const sourceId = localBulletin.id

    // Step 2: Upload poster to portal
    const uploadResult = await uploadPoster({
      sourceId,
      filename: posterFile.filename,
      data: posterFile.data,
      mimeType: posterFile.mimeType
    })

    if (!uploadResult.success) {
      // Clean up local record on failure
      await prisma.bulletinApiLog.delete({ where: { id: sourceId } })
      return {
        success: false,
        message: `Failed to upload poster: ${uploadResult.message}`
      }
    }

    const poster_url = uploadResult.poster_url

    // Step 3: Update local record with poster URL
    await prisma.bulletinApiLog.update({
      where: { id: sourceId },
      data: { poster_url }
    })

    // Step 4: Sync bulletin to portal
    const syncResult = await syncBulletinToPortal({
      sourceId,
      title,
      subject,
      poster_url,
      category: category || 'ANNOUNCEMENTS',
      userId,
      created: localBulletin.created.toISOString()
    })

    if (!syncResult.success) {
      // Poster uploaded but sync failed - keep local record but report error
      return {
        success: false,
        message: `Poster uploaded but sync failed: ${syncResult.message}`,
        bulletin: {
          id: sourceId,
          title,
          subject,
          poster_url,
          category,
          synced: false
        }
      }
    }

    return {
      success: true,
      message: 'Bulletin posted successfully',
      bulletin: {
        id: sourceId,
        portalId: syncResult.data?.id,
        title,
        subject,
        poster_url,
        category,
        synced: true
      }
    }
  } catch (error) {
    console.error('Create bulletin error:', error)
    return {
      success: false,
      message: error.message || 'Failed to post bulletin'
    }
  }
}

// Delete bulletin from portal
// Endpoint: DELETE /api/sync/bulletin
export async function deleteBulletin(sourceId) {
  const prisma = getPrisma()
  const { baseUrl, apiKey } = getPortalConfig()

  try {
    // Delete from portal if configured
    if (baseUrl && apiKey) {
      const response = await fetch(`${baseUrl}/bulletin`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ sourceId })
      })

      if (!response.ok) {
        console.error('Failed to delete from portal:', await response.text())
      }

      // Also delete poster
      await fetch(`${baseUrl}/poster`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ sourceId })
      })
    }

    // Delete local record
    await prisma.bulletinApiLog.delete({ where: { id: sourceId } })

    return { success: true, message: 'Bulletin deleted successfully' }
  } catch (error) {
    console.error('Delete bulletin error:', error)
    return { success: false, message: error.message }
  }
}

export async function getBulletinHistory(userId, limit = 50) {
  const prisma = getPrisma()

  try {
    const logs = await prisma.bulletinApiLog.findMany({
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

    return { success: true, logs }
  } catch (error) {
    console.error('Get bulletin history error:', error)
    return { success: false, error: error.message, logs: [] }
  }
}

// Categories matching the portal
export const BULLETIN_CATEGORIES = [
  { value: 'CHIEFNCOUNCIL', label: 'Chief & Council' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'PROGRAM_EVENTS', label: 'Programs & Events' },
  { value: 'ANNOUNCEMENTS', label: 'Announcements' }
]
