// Authentication Service for TCN Communications
// Communicates with VPS API for all user/auth operations
// Users are stored centrally on VPS for multi-location access

import Store from 'electron-store'
import { apiRequest } from './api-helpers.js'

// Initialize local session store (only stores current session, not user data)
let store
try {
  const StoreClass = Store.default || Store
  store = new StoreClass({
    encryptionKey: 'tcn-communications-secret-key',
    name: 'tcn-session'
  })
} catch (e) {
  console.error('Failed to initialize electron-store:', e)
  const memoryStore = {}
  store = {
    get: (key) => memoryStore[key],
    set: (key, value) => { memoryStore[key] = value },
    delete: (key) => { delete memoryStore[key] }
  }
}

/**
 * Login user via VPS API
 * VPS handles password verification, lockout logic, and login logging
 */
export async function login(email, password) {
  try {
    console.log('Attempting login for:', email)
    
    const result = await apiRequest('/api/comm/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase(),
        password
      })
    })
    
    if (!result.success) {
      return { success: false, error: result.error || 'Invalid email or password' }
    }
    
    // Store session locally for quick access
    const sessionData = {
      id: result.data.user.id,
      email: result.data.user.email,
      first_name: result.data.user.first_name,
      last_name: result.data.user.last_name,
      name: `${result.data.user.first_name} ${result.data.user.last_name}`,
      department: result.data.user.department,
      role: result.data.user.role,
      sessionToken: result.data.sessionToken,
      loggedInAt: new Date().toISOString()
    }
    
    store.set('currentUser', sessionData)
    
    return { success: true, user: sessionData }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'An error occurred during login' }
  }
}

/**
 * Logout user - clears local session and invalidates on VPS
 */
export async function logout() {
  try {
    const currentUser = store.get('currentUser')
    
    if (currentUser?.sessionToken) {
      // Invalidate session on VPS
      await apiRequest('/api/comm/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: currentUser.sessionToken
        })
      })
    }
  } catch (error) {
    console.error('Logout API error (continuing anyway):', error)
  }
  
  // Always clear local session
  store.delete('currentUser')
  return { success: true }
}

/**
 * Get current user from local session store
 */
export function getCurrentUser() {
  return store.get('currentUser') || null
}

/**
 * Check if user is authenticated (local check)
 */
export function isAuthenticated() {
  return !!store.get('currentUser')
}

/**
 * Verify session is still valid on VPS
 */
export async function verifySession() {
  const currentUser = store.get('currentUser')
  
  if (!currentUser?.sessionToken) {
    return { valid: false }
  }
  
  const result = await apiRequest('/api/comm/auth/verify', {
    method: 'POST',
    body: JSON.stringify({
      sessionToken: currentUser.sessionToken
    })
  })
  
  if (!result.success || !result.data?.valid) {
    // Session invalid, clear local
    store.delete('currentUser')
    return { valid: false }
  }
  
  return { valid: true, user: currentUser }
}

/**
 * Create a new user via VPS API
 */
export async function createUser(userData) {
  try {
    const result = await apiRequest('/api/comm/users', {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email.toLowerCase(),
        password: userData.password,
        first_name: userData.first_name,
        last_name: userData.last_name,
        department: userData.department || 'BAND_OFFICE',
        role: userData.role || 'STAFF'
      })
    })
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create user' }
    }
    
    return { 
      success: true, 
      user: result.data
    }
  } catch (error) {
    console.error('Create user error:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

/**
 * Get all users from VPS
 */
export async function getAllUsers() {
  try {
    const result = await apiRequest('/api/comm/users')
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch users' }
    }
    
    return { success: true, users: result.data }
  } catch (error) {
    console.error('Get users error:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}

/**
 * Get a specific user by ID
 */
export async function getUserById(userId) {
  try {
    const result = await apiRequest(`/api/comm/users/${userId}`)
    
    if (!result.success) {
      return { success: false, error: result.error || 'User not found' }
    }
    
    return { success: true, user: result.data }
  } catch (error) {
    console.error('Get user error:', error)
    return { success: false, error: 'Failed to fetch user' }
  }
}

/**
 * Update a user
 */
export async function updateUser(userId, userData) {
  try {
    const result = await apiRequest(`/api/comm/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    })
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update user' }
    }
    
    // If updating current user, refresh local session
    const currentUser = store.get('currentUser')
    if (currentUser?.id === userId) {
      store.set('currentUser', {
        ...currentUser,
        ...result.data,
        name: `${result.data.first_name} ${result.data.last_name}`
      })
    }
    
    return { success: true, user: result.data }
  } catch (error) {
    console.error('Update user error:', error)
    return { success: false, error: 'Failed to update user' }
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId) {
  try {
    const result = await apiRequest(`/api/comm/users/${userId}`, {
      method: 'DELETE'
    })
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete user' }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Delete user error:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

/**
 * Change user password
 */
export async function changePassword(userId, currentPassword, newPassword) {
  try {
    const result = await apiRequest(`/api/comm/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    })
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to change password' }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Change password error:', error)
    return { success: false, error: 'Failed to change password' }
  }
}

/**
 * Request password reset (sends PIN to email)
 */
export async function requestPasswordReset(email) {
  try {
    const result = await apiRequest('/api/comm/auth/reset-request', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase() })
    })
    
    return result
  } catch (error) {
    console.error('Password reset request error:', error)
    return { success: false, error: 'Failed to request password reset' }
  }
}

/**
 * Complete password reset with PIN
 */
export async function resetPassword(email, pin, newPassword) {
  try {
    const result = await apiRequest('/api/comm/auth/reset-complete', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase(),
        pin,
        newPassword
      })
    })
    
    return result
  } catch (error) {
    console.error('Password reset error:', error)
    return { success: false, error: 'Failed to reset password' }
  }
}
