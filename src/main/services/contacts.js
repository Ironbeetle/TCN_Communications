// TCN Portal API Client for member contacts

import { apiRequest } from './api-helpers.js'

export async function searchMembers(searchTerm, limit = 50) {
  try {
    const params = new URLSearchParams({
      query: searchTerm,
      limit: limit.toString(),
      activated: 'true',
      fields: 'both'
    })

    const result = await apiRequest(`/api/sync/contacts?${params}`)

    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts.map(contact => ({
          id: contact.memberId,
          memberId: contact.memberId,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          community: contact.community,
          address: contact.address,
          status: contact.status
        })),
        count: result.data.count,
        hasMore: result.data.pagination?.hasMore || false
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

    const result = await apiRequest(`/api/sync/contacts?${params}`)

    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts
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

    const result = await apiRequest(`/api/sync/contacts?${params}`)

    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts
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
    const result = await apiRequest('/api/sync/health')
    if (result.success) {
      return { success: true, message: 'Portal API connected' }
    }
    return { success: false, error: result.error || 'Connection failed' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
