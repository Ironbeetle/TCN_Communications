import { getPrisma } from './database.js'

// Sign-Up Forms Service
// API Reference: See REFERENCE/Signup_Forms/SIGNUP_FORMS_API.md

const getPortalConfig = () => {
  // Prefer the canonical PORTAL_API_URL, fallback to TCN_PORTAL_URL
  // Normalize out any trailing `/api/sync` so endpoints are built consistently
  const rawUrl = process.env.PORTAL_API_URL || process.env.TCN_PORTAL_URL
  const baseUrl = rawUrl ? rawUrl.replace(/\/api\/sync\/?$/i, '') : rawUrl
  const apiKey = process.env.PORTAL_API_KEY || process.env.TCN_PORTAL_API_KEY
  
  // Debug logging for portal config
  console.log('=== Portal Config ===')
  console.log('Raw URL:', rawUrl)
  console.log('Base URL (after normalization):', baseUrl)
  console.log('API Key set:', apiKey ? 'Yes' : 'No')
  
  return { baseUrl, apiKey }
}

// Sync form to portal
async function syncFormToPortal(form) {
  const { baseUrl, apiKey } = getPortalConfig()
  
  if (!baseUrl || !apiKey) {
    console.error('Portal not configured. baseUrl:', baseUrl, 'apiKey:', apiKey ? '[SET]' : '[NOT SET]')
    return { success: false, error: 'Portal not configured' }
  }

  try {
    // POST to create, PUT to update (per API docs at ELECTRON_MIGRATION_REFERENCE.md)
    const endpoint = form.portalFormId 
      ? `${baseUrl}/api/signup-forms/${form.portalFormId}`
      : `${baseUrl}/api/signup-forms`
    
    const method = form.portalFormId ? 'PUT' : 'POST'

    console.log(`Syncing form to portal: ${method} ${endpoint}`)

    const payload = {
      formId: form.id,
      title: form.title,
      description: form.description,
      deadline: form.deadline ? form.deadline.toISOString() : null,
      maxEntries: form.maxEntries,
      isActive: form.isActive,
      category: form.category || 'BAND_OFFICE',
      allowResubmit: form.allowResubmit || false,
      resubmitMessage: form.resubmitMessage || null,
      createdBy: form.createdBy,
      fields: form.fields.map(f => ({
        fieldId: f.fieldId,
        label: f.label,
        fieldType: f.fieldType,
        options: f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : null,
        placeholder: f.placeholder,
        required: f.required,
        order: f.order
      }))
    }

    // Omit `category` when sending to portal to avoid enum mismatches on the portal side
    // Portal enforces its own FormCategory enum and remote values may differ from local app
    if (payload.category) {
      console.log('Removing category from payload before sending to portal to avoid enum validation')
      delete payload.category
    }

    console.log('Syncing form to portal: payload:', JSON.stringify(payload, null, 2))

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-source': 'tcn-comm'
      },
      body: JSON.stringify(payload)
    })

    // Read response text for full logging and robust parsing
    const respText = await response.text()
    console.log('Portal sync response status:', response.status)
    console.log('Portal sync response text:', respText)

    if (!response.ok) {
      throw new Error(`Portal sync failed: ${response.status} - ${respText}`)
    }

    let result
    try {
      result = JSON.parse(respText)
    } catch (e) {
      result = { data: null, raw: respText }
    }

    return { 
      success: true, 
      portalFormId: result.data?.id || result.portalFormId,
      data: result.data || result
    }
  } catch (error) {
    console.error('Portal sync error:', error)
    return { success: false, error: error.message }
  }
}

// Delete form from portal
async function deleteFormFromPortal(portalFormId) {
  const { baseUrl, apiKey } = getPortalConfig()
  
  if (!baseUrl || !apiKey || !portalFormId) {
    return { success: false }
  }

  try {
    const response = await fetch(`${baseUrl}/api/signup-forms/${portalFormId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey,
        'x-source': 'tcn-comm'
      }
    })
    return { success: response.ok }
  } catch (error) {
    console.error('Portal delete error:', error)
    return { success: false, error: error.message }
  }
}

export async function createForm({ title, description, category, deadline, maxEntries, allowResubmit, resubmitMessage, fields, userId }) {
  const prisma = getPrisma()

  try {
    // Create local form
    const form = await prisma.signUpForm.create({
      data: {
        title,
        description: description || null,
        category: category || 'BAND_OFFICE',
        deadline: deadline ? new Date(deadline) : null,
        maxEntries: maxEntries || null,
        isActive: true,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        createdBy: userId,
        fields: {
          create: fields.map((field, index) => ({
            fieldId: field.fieldId || generateFieldId(field.label),
            label: field.label,
            fieldType: field.fieldType,
            options: field.options ? JSON.stringify(field.options) : null,
            placeholder: field.placeholder || null,
            required: field.required || false,
            order: index
          }))
        }
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      }
    })

    // Sync to portal
    const syncResult = await syncFormToPortal(form)
    
    // Update with portal form ID if sync succeeded
    if (syncResult.success && syncResult.portalFormId) {
      await prisma.signUpForm.update({
        where: { id: form.id },
        data: { 
          portalFormId: syncResult.portalFormId,
          syncedAt: new Date()
        }
      })
    }

    return { 
      success: true, 
      form,
      portalSynced: syncResult.success,
      portalFormId: syncResult.portalFormId,
      portalError: syncResult.error
    }
  } catch (error) {
    console.error('Create form error:', error)
    return { success: false, message: error.message }
  }
}

// Generate semantic fieldId from label
function generateFieldId(label) {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export async function updateForm({ formId, title, description, category, deadline, maxEntries, isActive, allowResubmit, resubmitMessage, fields }) {
  const prisma = getPrisma()

  try {
    // Delete existing fields and recreate
    await prisma.formField.deleteMany({
      where: { formId }
    })

    const form = await prisma.signUpForm.update({
      where: { id: formId },
      data: {
        title,
        description: description || null,
        category: category || 'BAND_OFFICE',
        deadline: deadline ? new Date(deadline) : null,
        maxEntries: maxEntries || null,
        isActive,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        fields: {
          create: fields.map((field, index) => ({
            fieldId: field.fieldId || generateFieldId(field.label),
            label: field.label,
            fieldType: field.fieldType,
            options: field.options ? JSON.stringify(field.options) : null,
            placeholder: field.placeholder || null,
            required: field.required || false,
            order: index
          }))
        }
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      }
    })

    // Sync to portal
    const syncResult = await syncFormToPortal(form)
    
    if (syncResult.success) {
      await prisma.signUpForm.update({
        where: { id: form.id },
        data: { syncedAt: new Date() }
      })
    }

    return { 
      success: true, 
      form,
      portalSynced: syncResult.success,
      portalError: syncResult.error
    }
  } catch (error) {
    console.error('Update form error:', error)
    return { success: false, message: error.message }
  }
}

export async function deleteForm(formId) {
  const prisma = getPrisma()

  try {
    // Get form to check for portal ID
    const form = await prisma.signUpForm.findUnique({
      where: { id: formId },
      select: { portalFormId: true }
    })

    // Delete from portal if synced
    if (form?.portalFormId) {
      await deleteFormFromPortal(form.portalFormId)
    }

    // Delete local form (cascades to fields and submissions)
    await prisma.signUpForm.delete({
      where: { id: formId }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete form error:', error)
    return { success: false, message: error.message }
  }
}

export async function getForm(formId) {
  const prisma = getPrisma()

  try {
    const form = await prisma.signUpForm.findUnique({
      where: { id: formId },
      include: {
        fields: { orderBy: { order: 'asc' } },
        submissions: { orderBy: { submittedAt: 'desc' } },
        creator: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    if (!form) {
      return { success: false, message: 'Form not found' }
    }

    // Parse options JSON for fields
    const formWithParsedFields = {
      ...form,
      fields: form.fields.map(f => ({
        ...f,
        options: f.options ? JSON.parse(f.options) : null
      }))
    }

    return { success: true, form: formWithParsedFields }
  } catch (error) {
    console.error('Get form error:', error)
    return { success: false, message: error.message }
  }
}

export async function getAllForms(userId = null) {
  const prisma = getPrisma()

  try {
    const forms = await prisma.signUpForm.findMany({
      where: userId ? { createdBy: userId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        fields: { orderBy: { order: 'asc' } },
        _count: { select: { submissions: true } },
        creator: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    })

    return { success: true, forms }
  } catch (error) {
    console.error('Get all forms error:', error)
    return { success: false, message: error.message, forms: [] }
  }
}

export async function submitForm({ formId, memberId, name, email, phone, responses }) {
  const prisma = getPrisma()

  try {
    // Check if form is active
    const form = await prisma.signUpForm.findUnique({
      where: { id: formId },
      include: { _count: { select: { submissions: true } } }
    })

    if (!form) {
      return { success: false, message: 'Form not found' }
    }

    if (!form.isActive) {
      return { success: false, message: 'Form is no longer accepting submissions' }
    }

    if (form.deadline && new Date() > form.deadline) {
      return { success: false, message: 'Submission deadline has passed' }
    }

    if (form.maxEntries && form._count.submissions >= form.maxEntries) {
      return { success: false, message: 'Maximum entries reached' }
    }

    const submission = await prisma.formSubmission.create({
      data: {
        formId,
        memberId: memberId || null,
        name,
        email: email || null,
        phone: phone || null,
        responses: JSON.stringify(responses)
      }
    })

    return { success: true, submission }
  } catch (error) {
    console.error('Submit form error:', error)
    return { success: false, message: error.message }
  }
}

export async function getFormSubmissions(formId) {
  const prisma = getPrisma()

  try {
    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' }
    })

    // Parse responses JSON
    const parsed = submissions.map(s => ({
      ...s,
      responses: typeof s.responses === 'string' ? JSON.parse(s.responses) : s.responses
    }))

    return { success: true, submissions: parsed }
  } catch (error) {
    console.error('Get submissions error:', error)
    return { success: false, message: error.message, submissions: [] }
  }
}

export async function deleteSubmission(submissionId) {
  const prisma = getPrisma()

  try {
    await prisma.formSubmission.delete({
      where: { id: submissionId }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete submission error:', error)
    return { success: false, message: error.message }
  }
}

// Sync submissions from portal
export async function syncSubmissions(formId) {
  const prisma = getPrisma()
  const { baseUrl, apiKey } = getPortalConfig()

  console.log('=== syncSubmissions called ===')
  console.log('formId:', formId)
  console.log('baseUrl:', baseUrl)
  console.log('apiKey:', apiKey ? '[SET]' : '[NOT SET]')

  if (!baseUrl || !apiKey) {
    return { success: false, error: 'Portal not configured' }
  }

  try {
    // Get form with portal ID
    const form = await prisma.signUpForm.findUnique({
      where: { id: formId },
      select: { id: true, portalFormId: true, syncedAt: true }
    })

    console.log('Local form found:', form)

    if (!form) {
      return { success: false, error: 'Form not found' }
    }

    if (!form.portalFormId) {
      return { success: false, error: 'Form not synced to portal' }
    }

    // Fetch submissions from portal
    // Portal stores submissions by LOCAL form ID (sent during form sync)
    const url = `${baseUrl}/api/signup-forms/submissions?formId=${form.id}`
    console.log('Fetching submissions from:', url)

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'x-source': 'tcn-comm'
      }
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Portal fetch error:', errorText)
      throw new Error(`Portal fetch failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Portal response:', JSON.stringify(result, null, 2))
    
    // Safely extract submissions array from various response formats
    // API returns: { success: true, data: { submissions: [...] } }
    const portalSubmissions = Array.isArray(result) 
      ? result 
      : Array.isArray(result?.data?.submissions)
        ? result.data.submissions
        : Array.isArray(result?.submissions) 
          ? result.submissions 
          : Array.isArray(result?.data) 
            ? result.data 
            : []
    console.log('Submissions to process:', portalSubmissions.length)

    let synced = 0
    let skipped = 0

    for (const sub of portalSubmissions) {
      // Check if submission already exists (by checking responses match)
      const existing = await prisma.formSubmission.findFirst({
        where: {
          formId,
          name: sub.submitter?.name || sub.name,
          submittedAt: new Date(sub.submittedAt)
        }
      })

      if (existing) {
        skipped++
        continue
      }

      // Create new submission
      await prisma.formSubmission.create({
        data: {
          formId,
          memberId: sub.submitter?.memberId || sub.memberId || null,
          name: sub.submitter?.name || sub.name,
          email: sub.submitter?.email || sub.email || null,
          phone: sub.submitter?.phone || sub.phone || null,
          responses: JSON.stringify(sub.responses),
          submittedAt: new Date(sub.submittedAt)
        }
      })
      synced++
    }

    // Update sync timestamp
    await prisma.signUpForm.update({
      where: { id: formId },
      data: { syncedAt: new Date() }
    })

    return {
      success: true,
      synced,
      skipped,
      total: portalSubmissions.length,
      message: `Synced ${synced} submissions, skipped ${skipped} duplicates`
    }
  } catch (error) {
    console.error('Sync submissions error:', error)
    return { success: false, error: error.message }
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
