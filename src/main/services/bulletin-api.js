// Bulletin Service for TCN Communications
// All bulletin data stored on VPS for centralized access
// Poster uploads go to VPS storage

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { apiRequest, getPortalConfig } from './api-helpers.js'

// Helper to create multipart form data manually
function createMultipartFormData(fields, file) {
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2)
  const parts = []
  
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    )
  }
  
  if (file) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`
    )
  }
  
  const header = Buffer.from(parts.join(''), 'utf8')
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const body = Buffer.concat([header, file.data, footer])
  
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

/**
 * Upload poster image to VPS
 */
export async function uploadPoster({ sourceId, filename, data, mimeType }) {
  const { baseUrl, apiKey } = getPortalConfig()
  
  try {
    if (!baseUrl || !apiKey) {
      // Fallback: save locally if portal not configured
      const uploadsDir = join(app.getPath('userData'), 'uploads', 'posters')
      await mkdir(uploadsDir, { recursive: true })
      
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      
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

    const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    const ext = filename.split('.').pop() || 'jpg'
    const uploadFilename = `${sourceId}.${ext}`
    
    const { body, contentType } = createMultipartFormData(
      { sourceId, filename },
      { filename: uploadFilename, contentType: mimeType || 'image/jpeg', data: buffer }
    )

    const response = await fetch(`${baseUrl}/api/comm/bulletin/poster`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'x-source': 'tcn-comm',
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

/**
 * Create bulletin on VPS
 * Supports poster image OR text content
 */
export async function createBulletin({ title, subject, category, posterFile, content, userId }) {
  const hasPoster = posterFile && posterFile.data
  const hasText = content && content.trim()

  if (!hasPoster && !hasText) {
    return { success: false, message: 'Either a poster image or text content is required' }
  }

  try {
    // For text-only bulletins - simple create
    if (hasText && !hasPoster) {
      const createResult = await apiRequest('/api/comm/bulletin', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subject,
          category: category || 'ANNOUNCEMENTS',
          userId,
          content: content.trim()
        })
      })

      if (!createResult.success) {
        return { success: false, message: createResult.error || 'Failed to create bulletin' }
      }

      return {
        success: true,
        message: 'Bulletin posted successfully',
        bulletin: {
          id: createResult.data.id,
          title,
          subject,
          content: content.trim(),
          category,
          synced: true
        }
      }
    }

    // For poster bulletins - create, upload, update
    const createResult = await apiRequest('/api/comm/bulletin', {
      method: 'POST',
      body: JSON.stringify({
        title,
        subject,
        category: category || 'ANNOUNCEMENTS',
        userId,
        poster_url: '' // Will update after upload
      })
    })

    if (!createResult.success) {
      return { success: false, message: createResult.error || 'Failed to create bulletin' }
    }

    console.log('Create bulletin result:', JSON.stringify(createResult, null, 2))
    
    const bulletinId = createResult.data?.id || createResult.id
    console.log('Bulletin ID for upload:', bulletinId)

    if (!bulletinId) {
      return { success: false, message: 'Bulletin created but no ID returned - check VPS response format' }
    }

    // Upload poster
    const uploadResult = await uploadPoster({
      sourceId: bulletinId,
      filename: posterFile.filename,
      data: posterFile.data,
      mimeType: posterFile.mimeType
    })

    console.log('Upload result:', JSON.stringify(uploadResult, null, 2))

    if (!uploadResult.success) {
      // Clean up bulletin on failure
      await apiRequest(`/api/comm/bulletin/${bulletinId}`, { method: 'DELETE' })
      return { success: false, message: `Failed to upload poster: ${uploadResult.message}` }
    }

    // Update bulletin with poster URL
    console.log('Updating bulletin', bulletinId, 'with poster_url:', uploadResult.poster_url)
    
    const updateResult = await apiRequest(`/api/comm/bulletin/${bulletinId}`, {
      method: 'PUT',
      body: JSON.stringify({ poster_url: uploadResult.poster_url })
    })

    console.log('Update result:', JSON.stringify(updateResult, null, 2))

    if (!updateResult.success) {
      return {
        success: false,
        message: 'Poster uploaded but failed to update bulletin',
        bulletin: { id: bulletinId, title, subject, poster_url: uploadResult.poster_url, synced: false }
      }
    }

    return {
      success: true,
      message: 'Bulletin posted successfully',
      bulletin: {
        id: bulletinId,
        title,
        subject,
        poster_url: uploadResult.poster_url,
        category,
        synced: true
      }
    }
  } catch (error) {
    console.error('Create bulletin error:', error)
    return { success: false, message: error.message || 'Failed to post bulletin' }
  }
}

/**
 * Update bulletin on VPS
 */
export async function updateBulletin({ bulletinId, title, subject, category, posterFile }) {
  try {
    const updateData = {}
    if (title) updateData.title = title
    if (subject) updateData.subject = subject
    if (category) updateData.category = category

    // If new poster provided, upload it
    if (posterFile?.data) {
      const uploadResult = await uploadPoster({
        sourceId: bulletinId,
        filename: posterFile.filename,
        data: posterFile.data,
        mimeType: posterFile.mimeType
      })

      if (!uploadResult.success) {
        return { success: false, message: `Failed to upload poster: ${uploadResult.message}` }
      }

      updateData.poster_url = uploadResult.poster_url
    }

    const result = await apiRequest(`/api/comm/bulletin/${bulletinId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to update bulletin' }
    }

    return { success: true, bulletin: result.data }
  } catch (error) {
    console.error('Update bulletin error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Delete bulletin from VPS
 */
export async function deleteBulletin(bulletinId) {
  try {
    const result = await apiRequest(`/api/comm/bulletin/${bulletinId}`, {
      method: 'DELETE'
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to delete bulletin' }
    }

    return { success: true, message: 'Bulletin deleted successfully' }
  } catch (error) {
    console.error('Delete bulletin error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Get bulletin by ID
 */
export async function getBulletinById(bulletinId) {
  try {
    const result = await apiRequest(`/api/comm/bulletin/${bulletinId}`)

    if (!result.success) {
      return { success: false, error: result.error || 'Bulletin not found' }
    }

    return { success: true, bulletin: result.data }
  } catch (error) {
    console.error('Get bulletin error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get bulletin history from VPS
 */
export async function getBulletinHistory(userId, limit = 50) {
  try {
    const endpoint = userId 
      ? `/api/comm/bulletin?userId=${userId}&limit=${limit}`
      : `/api/comm/bulletin?limit=${limit}`
    
    const result = await apiRequest(endpoint)

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch bulletins', logs: [] }
    }

    return { success: true, logs: result.data }
  } catch (error) {
    console.error('Get bulletin history error:', error)
    return { success: false, error: error.message, logs: [] }
  }
}

/**
 * Get bulletin stats for dashboard
 */
export async function getBulletinStats(userId) {
  try {
    const endpoint = userId 
      ? `/api/comm/bulletin/stats?userId=${userId}`
      : `/api/comm/bulletin/stats`
    
    const result = await apiRequest(endpoint)

    if (!result.success) {
      return { total: 0, thisMonth: 0 }
    }

    return result.data
  } catch (error) {
    return { total: 0, thisMonth: 0 }
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
