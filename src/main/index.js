import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Get directory of this file for proper .env loading
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file in project root
// In dev: src/main -> project root (../../.env)
// In production: out/main -> project root (../../.env)
config({ path: path.resolve(__dirname, '../../.env') })

// ==================== VPS API-BASED SERVICES ====================
// All services now use VPS API for centralized data storage
// This allows multi-location access (staff can work from any building)

// Authentication - users stored on VPS
import { 
  login, 
  logout, 
  getCurrentUser, 
  isAuthenticated, 
  createUser, 
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  verifySession,
  changePassword,
  requestPasswordReset,
  resetPassword
} from './services/auth-api.js'

// SMS - logs stored on VPS, sent via Twilio
import { sendSms, getSmsHistory, getSmsStats } from './services/sms-api.js'

// Email - logs stored on VPS, sent via Resend
import { sendEmail, getEmailHistory, getEmailStats, sendStaffEmail, getStaffEmailHistory } from './services/email-api.js'

// Contacts - reads from VPS member database (read-only)
import { searchMembers, getAllPhoneNumbers, getAllEmails, testConnection } from './services/contacts.js'

// Bulletin Board - stored on VPS
import { 
  createBulletin, 
  updateBulletin,
  deleteBulletin, 
  getBulletinById,
  getBulletinHistory,
  getBulletinStats,
  BULLETIN_CATEGORIES 
} from './services/bulletin-api.js'

// Sign-Up Forms - stored on VPS
import { 
  createForm, 
  updateForm, 
  deleteForm, 
  getForm, 
  getAllForms, 
  submitForm, 
  getFormSubmissions, 
  deleteSubmission, 
  syncSubmissions,
  getFormStats
} from './services/forms-api.js'

// Timesheets - stored on VPS
import { 
  getOrCreateCurrentTimesheet, 
  getTimesheetById, 
  getUserTimesheets, 
  getAllTimesheets, 
  saveTimeEntry, 
  deleteTimeEntry, 
  submitTimesheet, 
  approveTimesheet, 
  rejectTimesheet, 
  revertToDraft, 
  deleteTimesheet, 
  getPayPeriodInfo,
  getTimesheetStats
} from './services/timesheets-api.js'

// Travel Forms - stored on VPS
import {
  createTravelForm,
  updateTravelForm,
  getTravelFormById,
  getUserTravelForms,
  getAllTravelForms,
  submitTravelForm,
  approveTravelForm,
  rejectTravelForm,
  deleteTravelForm,
  getDefaultRates,
  getTravelFormStats
} from './services/travelForms-api.js'

// Office Memos - stored on VPS
import {
  getAllMemos,
  getMemoById,
  createMemo,
  updateMemo,
  deleteMemo,
  markMemoAsRead
} from './services/memos-api.js'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers - Authentication
ipcMain.handle('auth:login', async (event, { email, password }) => {
  return await login(email, password)
})

ipcMain.handle('auth:logout', () => {
  return logout()
})

ipcMain.handle('auth:getCurrentUser', () => {
  return getCurrentUser()
})

ipcMain.handle('auth:isAuthenticated', () => {
  return isAuthenticated()
})

ipcMain.handle('auth:createUser', async (event, userData) => {
  return await createUser(userData)
})

ipcMain.handle('auth:getAllUsers', async () => {
  return await getAllUsers()
})

// IPC Handlers - SMS
ipcMain.handle('sms:send', async (event, { message, recipients, userId }) => {
  return await sendSms({ message, recipients, userId })
})

ipcMain.handle('sms:getHistory', async (event, { userId, limit }) => {
  return await getSmsHistory(userId, limit)
})

// IPC Handlers - Email
ipcMain.handle('email:send', async (event, { subject, message, recipients, attachments, userId }) => {
  return await sendEmail({ subject, message, recipients, attachments, userId })
})

ipcMain.handle('email:getHistory', async (event, { userId, limit }) => {
  return await getEmailHistory(userId, limit)
})

// IPC Handlers - Contacts
ipcMain.handle('contacts:search', async (event, { searchTerm, limit }) => {
  return await searchMembers(searchTerm, limit)
})

ipcMain.handle('contacts:getAllPhones', async (event, { limit }) => {
  return await getAllPhoneNumbers(limit)
})

ipcMain.handle('contacts:getAllEmails', async (event, { limit }) => {
  return await getAllEmails(limit)
})

ipcMain.handle('contacts:testConnection', async () => {
  return await testConnection()
})

// IPC Handlers - Bulletin
ipcMain.handle('bulletin:create', async (event, data) => {
  return await createBulletin(data)
})

ipcMain.handle('bulletin:delete', async (event, sourceId) => {
  return await deleteBulletin(sourceId)
})

ipcMain.handle('bulletin:getHistory', async (event, { userId, limit }) => {
  return await getBulletinHistory(userId, limit)
})

// IPC Handlers - Forms
ipcMain.handle('forms:create', async (event, data) => {
  return await createForm(data)
})

ipcMain.handle('forms:update', async (event, data) => {
  return await updateForm(data)
})

ipcMain.handle('forms:delete', async (event, { formId }) => {
  return await deleteForm(formId)
})

ipcMain.handle('forms:get', async (event, { formId }) => {
  return await getForm(formId)
})

ipcMain.handle('forms:getAll', async (event, { userId }) => {
  return await getAllForms(userId)
})

ipcMain.handle('forms:submit', async (event, data) => {
  return await submitForm(data)
})

ipcMain.handle('forms:getSubmissions', async (event, { formId }) => {
  return await getFormSubmissions(formId)
})

ipcMain.handle('forms:deleteSubmission', async (event, { submissionId }) => {
  return await deleteSubmission(submissionId)
})

ipcMain.handle('forms:syncSubmissions', async (event, { formId }) => {
  return await syncSubmissions(formId)
})

ipcMain.handle('forms:getStats', async (event, { userId }) => {
  return await getFormStats(userId)
})

// IPC Handlers - Timesheets
ipcMain.handle('timesheets:getCurrent', async (event, { userId }) => {
  return await getOrCreateCurrentTimesheet({ userId })
})

ipcMain.handle('timesheets:getById', async (event, { timesheetId }) => {
  return await getTimesheetById({ timesheetId })
})

ipcMain.handle('timesheets:getUserTimesheets', async (event, { userId, status }) => {
  return await getUserTimesheets({ userId, status })
})

ipcMain.handle('timesheets:getAll', async (event, { status, department }) => {
  return await getAllTimesheets({ status, department })
})

ipcMain.handle('timesheets:saveEntry', async (event, data) => {
  return await saveTimeEntry(data)
})

ipcMain.handle('timesheets:deleteEntry', async (event, { entryId }) => {
  return await deleteTimeEntry({ entryId })
})

ipcMain.handle('timesheets:submit', async (event, { timesheetId }) => {
  return await submitTimesheet({ timesheetId })
})

ipcMain.handle('timesheets:approve', async (event, { timesheetId, approverId }) => {
  return await approveTimesheet({ timesheetId, approverId })
})

ipcMain.handle('timesheets:reject', async (event, { timesheetId, rejecterId, reason }) => {
  return await rejectTimesheet({ timesheetId, rejecterId, reason })
})

ipcMain.handle('timesheets:revertToDraft', async (event, { timesheetId }) => {
  return await revertToDraft({ timesheetId })
})

ipcMain.handle('timesheets:delete', async (event, { timesheetId }) => {
  return await deleteTimesheet({ timesheetId })
})

ipcMain.handle('timesheets:getPayPeriodInfo', async (event, { date }) => {
  return await getPayPeriodInfo({ date })
})

ipcMain.handle('timesheets:getStats', async (event, { userId }) => {
  return await getTimesheetStats(userId)
})

// IPC Handlers - Memos
ipcMain.handle('memos:getAll', async (event, { department }) => {
  return await getAllMemos(department)
})

ipcMain.handle('memos:getById', async (event, { memoId }) => {
  return await getMemoById(memoId)
})

ipcMain.handle('memos:create', async (event, data) => {
  return await createMemo(data)
})

ipcMain.handle('memos:update', async (event, { memoId, updates }) => {
  return await updateMemo(memoId, updates)
})

ipcMain.handle('memos:delete', async (event, { memoId }) => {
  return await deleteMemo(memoId)
})

ipcMain.handle('memos:markAsRead', async (event, { memoId, userId }) => {
  return await markMemoAsRead(memoId, userId)
})

// IPC Handlers - Travel Forms
ipcMain.handle('travelForms:create', async (event, data) => {
  return await createTravelForm(data)
})

ipcMain.handle('travelForms:update', async (event, data) => {
  return await updateTravelForm(data)
})

ipcMain.handle('travelForms:getById', async (event, { formId }) => {
  return await getTravelFormById({ formId })
})

ipcMain.handle('travelForms:getUserForms', async (event, { userId, status }) => {
  return await getUserTravelForms({ userId, status })
})

ipcMain.handle('travelForms:getAll', async (event, { status, department }) => {
  return await getAllTravelForms({ status, department })
})

ipcMain.handle('travelForms:submit', async (event, { formId }) => {
  return await submitTravelForm({ formId })
})

ipcMain.handle('travelForms:approve', async (event, { formId, approverId }) => {
  return await approveTravelForm({ formId, approverId })
})

ipcMain.handle('travelForms:reject', async (event, { formId, rejecterId, reason }) => {
  return await rejectTravelForm({ formId, rejecterId, reason })
})

ipcMain.handle('travelForms:delete', async (event, { formId }) => {
  return await deleteTravelForm({ formId })
})

ipcMain.handle('travelForms:getDefaultRates', async () => {
  return await getDefaultRates()
})

ipcMain.handle('travelForms:getStats', async (event, userId) => {
  return await getTravelFormStats(userId)
})

// App lifecycle
app.whenReady().then(() => {
  // VPS-based app - no local database to initialize
  // All data stored on central VPS for multi-location access
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  // Logout user on app quit to invalidate VPS session
  try {
    await logout()
  } catch (e) {
    // Ignore errors during shutdown
  }
})
