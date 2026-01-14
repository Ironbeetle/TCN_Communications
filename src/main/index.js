import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { login, logout, getCurrentUser, isAuthenticated, createUser, getAllUsers } from './services/auth.js'
import { getPrisma, disconnectPrisma } from './services/database.js'
import { sendSms, getSmsHistory } from './services/sms.js'
import { sendEmail, getEmailHistory } from './services/email.js'
import { searchMembers, getAllPhoneNumbers, getAllEmails, testConnection } from './services/contacts.js'
import { createBulletin, deleteBulletin, getBulletinHistory } from './services/bulletin.js'
import { createForm, updateForm, deleteForm, getForm, getAllForms, submitForm, getFormSubmissions, deleteSubmission, syncSubmissions } from './services/forms.js'

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

// App lifecycle
app.whenReady().then(() => {
  // Initialize database connection
  getPrisma()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await disconnectPrisma()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await disconnectPrisma()
})
