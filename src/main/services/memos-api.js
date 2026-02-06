// Office Memos Service for TCN Communications
// All memo data stored on VPS for centralized access

import { apiRequest, extractArray } from './api-helpers.js'

/**
 * Get all memos (optionally filter by department)
 */
export async function getAllMemos(department = null) {
  try {
    const endpoint = department 
      ? `/api/memos?department=${encodeURIComponent(department)}`
      : '/api/memos'
    
    const result = await apiRequest(endpoint)

    if (!result.success) {
      console.error('Failed to fetch memos:', result.error)
      return []
    }

    // Handle various response formats
    return extractArray(result, 'data', 'memos')
  } catch (error) {
    console.error('Get all memos error:', error)
    return []
  }
}

/**
 * Get a specific memo by ID
 */
export async function getMemoById(memoId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true, memo: result.data || result.memo }
  } catch (error) {
    console.error('Get memo error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create a new memo
 */
export async function createMemo({ title, content, priority, department, isPinned, authorId }) {
  try {
    const result = await apiRequest('/api/memos', {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        priority: priority || 'low',
        department: department || null,
        isPinned: isPinned || false,
        authorId,
        isPublished: true
      })
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create memo' }
    }

    return { success: true, memo: result.data || result.memo }
  } catch (error) {
    console.error('Create memo error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update an existing memo
 */
export async function updateMemo(memoId, updates) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update memo' }
    }

    return { success: true, memo: result.data || result.memo }
  } catch (error) {
    console.error('Update memo error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a memo
 */
export async function deleteMemo(memoId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`, {
      method: 'DELETE'
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete memo' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete memo error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark a memo as read by a user
 */
export async function markMemoAsRead(memoId, userId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}/read`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to mark memo as read' }
    }

    return { success: true }
  } catch (error) {
    console.error('Mark memo as read error:', error)
    return { success: false, error: error.message }
  }
}
