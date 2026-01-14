import { getPrisma } from './database.js'

// TCN Portal API Client for member contacts
// Note: You'll need to set PORTAL_API_URL and PORTAL_API_KEY in .env

async function portalFetch(endpoint, options = {}) {
  const baseUrl = process.env.PORTAL_API_URL
  const apiKey = process.env.PORTAL_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('Portal API not configured')
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Source': 'tcn-comm',
      ...options.headers
    }
  })

  if (!response.ok) {
    throw new Error(`Portal API error: ${response.status}`)
  }

  return response.json()
}

export async function searchMembers(searchTerm, limit = 50) {
  try {
    const params = new URLSearchParams({
      query: searchTerm,
      limit: limit.toString(),
      activated: 'true',
      fields: 'both'
    })

    const data = await portalFetch(`/contacts?${params}`)

    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts.map(contact => ({
          id: contact.memberId,
          memberId: contact.memberId,
          t_number: contact.t_number,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          community: contact.community,
          status: contact.status
        })),
        count: data.data.count,
        hasMore: data.data.pagination?.hasMore || false
      }
    }

    return { success: true, members: [], count: 0 }
  } catch (error) {
    console.error('Search members error:', error)
    return { success: false, error: error.message, members: [] }
  }
}

export async function getAllPhoneNumbers(limit = 1000) {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      activated: 'true',
      fields: 'phone'
    })

    const data = await portalFetch(`/contacts?${params}`)

    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts
          .filter(c => c.phone)
          .map(contact => ({
            id: contact.memberId,
            name: contact.name || `${contact.firstName} ${contact.lastName}`,
            phone: contact.phone
          }))
      }
    }

    return { success: true, members: [] }
  } catch (error) {
    return { success: false, error: error.message, members: [] }
  }
}

export async function getAllEmails(limit = 1000) {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      activated: 'true',
      fields: 'email'
    })

    const data = await portalFetch(`/contacts?${params}`)

    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts
          .filter(c => c.email)
          .map(contact => ({
            id: contact.memberId,
            name: contact.name || `${contact.firstName} ${contact.lastName}`,
            email: contact.email
          }))
      }
    }

    return { success: true, members: [] }
  } catch (error) {
    return { success: false, error: error.message, members: [] }
  }
}

export async function testConnection() {
  try {
    await portalFetch('/health')
    return { success: true, message: 'Portal API connected' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
