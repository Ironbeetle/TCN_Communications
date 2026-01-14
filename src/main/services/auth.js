import bcrypt from 'bcryptjs'
import Store from 'electron-store'
import { getPrisma } from './database.js'

// Initialize store - electron-store v10 requires default export handling
let store
try {
  const StoreClass = Store.default || Store
  store = new StoreClass({
    encryptionKey: 'tcn-communications-secret-key',
    name: 'tcn-session'
  })
} catch (e) {
  console.error('Failed to initialize electron-store:', e)
  // Fallback to simple in-memory store
  const memoryStore = {}
  store = {
    get: (key) => memoryStore[key],
    set: (key, value) => { memoryStore[key] = value },
    delete: (key) => { delete memoryStore[key] }
  }
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutes

export async function login(email, password) {
  const prisma = getPrisma()
  
  try {
    console.log('Attempting login for:', email)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      return { success: false, error: 'Invalid email or password' }
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000)
      return { 
        success: false, 
        error: `Account locked. Try again in ${remainingTime} minutes.` 
      }
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      // Increment failed attempts
      const newAttempts = user.loginAttempts + 1
      const updateData = { loginAttempts: newAttempts }
      
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION)
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      })

      // Log failed attempt
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          department: user.department,
          success: false,
          failReason: 'Invalid password'
        }
      })

      return { success: false, error: 'Invalid email or password' }
    }

    // Successful login - reset attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date()
      }
    })

    // Log successful login
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        department: user.department,
        success: true
      }
    })

    // Store session
    const sessionData = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      department: user.department,
      role: user.role,
      loggedInAt: new Date().toISOString()
    }
    
    store.set('currentUser', sessionData)

    return { success: true, user: sessionData }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'An error occurred during login' }
  }
}

export function logout() {
  store.delete('currentUser')
  return { success: true }
}

export function getCurrentUser() {
  return store.get('currentUser') || null
}

export function isAuthenticated() {
  return !!store.get('currentUser')
}

export async function createUser(userData) {
  const prisma = getPrisma()
  
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    
    const user = await prisma.user.create({
      data: {
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        department: userData.department || 'BAND_OFFICE',
        role: userData.role || 'STAFF'
      }
    })

    return { 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department: user.department,
        role: user.role
      }
    }
  } catch (error) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Email already exists' }
    }
    console.error('Create user error:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

export async function getAllUsers() {
  const prisma = getPrisma()
  
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        department: true,
        role: true,
        created: true,
        lastLogin: true
      },
      orderBy: { created: 'desc' }
    })
    return { success: true, users }
  } catch (error) {
    console.error('Get users error:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}
