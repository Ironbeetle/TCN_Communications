// TCN Portal API Client for member contacts

import { apiRequest } from './api-helpers.js'

export async function searchMembers(searchTerm, options = {}) {
  try {
    // Support both old signature (searchTerm, limit) and new signature (searchTerm, options)
    const opts = typeof options === 'number' 
      ? { limit: options } 
      : options
    
    const {
      limit = 25,
      page = 1,
      sortBy = 'name',
      sortOrder = 'asc',
      community = ''
    } = opts

    const params = new URLSearchParams({
      query: searchTerm || '',
      limit: limit.toString(),
      page: page.toString(),
      sortBy,
      sortOrder,
      activated: 'true',
      fields: 'both'
    })
    
    if (community) {
      params.append('community', community)
    }

    const result = await apiRequest(`/api/sync/contacts?${params}`)

    if (result.success && result.data?.contacts) {
      const contacts = result.data.contacts.map(contact => ({
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
      }))
      
      // Client-side sorting if server doesn't support it
      const sortedContacts = sortContacts(contacts, sortBy, sortOrder)
      
      return {
        success: true,
        members: sortedContacts,
        count: result.data.count || contacts.length,
        totalCount: result.data.totalCount || result.data.count || contacts.length,
        page: result.data.pagination?.page || page,
        totalPages: result.data.pagination?.totalPages || Math.ceil((result.data.totalCount || contacts.length) / limit),
        hasMore: result.data.pagination?.hasMore || false,
        communities: result.data.communities || []
      }
    }

    return { success: true, members: [], count: 0, totalCount: 0, page: 1, totalPages: 1, hasMore: false }
  } catch (error) {
    console.error('Search members error:', error)
    return { success: false, error: error.message, members: [], count: 0, totalCount: 0 }
  }
}

// Client-side sorting helper
function sortContacts(contacts, sortBy, sortOrder) {
  return [...contacts].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '')
        break
      case 'firstName':
        comparison = (a.firstName || '').localeCompare(b.firstName || '')
        break
      case 'lastName':
        comparison = (a.lastName || '').localeCompare(b.lastName || '')
        break
      case 'community':
        comparison = (a.community || '').localeCompare(b.community || '')
        break
      default:
        comparison = (a.name || '').localeCompare(b.name || '')
    }
    
    return sortOrder === 'desc' ? -comparison : comparison
  })
}

// Get all available communities for filter dropdown
export async function getCommunities() {
  try {
    const result = await apiRequest('/api/sync/contacts/communities')
    
    if (result.success && result.data?.communities) {
      return { success: true, communities: result.data.communities }
    }
    
    // Fallback: fetch contacts and extract unique communities
    const contactsResult = await searchMembers('', { limit: 500 })
    if (contactsResult.success) {
      const communities = [...new Set(contactsResult.members.map(m => m.community).filter(Boolean))].sort()
      return { success: true, communities }
    }
    
    return { success: true, communities: [] }
  } catch (error) {
    console.error('Get communities error:', error)
    return { success: false, communities: [] }
  }
}

export async function getAllPhoneNumbers(limit = 500) {
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

export async function getAllEmails(limit = 500) {
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

/**
 * TEMPORARY FUNCTION - Get members with Profile but no fnauth entry
 * 
 * Uses existing contacts endpoint and filters CLIENT-SIDE.
 * Members who still have fnauth entries (can log in) are excluded.
 * 
 * HOW TO USE:
 * 1. Find the 7 member IDs that still have fnauth (those who can log in)
 * 2. Add their member IDs to the MEMBERS_WITH_FNAUTH array below
 * 3. The function will exclude them and return the ~82 affected members
 * 
 * Alternative: If you have the list of affected emails directly from a DB query,
 * replace the filtering logic with a hardcoded email list.
 */

// TODO: Add the 7 member IDs that still have fnauth entries
// Get these by querying: SELECT fnmember_id FROM fnmemberlist.fnauth
const MEMBERS_WITH_FNAUTH = [
  'cmkujg7nr0032xw2ex8durs6b',
  'cmkujg7ji001axw2e88u3ytrj',
  'cmkujg8p100jlxw2eeigk8p0w',
  'cmkujgcaw02f8xw2exkvr8c4c',
  'cmkujg7wi006uxw2eb0gkj8lh',
  'cmkujga0e01aaxw2ecri575us',
  'cmkujg7gr000gxw2ez92xh4sk',
]

export async function getAffectedMembers() {
  try {
    // Use existing endpoint to get all contacts with email
    const params = new URLSearchParams({
      limit: '500',
      activated: 'true',
      fields: 'email'
    })

    const result = await apiRequest(`/api/sync/contacts?${params}`)

    if (result.success && result.data?.contacts) {
      // Filter out members who have fnauth entries
      const affectedMembers = result.data.contacts
        .filter(c => c.email) // Must have email
        .filter(c => !MEMBERS_WITH_FNAUTH.includes(c.memberId)) // Exclude those with fnauth
        .map(contact => ({
          id: contact.memberId,
          memberId: contact.memberId,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          community: contact.community
        }))

      return {
        success: true,
        members: affectedMembers,
        count: affectedMembers.length,
        totalProfiles: result.data.contacts.filter(c => c.email).length,
        excludedCount: MEMBERS_WITH_FNAUTH.length,
        message: MEMBERS_WITH_FNAUTH.length > 0
          ? `Found ${affectedMembers.length} affected members (excluded ${MEMBERS_WITH_FNAUTH.length} with fnauth)`
          : `Found ${affectedMembers.length} members. NOTE: Add fnauth member IDs to MEMBERS_WITH_FNAUTH array to filter properly.`
      }
    }

    return { 
      success: false, 
      error: result.error || 'Failed to fetch contacts', 
      members: [] 
    }
  } catch (error) {
    console.error('Get affected members error:', error)
    return { success: false, error: error.message, members: [] }
  }
}
