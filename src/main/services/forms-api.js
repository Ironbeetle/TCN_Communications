// Sign-Up Forms Service for TCN Communications
// All form data stored on VPS for centralized access

import { apiRequest, extractArray } from './api-helpers.js'

/**
 * Create a new sign-up form on VPS
 */
export async function createForm({ title, description, category, deadline, maxEntries, allowResubmit, resubmitMessage, fields, userId }) {
  try {
    const result = await apiRequest('/api/comm/signup-forms', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || 'BAND_OFFICE',
        deadline: deadline ? new Date(deadline).toISOString() : null,
        maxEntries: maxEntries || null,
        isActive: true,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        createdBy: userId,
        fields: fields.map((field, index) => ({
          fieldId: field.fieldId || generateFieldId(field.label),
          label: field.label,
          fieldType: field.fieldType,
          options: field.options || null,
          placeholder: field.placeholder || null,
          required: field.required || false,
          order: index
        }))
      })
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to create form' }
    }

    return { success: true, form: result.data }
  } catch (error) {
    console.error('Create form error:', error)
    return { success: false, message: error.message }
  }
}

// Generate semantic fieldId from label
function generateFieldId(label) {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/**
 * Update a sign-up form on VPS
 */
export async function updateForm({ formId, title, description, category, deadline, maxEntries, isActive, allowResubmit, resubmitMessage, fields }) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || 'BAND_OFFICE',
        deadline: deadline ? new Date(deadline).toISOString() : null,
        maxEntries: maxEntries || null,
        isActive,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        fields: fields.map((field, index) => ({
          fieldId: field.fieldId || generateFieldId(field.label),
          label: field.label,
          fieldType: field.fieldType,
          options: field.options || null,
          placeholder: field.placeholder || null,
          required: field.required || false,
          order: index
        }))
      })
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to update form' }
    }

    return { success: true, form: result.data }
  } catch (error) {
    console.error('Update form error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Delete a sign-up form from VPS
 */
export async function deleteForm(formId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`, {
      method: 'DELETE'
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to delete form' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete form error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Get a single form by ID
 */
export async function getForm(formId) {
  try {
    console.log('[Forms API] Getting form:', formId)
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`)
    console.log('[Forms API] Get form result:', JSON.stringify(result).substring(0, 500))

    if (!result.success) {
      return { success: false, message: result.error || 'Form not found' }
    }

    // Handle various response formats
    const form = result.data?.form || result.data || result.form
    console.log('[Forms API] Parsed form:', form?.id, form?.title)
    
    return { success: true, form }
  } catch (error) {
    console.error('Get form error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Get all forms (optionally filter by user)
 */
export async function getAllForms(userId = null) {
  try {
    const endpoint = userId 
      ? `/api/comm/signup-forms?userId=${userId}`
      : '/api/comm/signup-forms'
    
    const result = await apiRequest(endpoint)
    console.log('Forms API result:', JSON.stringify(result, null, 2))

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to fetch forms', forms: [] }
    }

    // Handle various response formats
    const forms = Array.isArray(result.data) ? result.data :
                  Array.isArray(result.forms) ? result.forms :
                  result.data?.forms ? result.data.forms : []

    return { success: true, forms }
  } catch (error) {
    console.error('Get all forms error:', error)
    return { success: false, message: error.message, forms: [] }
  }
}

/**
 * Submit a form response
 * Note: This is typically done by members via the portal, but desktop can also submit
 */
export async function submitForm({ formId, memberId, name, email, phone, responses }) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({
        memberId: memberId || null,
        name,
        email: email || null,
        phone: phone || null,
        responses
      })
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to submit form' }
    }

    return { success: true, submission: result.data }
  } catch (error) {
    console.error('Submit form error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Get form submissions
 */
export async function getFormSubmissions(formId) {
  try {
    console.log('[Forms API] Getting submissions for form:', formId)
    const result = await apiRequest(`/api/comm/signup-forms/${formId}/submissions`)
    console.log('[Forms API] Submissions result:', JSON.stringify(result).substring(0, 500))

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to fetch submissions', submissions: [] }
    }

    // Handle various response formats from VPS
    let submissions = []
    if (Array.isArray(result.data)) {
      submissions = result.data
    } else if (Array.isArray(result.data?.submissions)) {
      submissions = result.data.submissions
    } else if (Array.isArray(result.submissions)) {
      submissions = result.submissions
    }
    
    console.log('[Forms API] Parsed submissions count:', submissions.length)
    return { success: true, submissions }
  } catch (error) {
    console.error('Get submissions error:', error)
    return { success: false, message: error.message, submissions: [] }
  }
}

/**
 * Delete a submission
 */
export async function deleteSubmission(submissionId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/submissions/${submissionId}`, {
      method: 'DELETE'
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to delete submission' }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete submission error:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Sync submissions - VPS is now the source of truth, so this just refreshes
 * In VPS-centric model, this is mainly for cache refresh if needed
 */
export async function syncSubmissions(formId) {
  // In VPS-centric model, data is already on VPS
  // This function can be used to verify sync status
  try {
    const result = await getFormSubmissions(formId)
    
    return {
      success: true,
      synced: result.submissions?.length || 0,
      skipped: 0,
      total: result.submissions?.length || 0,
      message: `Form has ${result.submissions?.length || 0} submissions on VPS`
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get form stats for dashboard
 */
export async function getFormStats(userId) {
  try {
    const endpoint = userId 
      ? `/api/comm/signup-forms/stats?userId=${userId}`
      : '/api/comm/signup-forms/stats'
    
    const result = await apiRequest(endpoint)

    if (!result.success) {
      return { totalForms: 0, totalSubmissions: 0, activeForms: 0 }
    }

    return result.data
  } catch (error) {
    return { totalForms: 0, totalSubmissions: 0, activeForms: 0 }
  }
}

// Field types
export const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text Input' },
  { value: 'TEXTAREA', label: 'Long Text' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone Number' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown' },
  { value: 'MULTISELECT', label: 'Multi-Select' },
  { value: 'CHECKBOX', label: 'Checkbox' }
]

// Semantic field IDs for auto-fill
export const SEMANTIC_FIELDS = [
  { id: 'full_name', label: 'Full Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'address', label: 'Address' },
  { id: 'date_of_birth', label: 'Date of Birth' }
]

// Form categories
export const FORM_CATEGORIES = [
  { value: 'BAND_OFFICE', label: 'Band Office' },
  { value: 'J_W_HEALTH_CENTER', label: 'J.W. Health Center' },
  { value: 'CSCMEC', label: 'CSCMEC' },
  { value: 'COUNCIL', label: 'Council' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'TRSC', label: 'TRSC' }
]
