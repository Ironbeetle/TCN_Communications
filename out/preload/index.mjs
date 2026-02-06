import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // Authentication
  auth: {
    login: (email, password) => ipcRenderer.invoke("auth:login", { email, password }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getCurrentUser: () => ipcRenderer.invoke("auth:getCurrentUser"),
    isAuthenticated: () => ipcRenderer.invoke("auth:isAuthenticated"),
    createUser: (userData) => ipcRenderer.invoke("auth:createUser", userData),
    getAllUsers: () => ipcRenderer.invoke("auth:getAllUsers")
  },
  // SMS
  sms: {
    send: (message, recipients, userId) => ipcRenderer.invoke("sms:send", { message, recipients, userId }),
    getHistory: (userId, limit) => ipcRenderer.invoke("sms:getHistory", { userId, limit })
  },
  // Email
  email: {
    send: (subject, message, recipients, attachments, userId) => ipcRenderer.invoke("email:send", { subject, message, recipients, attachments, userId }),
    getHistory: (userId, limit) => ipcRenderer.invoke("email:getHistory", { userId, limit })
  },
  // Contacts
  contacts: {
    search: (searchTerm, limit) => ipcRenderer.invoke("contacts:search", { searchTerm, limit }),
    getAllPhones: (limit) => ipcRenderer.invoke("contacts:getAllPhones", { limit }),
    getAllEmails: (limit) => ipcRenderer.invoke("contacts:getAllEmails", { limit }),
    testConnection: () => ipcRenderer.invoke("contacts:testConnection")
  },
  // Bulletin
  bulletin: {
    create: (data) => ipcRenderer.invoke("bulletin:create", data),
    delete: (sourceId) => ipcRenderer.invoke("bulletin:delete", sourceId),
    getHistory: (userId, limit) => ipcRenderer.invoke("bulletin:getHistory", { userId, limit })
  },
  // Forms
  forms: {
    create: (data) => ipcRenderer.invoke("forms:create", data),
    update: (data) => ipcRenderer.invoke("forms:update", data),
    delete: (formId) => ipcRenderer.invoke("forms:delete", { formId }),
    get: (formId) => ipcRenderer.invoke("forms:get", { formId }),
    getAll: (userId) => ipcRenderer.invoke("forms:getAll", { userId }),
    submit: (data) => ipcRenderer.invoke("forms:submit", data),
    getSubmissions: (formId) => ipcRenderer.invoke("forms:getSubmissions", { formId }),
    deleteSubmission: (submissionId) => ipcRenderer.invoke("forms:deleteSubmission", { submissionId }),
    syncSubmissions: (formId) => ipcRenderer.invoke("forms:syncSubmissions", { formId })
  },
  // Timesheets
  timesheets: {
    getCurrent: (userId) => ipcRenderer.invoke("timesheets:getCurrent", { userId }),
    getById: (timesheetId) => ipcRenderer.invoke("timesheets:getById", { timesheetId }),
    getUserTimesheets: (userId, status) => ipcRenderer.invoke("timesheets:getUserTimesheets", { userId, status }),
    getAll: (status, department) => ipcRenderer.invoke("timesheets:getAll", { status, department }),
    saveEntry: (data) => ipcRenderer.invoke("timesheets:saveEntry", data),
    deleteEntry: (entryId) => ipcRenderer.invoke("timesheets:deleteEntry", { entryId }),
    submit: (timesheetId) => ipcRenderer.invoke("timesheets:submit", { timesheetId }),
    approve: (timesheetId, approverId) => ipcRenderer.invoke("timesheets:approve", { timesheetId, approverId }),
    reject: (timesheetId, rejecterId, reason) => ipcRenderer.invoke("timesheets:reject", { timesheetId, rejecterId, reason }),
    revertToDraft: (timesheetId) => ipcRenderer.invoke("timesheets:revertToDraft", { timesheetId }),
    delete: (timesheetId) => ipcRenderer.invoke("timesheets:delete", { timesheetId }),
    getPayPeriodInfo: (date) => ipcRenderer.invoke("timesheets:getPayPeriodInfo", { date }),
    getStats: (userId) => ipcRenderer.invoke("timesheets:getStats", { userId })
  },
  // Memos
  memos: {
    getAll: (department) => ipcRenderer.invoke("memos:getAll", { department }),
    getById: (memoId) => ipcRenderer.invoke("memos:getById", { memoId }),
    create: (data) => ipcRenderer.invoke("memos:create", data),
    update: (memoId, updates) => ipcRenderer.invoke("memos:update", { memoId, updates }),
    delete: (memoId) => ipcRenderer.invoke("memos:delete", { memoId }),
    markAsRead: (memoId, userId) => ipcRenderer.invoke("memos:markAsRead", { memoId, userId })
  },
  // Travel Forms
  travelForms: {
    create: (data) => ipcRenderer.invoke("travelForms:create", data),
    update: (data) => ipcRenderer.invoke("travelForms:update", data),
    getById: (formId) => ipcRenderer.invoke("travelForms:getById", { formId }),
    getUserForms: (userId, status) => ipcRenderer.invoke("travelForms:getUserForms", { userId, status }),
    getAll: (status, department) => ipcRenderer.invoke("travelForms:getAll", { status, department }),
    submit: (formId) => ipcRenderer.invoke("travelForms:submit", { formId }),
    approve: (formId, approverId) => ipcRenderer.invoke("travelForms:approve", { formId, approverId }),
    reject: (formId, rejecterId, reason) => ipcRenderer.invoke("travelForms:reject", { formId, rejecterId, reason }),
    delete: (formId) => ipcRenderer.invoke("travelForms:delete", { formId }),
    getDefaultRates: () => ipcRenderer.invoke("travelForms:getDefaultRates"),
    getStats: (userId) => ipcRenderer.invoke("travelForms:getStats", userId)
  }
});
